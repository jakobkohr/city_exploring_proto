// app/api/agent/route.js
// Real agentic loop: Claude autonomously calls search_places, reasons about
// results, and iterates until it finds the 3 best matches for the user's request.

import Anthropic from "@anthropic-ai/sdk";

// ── Food-specific filters (used only when category === "food") ────────────────
const NON_FOOD = new Set(["lodging","hotel","spa","gym","clothing_store","store",
  "supermarket","school","hospital","bank","movie_theater","night_club","museum","place_of_worship"]);
const FOOD = new Set(["restaurant","food","bar","cafe","bakery","meal_takeaway",
  "japanese_restaurant","sushi_restaurant","spanish_restaurant","italian_restaurant",
  "french_restaurant","mediterranean_restaurant","seafood_restaurant","steak_house",
  "vegan_restaurant","vegetarian_restaurant","fast_food_restaurant","breakfast_restaurant"]);

// ── Per-category config ───────────────────────────────────────────────────────
const CATEGORY_SEARCH_TYPES = {
  food:      ["restaurant", "cafe"],
  sights:    ["tourist_attraction", "museum", "art_gallery"],
  parks:     ["park"],
  fitness:   ["gym"],
  shopping:  ["shopping_mall", "department_store"],
  nightlife: ["night_club", "bar"],
};

