// lib/engine.js — Profile synthesis & weighted scoring (JS port of engine.py)

const CUISINE_ALIASES = {
  japanese_restaurant:      ["japanese_restaurant","sushi_restaurant","ramen_restaurant"],
  sushi_restaurant:         ["sushi_restaurant","japanese_restaurant"],
  bar:                      ["bar","spanish_restaurant"],
  spanish_restaurant:       ["spanish_restaurant","bar"],
  italian_restaurant:       ["italian_restaurant","pizza_restaurant"],
  mediterranean_restaurant: ["mediterranean_restaurant","spanish_restaurant"],
  seafood_restaurant:       ["seafood_restaurant","spanish_restaurant"],
  vegan_restaurant:         ["vegan_restaurant","vegetarian_restaurant"],
  vegetarian_restaurant:    ["vegetarian_restaurant","vegan_restaurant"],
  steak_house:              ["steak_house"],
  cafe:                     ["cafe","bakery","breakfast_restaurant"],
  breakfast_restaurant:     ["breakfast_restaurant","cafe","bakery"],
  fast_food_restaurant:     ["fast_food_restaurant","meal_takeaway"],
};

export const DEFAULT_WEIGHTS = { cuisine:0.32, rating:0.24, price:0.14, distance:0.30 };

export function synthesizeProfile(user) {
  const reviews  = user.reviewed_cuisines || {};
  const visits   = user.visited_types || {};
  const disliked = new Set(user.disliked || []);
  const affinity = {};

  for (const [cuisine, data] of Object.entries(reviews)) {
    if (disliked.has(cuisine)) continue;
    affinity[cuisine] = (affinity[cuisine] || 0) + data.count * 0.4 + data.avg_rating * 2 * 0.4;
  }
  for (const [cuisine, count] of Object.entries(visits)) {
    if (disliked.has(cuisine)) continue;
    affinity[cuisine] = (affinity[cuisine] || 0) + count * 0.35;
  }
  const maxVal = Math.max(...Object.values(affinity), 1);
  const normalized = Object.fromEntries(
    Object.entries(affinity).map(([k,v]) => [k, Math.round(v/maxVal*1000)/1000])
  );
  const topCuisines = Object.entries(normalized)
    .sort((a,b) => b[1]-a[1]).slice(0,5).map(([k]) => k);

  // Derive lifestyle hints from review history + explicit interests
  const HEALTH_TYPES = new Set(["vegan_restaurant","vegetarian_restaurant",
    "mediterranean_restaurant","breakfast_restaurant","cafe","seafood_restaurant"]);
  const healthScore = Object.entries(reviews)
    .filter(([k]) => HEALTH_TYPES.has(k))
    .reduce((s, [, v]) => s + v.count * v.avg_rating, 0);
  const totalScore = Object.values(reviews).reduce((s, v) => s + v.count * v.avg_rating, 0);
  const healthConscious = totalScore > 0 && healthScore / totalScore > 0.45;
  const fitnessInterests = user.fitness_interests || [];
  const fitnessOriented  = fitnessInterests.length > 0;

  return {
    topCuisines,
    affinity: normalized,
    preferredPrice: user.preferred_price_level || 2,
    disliked: [...disliked],
    name: user.name,
    lifestyleHints: { healthConscious, fitnessOriented, fitnessInterests },
  };
}

export function scoreRestaurants(restaurants, profile, { mode="all", advanced={}, weights } = {}) {
  const w = weights || { ...DEFAULT_WEIGHTS };

  // Hard filters
  let filtered = restaurants.filter(r => {
    if (advanced.price_max && (r.price_level || 2) > advanced.price_max) return false;
    if (advanced.open_now && r.open_now === false) return false;
    if (mode === "open" && r.open_now === false) return false;
    return true;
  });
  if (filtered.length === 0) filtered = restaurants;

  // Vibe filter: use reviews_count as busyness proxy
  if (advanced.vibe === "quiet") {
    const quiet = filtered.filter(r => (r.reviews_count || 0) < 400);
    if (quiet.length >= 3) filtered = quiet;
  } else if (advanced.vibe === "lively") {
    const lively = filtered.filter(r => (r.reviews_count || 0) >= 400);
    if (lively.length >= 3) filtered = lively;
  }

  const scored = filtered.map(r => {
    const rTypes = new Set(r.types || []);

    // Cuisine score
    let cuisineScore = 0;

    if (advanced.cuisine_override?.length) {
      // User explicitly asked for a specific cuisine — score purely on that match
      const overrideSet = new Set(advanced.cuisine_override);
      const matches = [...overrideSet].some(t => rTypes.has(t));
      cuisineScore = matches ? 100 : 0;
    } else {
      for (const cuisine of profile.topCuisines) {
        const aliases = new Set(CUISINE_ALIASES[cuisine] || [cuisine]);
        const overlap = [...aliases].some(a => rTypes.has(a));
        if (overlap) cuisineScore = Math.max(cuisineScore, (profile.affinity[cuisine]||0)*100);
      }
    }
    for (const d of profile.disliked) {
      if (rTypes.has(d)) cuisineScore *= 0.3;
    }
    if (mode === "trending" && (r.reviews_count||0) > 800) cuisineScore = Math.min(100, cuisineScore*1.15);
    if (mode === "hidden"   && (r.reviews_count||0) < 200) cuisineScore = Math.min(100, cuisineScore*1.20);

    // Rating score — baseline 4.0 (all restaurants pre-filtered ≥4.0)
    const ratingScore = Math.max(0, Math.min(100, ((r.rating||4.0) - 4.0) / 0.9 * 100));

    // Price score
    const priceScore  = Math.max(0, 100 - Math.abs((profile.preferredPrice||2) - (r.price_level||2)) * 33);

    // Distance score
    const distScore   = Math.max(0, 100 - ((r.distance_m||1000) / 2000) * 100);

    const rawTotal = Math.min(100, Math.max(0, Math.round(
      w.cuisine*cuisineScore + w.rating*ratingScore + w.price*priceScore + w.distance*distScore
    )));

    return { ...r, rawTotal, cuisineScore: Math.round(cuisineScore),
      ratingScore: Math.round(ratingScore), priceScore: Math.round(priceScore), distScore: Math.round(distScore) };
  })
  .sort((a,b) => b.rawTotal - a.rawTotal)
  .slice(0, 6);

  // Normalise into 80–96% band so For You picks always look realistic
  if (!scored.length) return [];
  const hiRaw = scored[0].rawTotal;
  const loRaw = scored[scored.length - 1].rawTotal;
  const span  = Math.max(hiRaw - loRaw, 8); // min spread so scores don't collapse
  return scored.map(r => ({
    ...r,
    matchPct: Math.max(80, Math.round(80 + ((r.rawTotal - loRaw) / span) * 16)),
  }));
}
