// app/api/places/route.js — Server-side proxy for Google Places API
// Keeps the API key server-side; never exposed to the browser.

const BARCELONA = { lat: 41.3874, lng: 2.1686 };

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

const NON_FOOD = new Set(["lodging","hotel","spa","gym","clothing_store","store","supermarket",
  "school","hospital","bank","movie_theater","night_club","museum","place_of_worship"]);
const FOOD = new Set(["restaurant","food","bar","cafe","bakery","meal_takeaway",
  "japanese_restaurant","sushi_restaurant","spanish_restaurant","italian_restaurant",
  "french_restaurant","mediterranean_restaurant","seafood_restaurant","steak_house",
  "vegan_restaurant","vegetarian_restaurant","fast_food_restaurant","breakfast_restaurant"]);

const CATEGORY_CONFIG = {
  food: {
    types: ["restaurant", "cafe"],
    minRating: 4.0, minReviews: 50,
    filter: (p) => {
      if ((p.types || []).includes("lodging")) return false;
      const t = (p.types || []).filter(t => !NON_FOOD.has(t));
      return t.some(t => FOOD.has(t));
    },
    cleanTypes: (types) => (types || []).filter(t => !NON_FOOD.has(t)),
  },
  sights: {
    types: ["tourist_attraction", "museum", "art_gallery"],
    minRating: 3.8, minReviews: 10,
    filter: () => true,
    cleanTypes: (t) => t || [],
  },
  parks: {
    types: ["park"],
    minRating: 3.5, minReviews: 5,
    filter: () => true,
    cleanTypes: (t) => t || [],
  },
  fitness: {
    types: ["gym"],
    minRating: 3.5, minReviews: 3,
    filter: (p) => {
      const t = p.types || [];
      if (t.includes("lodging"))      return false; // hotel spas
      if (t.includes("dentist"))      return false; // dental clinics
      if (t.includes("doctor"))       return false; // medical
      if (t.includes("hospital"))     return false;
      if (t.includes("pharmacy"))     return false;
      if (t.includes("beauty_salon")) return false;
      if (t.includes("hair_care"))    return false;
      return true;
    },
    cleanTypes: (t) => t || [],
  },
  shopping: {
    types: ["shopping_mall", "department_store"],
    minRating: 3.8, minReviews: 20,
    filter: () => true,
    cleanTypes: (t) => t || [],
  },
  nightlife: {
    types: ["night_club", "bar"],
    minRating: 3.8, minReviews: 30,
    filter: () => true,
    cleanTypes: (t) => t || [],
  },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const radius   = parseInt(searchParams.get("radius") || "1500");
  const lat      = parseFloat(searchParams.get("lat") || BARCELONA.lat);
  const lng      = parseFloat(searchParams.get("lng") || BARCELONA.lng);
  const keyword  = searchParams.get("keyword") || "";
  const category = searchParams.get("category") || "food";
  const key      = process.env.GOOGLE_PLACES_API_KEY;

  if (!key) return Response.json({ error: "No GOOGLE_PLACES_API_KEY set", results: [] });

  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.food;

  try {
    const base    = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${key}`;
    const kwParam = keyword ? `&keyword=${encodeURIComponent(keyword)}` : "";

    const allData = await Promise.all(
      cfg.types.map(type =>
        fetch(`${base}&type=${type}${kwParam}`).then(r => r.json()).catch(() => ({ results: [] }))
      )
    );

    // Merge and deduplicate by place_id
    const seen = new Set();
    const raw = allData.flatMap(d => d.results || []).filter(p => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });

    // Filter and enrich up to 40 candidates
    const enriched = [];
    for (const place of raw.slice(0, 40)) {
      if (!cfg.filter(place)) continue;
      if ((place.rating || 0) < cfg.minRating) continue;
      if ((place.user_ratings_total || 0) < cfg.minReviews) continue;

      const types = cfg.cleanTypes(place.types || []);

      // Details call for opening hours + photo
      let openNow = true, photoUrl = null;
      try {
        const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=opening_hours,photos&key=${key}`;
        const detRes  = await fetch(detUrl);
        const detData = await detRes.json();
        const det = detData.result || {};
        openNow  = det.opening_hours?.open_now ?? true;
        const photoRef = det.photos?.[0]?.photo_reference;
        if (photoRef) photoUrl = `/api/photo?ref=${encodeURIComponent(photoRef)}`;
      } catch {}

      const loc         = place.geometry?.location || {};
      const distM       = haversine(lat, lng, loc.lat || lat, loc.lng || lng);
      const vicinity    = place.vicinity || "Barcelona";
      const neighborhood = vicinity.includes(",") ? vicinity.split(",").at(-2)?.trim() : vicinity;

      enriched.push({
        place_id:      place.place_id,
        name:          place.name,
        types,
        rating:        place.rating || 3.5,
        reviews_count: place.user_ratings_total || 0,
        price_level:   place.price_level ?? null,
        open_now:      openNow,
        photo_url:     photoUrl,
        neighborhood:  neighborhood || "Barcelona",
        distance_m:    distM,
        lat:           loc.lat,
        lng:           loc.lng,
      });
    }
    return Response.json({ results: enriched });
  } catch (err) {
    return Response.json({ error: err.message, results: [] }, { status: 500 });
  }
}