const CATEGORY_LABELS = {
  food:      "restaurants",
  sights:    "tourist attractions and museums",
  parks:     "parks and outdoor spaces",
  fitness:   "gyms and fitness centres",
  shopping:  "shopping destinations",
  nightlife: "bars and nightlife venues",
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

async function searchPlaces(keyword, lat, lng, radius, category = "food") {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  const types   = CATEGORY_SEARCH_TYPES[category] || CATEGORY_SEARCH_TYPES.food;
  const base    = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${key}`;
  const kw      = keyword ? `&keyword=${encodeURIComponent(keyword)}` : "";
  const minRating  = category === "food" ? 4.0 : 3.5;
  const minReviews = category === "food" ? 50  : category === "fitness" ? 3 : 5;

  // For fitness keyword searches, also do a type-free keyword search so we catch
  // dance academies, martial arts schools, etc. that Google doesn't tag as "gym"
  const fetchPromises = types.map(type =>
    fetch(`${base}&type=${type}${kw}`).then(r => r.json()).catch(() => ({ results: [] }))
  );
  if (category === "fitness" && keyword) {
    fetchPromises.push(
      fetch(`${base}${kw}`).then(r => r.json()).catch(() => ({ results: [] }))
    );
  }

  const allData = await Promise.all(fetchPromises);

  const seen = new Set();
  return allData.flatMap(d => d.results || [])
    .filter(p => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      if (category === "food") {
        if ((p.types || []).includes("lodging")) return false;
        const fTypes = (p.types || []).filter(t => !NON_FOOD.has(t));
        if (!fTypes.some(t => FOOD.has(t))) return false;
      }
      if (category === "fitness") {
        const t = p.types || [];
        if (t.includes("lodging") || t.includes("dentist") || t.includes("doctor") ||
            t.includes("hospital") || t.includes("pharmacy") ||
            t.includes("beauty_salon") || t.includes("hair_care")) return false;
      }
      if ((p.rating || 0) < minRating || (p.user_ratings_total || 0) < minReviews) return false;
      return true;
    })
    .slice(0, 20)
    .map(p => {
      const loc  = p.geometry?.location || {};
      const dist = haversine(lat, lng, loc.lat || lat, loc.lng || lng);
      const vic  = p.vicinity || "Barcelona";
      const nbhd = vic.includes(",") ? vic.split(",").at(-2)?.trim() : vic;
      return {
        place_id:      p.place_id,
        name:          p.name,
        types:         p.types || [],
        rating:        p.rating || 3.5,
        reviews_count: p.user_ratings_total || 0,
        price_level:   p.price_level ?? null,
        open_now:      true,
        photo_url:     null,
        neighborhood:  nbhd || "Barcelona",
        distance_m:    dist,
        lat:           loc.lat,
        lng:           loc.lng,
      };
    });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  const { text, profile, lat, lng, radius, existingRestaurants, modeContext, advanced, category = "food" } = await request.json();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ picks: [], summary: null, allRestaurants: existingRestaurants || [] });

  const client = new Anthropic({ apiKey: key });
  const categoryLabel = CATEGORY_LABELS[category] || "places";

  // Build context from already-loaded places
  const existingCtx = existingRestaurants?.length
    ? `\n\nPlaces already loaded in the user's current radius:\n` +
      existingRestaurants.map(r =>
        `- ${r.name} | ${r.types?.slice(0,2).join(", ")} | ★${r.rating} | ${r.distance_m}m`
      ).join("\n")
    : "";

  const hints     = profile?.lifestyleHints || {};
  const interests = hints.fitnessInterests || [];

  const profileCtx = category === "food"
    ? `User taste profile: loves ${profile?.topCuisines?.slice(0,3).join(", ") || "varied cuisine"}, preferred price ${"€".repeat(profile?.preferredPrice||2)} (${profile?.preferredPrice||2}/4).`
    : `Finding the best ${categoryLabel} near the user.`;

  const lifestyleCtx = (() => {
    if (category === "food" && hints.fitnessOriented)
      return `User lifestyle: fitness-oriented (${interests.join(", ")}). Strongly prefer lighter, protein-rich, clean-eating options — Mediterranean, Japanese, vegan/vegetarian, fresh salad-focused spots. Downweight heavy or greasy cuisine unless it is a perfect taste match.`;
    if (category === "food" && hints.healthConscious)
      return `User lifestyle: health-conscious. Lean towards fresh, nutritious options — plant-based, Mediterranean, light cafés.`;
    if (category === "fitness" && hints.fitnessOriented && interests.length)
      return `User fitness interests: ${interests.join(", ")}. Prioritise venues that match these specific activities. A user who does crossfit should see crossfit boxes; a runner should see running clubs or track facilities; a yogi should see yoga studios.`;
    return "";
  })();

  const system = `You are a ${categoryLabel} recommendation agent for Barcelona, Spain.

${profileCtx}${lifestyleCtx ? `\n${lifestyleCtx}` : ""}
User location: ${lat}, ${lng}. Search radius: ${radius}m.${existingCtx}

${advanced?.price_max && category === "food" ? `Hard constraint: budget per person ≤ ${advanced.price_max === 1 ? "~€20" : advanced.price_max === 2 ? "~€35" : "~€60"} (Google price level ≤ ${advanced.price_max}). IMPORTANT: Google price_level is only an approximation. Cross-reference your own knowledge of the place's actual typical spend — if you know the place is more expensive than the budget allows, exclude it even if its price_level appears to fit.` : ""}
${advanced?.vibe === "quiet"
  ? `Hard constraint: QUIET vibe only. Use all available signals to judge atmosphere — not just review count. Consider: side streets and hidden courtyards over main thoroughfares; neighbourhoods known for calm (Gràcia backstreets, Sant Pere, Born interiors) over busy tourist zones; lower foot-traffic areas; places known to be intimate or neighbourhood-oriented. Review count is one signal among many. Avoid anything known for queues, a buzzing scene, or high foot traffic.`
  : advanced?.vibe === "lively"
  ? `Hard constraint: LIVELY vibe only. Use all available signals: main streets, squares, and high foot-traffic areas; neighbourhoods with energy (El Born, Barceloneta, Eixample Esquerra, Gràcia plaças); places known for a buzzing, social, or popular reputation in Barcelona; high review counts and a broad mix of visitor types. Avoid intimate, off-the-beaten-path spots.`
  : ""}
${advanced?.open_now ? "Hard constraint: only suggest places that are currently open." : ""}

Your goal: find the 3 best ${categoryLabel} for the user's request.
- CRITICAL: You may ONLY pick places that appear in the already-loaded list above OR that were returned by a search_places call in this conversation. Never name a place from your own knowledge that was not in those lists — if you do, it cannot be shown to the user.
- First check if the already-loaded places satisfy the request. If yes, pick from them.
- If the loaded places do not satisfy the request, call search_places with a relevant keyword. You may search up to 3 times with different keywords to build up a good pool.
- Consider rating, distance, and how well the place matches the request.
${modeContext === "trending"
  ? `- TRENDING MODE: prioritise places with the highest review counts (500+ reviews). These are buzzing, popular spots everyone visits. Search for "popular", "best", "famous" ${categoryLabel}. Avoid low-review-count places.`
  : modeContext === "hidden"
  ? `- HIDDEN GEM MODE: prioritise places with high rating (4.4+) but relatively few reviews (under 300). These are underrated local secrets not yet overrun by tourists. Avoid places with 500+ reviews. Search for "local", "authentic", "neighbourhood" ${categoryLabel}.`
  : ""}
- Once you have identified the best 3, respond ONLY with this exact JSON (no markdown, no explanation):
{"picks":["Exact Name 1","Exact Name 2","Exact Name 3"],"reasons":["why #1 fits","why #2 fits","why #3 fits"],"summary":"3-5 word label"}`;

  // ── Tool definition (category-aware description) ──────────────────────────
  const TOOLS = [{
    name: "search_places",
    description: `Search for ${categoryLabel} near the user using Google Places. Call this with specific keywords to find places matching certain criteria. Returns a list of nearby matching places with ratings and distances.`,
    input_schema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: `Search term relevant to ${categoryLabel}, e.g. "${category === "food" ? "pizza, sushi, romantic dinner, vegan brunch" : category === "sights" ? "Picasso museum, gothic quarter, art, history" : category === "parks" ? "garden, park, nature, green space" : category === "fitness" ? "gym, yoga, crossfit, swimming" : category === "shopping" ? "vintage, fashion, market, design" : "cocktail bar, live music, rooftop, club"}". Be specific and try different keywords if first results aren't ideal.`,
        },
      },
      required: ["keyword"],
    },
  }];

  const messages = [{ role: "user", content: `Find me: "${text}"` }];
  const allRestaurants = [...(existingRestaurants || [])];

  // ── Agentic loop (max 8 turns) ────────────────────────────────────────────
  for (let turn = 0; turn < 8; turn++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    // Agent finished — extract final JSON answer
    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(b => b.type === "text")?.text || "";
      try {
        const json = JSON.parse(textBlock.match(/\{[\s\S]*\}/)?.[0] || "{}");
        const basePicks = (json.picks || []).map((name, i) => {
          const found = allRestaurants.find(r =>
            r.name === name ||
            r.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(r.name.toLowerCase())
          );
          return found
            ? { ...found, explanation: json.reasons?.[i] || null, matchPct: 95 - i * 3 }
            : null;
        }).filter(Boolean);

        // Enrich picks with photo + open_now from Places Details
        const gKey = process.env.GOOGLE_PLACES_API_KEY;
        const picks = await Promise.all(basePicks.map(async r => {
          if (!gKey || !r.place_id) return r;
          try {
            const det = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${r.place_id}&fields=opening_hours,photos&key=${gKey}`
            ).then(res => res.json());
            const result   = det.result || {};
            const photoRef = result.photos?.[0]?.photo_reference;
            return {
              ...r,
              open_now:  result.opening_hours?.open_now ?? r.open_now,
              photo_url: photoRef ? `/api/photo?ref=${encodeURIComponent(photoRef)}` : null,
            };
          } catch { return r; }
        }));

        return Response.json({ picks, summary: json.summary, allRestaurants });
      } catch {
        return Response.json({ picks: [], summary: null, allRestaurants });
      }
    }

    // Agent called a tool — execute it and feed results back
    if (response.stop_reason === "tool_use") {
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        if (block.name === "search_places") {
          const results = await searchPlaces(block.input.keyword, lat, lng, radius, category);
          for (const r of results) {
            if (!allRestaurants.find(e => e.place_id === r.place_id)) allRestaurants.push(r);
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: results.length
              ? JSON.stringify(results.map(r => ({
                  name: r.name,
                  types: r.types?.slice(0, 3),
                  rating: r.rating,
                  price_level: r.price_level,
                  distance_m: r.distance_m,
                  reviews_count: r.reviews_count,
                })))
              : "No results found for this keyword.",
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  }

  return Response.json({ picks: [], summary: null, allRestaurants });
}
