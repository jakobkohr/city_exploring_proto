// lib/users.js — Mock personas simulating Google Account data
// In production: populated from Google People API + Maps Activity API after OAuth

export const MOCK_USERS = {
  "david@gmail.com": {
    name: "David",
    email: "david@gmail.com",
    initials: "D",
    color: "#1a73e8",
    neighborhood: "Eixample",
    tagline: "Salsa dancer, ramen hunter & natural wine devotee",
    reviewed_cuisines: {
      japanese_restaurant:      { count: 12, avg_rating: 4.6 },
      sushi_restaurant:         { count: 5,  avg_rating: 4.7 },
      bar:                      { count: 9,  avg_rating: 4.3 },
      spanish_restaurant:       { count: 10, avg_rating: 4.2 },
      italian_restaurant:       { count: 7,  avg_rating: 4.0 },
      mediterranean_restaurant: { count: 5,  avg_rating: 4.5 },
      fast_food_restaurant:     { count: 2,  avg_rating: 2.8 },
    },
    visited_types: {
      japanese_restaurant: 15, bar: 18, spanish_restaurant: 12,
      italian_restaurant: 10,  cafe: 8, fast_food_restaurant: 3,
    },
    saved_places: ["Tickets", "Bodega 1900", "Koy Shunka", "Bar Brutal", "Ramen Ya Hiro"],
    preferred_price_level: 2,
    disliked: ["fast_food_restaurant", "meal_delivery"],
    fitness_interests: ["salsa dancing", "bachata", "latin dance"],
  },

  "sofia@gmail.com": {
    name: "Sofia",
    email: "sofia@gmail.com",
    initials: "S",
    color: "#e8710a",
    neighborhood: "Gràcia",
    tagline: "Boxing gym regular & plant-based brunch explorer",
    reviewed_cuisines: {
      vegan_restaurant:         { count: 14, avg_rating: 4.8 },
      mediterranean_restaurant: { count: 11, avg_rating: 4.5 },
      cafe:                     { count: 8,  avg_rating: 4.4 },
      breakfast_restaurant:     { count: 9,  avg_rating: 4.6 },
      italian_restaurant:       { count: 6,  avg_rating: 4.1 },
      spanish_restaurant:       { count: 4,  avg_rating: 3.9 },
    },
    visited_types: {
      vegan_restaurant: 20, cafe: 15, breakfast_restaurant: 18,
      mediterranean_restaurant: 12, italian_restaurant: 8, bakery: 7,
    },
    saved_places: ["Flax & Kale", "Teresa Carles", "Federal Café", "Honest Greens"],
    preferred_price_level: 2,
    disliked: ["fast_food_restaurant", "steak_house"],
    fitness_interests: ["boxing", "kickboxing", "pilates"],
  },

  "marc@gmail.com": {
    name: "Marc",
    email: "marc@gmail.com",
    initials: "M",
    color: "#188038",
    neighborhood: "Barceloneta",
    tagline: "Open-water swimmer, seafood purist & cava enthusiast",
    reviewed_cuisines: {
      seafood_restaurant: { count: 16, avg_rating: 4.7 },
      spanish_restaurant: { count: 13, avg_rating: 4.4 },
      steak_house:        { count: 7,  avg_rating: 4.6 },
      bar:                { count: 10, avg_rating: 4.2 },
    },
    visited_types: {
      seafood_restaurant: 22, bar: 19, spanish_restaurant: 14,
      steak_house: 9, fast_food_restaurant: 6,
    },
    saved_places: ["La Mar Salada", "El Xiringuito Escribà", "Bar Cañete", "La Cova Fumada"],
    preferred_price_level: 3,
    disliked: ["vegan_restaurant", "fast_food_restaurant"],
    fitness_interests: ["open-water swimming", "padel", "cycling"],
  },

  "alex@gmail.com": {
    name: "Alex",
    email: "alex@gmail.com",
    initials: "A",
    color: "#34a853",
    neighborhood: "Poblenou",
    tagline: "Crossfit regular & clean eater",
    reviewed_cuisines: {
      vegan_restaurant:         { count: 9,  avg_rating: 4.6 },
      mediterranean_restaurant: { count: 11, avg_rating: 4.7 },
      breakfast_restaurant:     { count: 8,  avg_rating: 4.5 },
      cafe:                     { count: 7,  avg_rating: 4.3 },
      japanese_restaurant:      { count: 6,  avg_rating: 4.6 },
    },
    visited_types: {
      vegan_restaurant: 14, mediterranean_restaurant: 16, breakfast_restaurant: 12,
      cafe: 10, japanese_restaurant: 8,
    },
    saved_places: ["Honest Greens", "Flax & Kale", "Koku Kitchen", "Parking Pizza"],
    preferred_price_level: 2,
    disliked: ["fast_food_restaurant", "steak_house"],
    fitness_interests: ["crossfit", "running", "yoga"],
  },
};
