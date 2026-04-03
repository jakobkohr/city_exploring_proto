// app/api/parse-pref/route.js
// Anthropic tool-use pattern: forces structured output via tool schema — no JSON parsing errors

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT = { weights: { cuisine:0.40, rating:0.30, price:0.20, distance:0.10 }, filters: {}, summary_label: null };

const extractTool = {
  name: "extract_preferences",
  description: "Extract structured dining preferences from user input",
  input_schema: {
    type: "object",
    properties: {
      weights: {
        type: "object",
        properties: {
          cuisine:  { type: "number" },
          rating:   { type: "number" },
          price:    { type: "number" },
          distance: { type: "number" },
        },
        required: ["cuisine","rating","price","distance"],
      },
      filters: {
        type: "object",
        properties: {
          price_max: { type: ["integer","null"] },
          open_now:  { type: "boolean" },
          vibe:      { type: ["string","null"], enum: ["quiet","lively",null] },
        },
      },
      cuisine_override: {
        type: ["array","null"],
        items: { type: "string" },
      },
      summary_label: { type: "string" },
    },
    required: ["weights","filters","summary_label"],
  },
};

export async function POST(request) {
  const { text } = await request.json();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !text?.trim()) return Response.json(DEFAULT);

  try {
    const client = new Anthropic({ apiKey: key });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      tools: [extractTool],
      tool_choice: { type: "any" },
      messages: [{
        role: "user",
        content: `Extract dining preferences from: "${text}"

Rules:
- weights must sum to 1.0
- Cheap → high price weight + price_max 1-2. Quality → high rating weight. Nearby → high distance weight.
- vibe="quiet" for calm/work/relaxed. vibe="lively" for buzzing/popular/energetic. Otherwise vibe=null.
- open_now=true only if user explicitly wants somewhere open right now.
- cuisine_override: ONLY set if user names a specific cuisine. Map to Google Places types:
  pizza/italian → ["italian_restaurant","pizza_restaurant"]
  japanese/sushi/ramen → ["japanese_restaurant","sushi_restaurant","ramen_restaurant"]
  brunch/breakfast/cafe → ["cafe","breakfast_restaurant"]
  vegan/vegetarian/plant-based → ["vegan_restaurant","vegetarian_restaurant"]
  seafood/fish → ["seafood_restaurant"]
  spanish/tapas → ["spanish_restaurant","bar"]
  steak/meat/grill → ["steak_house"]
  mediterranean → ["mediterranean_restaurant"]
  french → ["french_restaurant"]
  Otherwise cuisine_override=null.`,
      }],
    });

    const toolUse = msg.content.find(b => b.type === "tool_use");
    if (!toolUse) return Response.json(DEFAULT);

    const { weights, filters, cuisine_override, summary_label } = toolUse.input;

    // Normalise weights to sum exactly 1.0
    const total = Object.values(weights).reduce((a,b) => a+b, 0);
    if (Math.abs(total - 1.0) > 0.05)
      for (const k in weights) weights[k] = Math.round(weights[k]/total*1000)/1000;

    return Response.json({ weights, filters: filters || {}, cuisine_override: cuisine_override || null, summary_label });
  } catch {
    return Response.json(DEFAULT);
  }
}
