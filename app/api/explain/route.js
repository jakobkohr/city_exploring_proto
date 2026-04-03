// app/api/explain/route.js — Generates personalized 1-sentence explanation per restaurant

import OpenAI from "openai";

export async function POST(request) {
  const { restaurant, profile } = await request.json();
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ explanation: _fallback(restaurant, profile) });

  try {
    const openai = new OpenAI({ apiKey: key });
    const prompt = `You are a concise restaurant recommendation assistant.
The user's top cuisine preferences are: ${profile.topCuisines?.slice(0,3).join(", ")}.
Their preferred price level is ${profile.preferredPrice} out of 4.
The restaurant: ${restaurant.name}, types: ${(restaurant.types||[]).join(", ")}, rating: ${restaurant.rating}, price level: ${restaurant.price_level}.
Write exactly ONE sentence (max 20 words) explaining why this restaurant fits this user. Be specific. Never use the word "perfect".`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 60,
      temperature: 0.7,
    });
    return Response.json({ explanation: resp.choices[0].message.content.trim().replace(/^"|"$/g,"") });
  } catch {
    return Response.json({ explanation: _fallback(restaurant, profile) });
  }
}

function _fallback(r, profile) {
  const top = profile.topCuisines?.[0] || "restaurant";
  const label = top.replace("_restaurant","").replace("_"," ");
  return `Matches your love of ${label} with a ${r.rating}★ rating.`;
}
