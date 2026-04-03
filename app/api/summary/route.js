// app/api/summary/route.js
// NON-STRAIGHTFORWARD LLM #1: reasons over structured interaction history
// → outputs personality insights parsed into structured fields (text + tags + accuracy)

import OpenAI from "openai";

export async function POST(request) {
  const { history, profile } = await request.json();
  const key = process.env.OPENAI_API_KEY;

  const accepted = history.filter(h => h.intent === "👍");
  const rejected = history.filter(h => h.intent === "👎");
  const saved    = history.filter(h => h.saved);
  const accuracy = history.length ? Math.round(accepted.length / history.length * 100) : null;

  if (!key || history.length < 2) {
    const top = (profile.topCuisines || []).slice(0,2).map(c =>
      c.replace("_restaurant","").replace("_"," ").replace(/^\w/, s => s.toUpperCase())
    );
    return Response.json({
      summary_text: `You gravitate towards ${top.join(" and ")} spots. The engine is still learning your preferences.`,
      top_tags: top,
      accuracy,
    });
  }

  try {
    const openai = new OpenAI({ apiKey: key });
    const prompt = `You are a food personality analyst for a restaurant recommendation engine.
A user has interacted with these recommendations:
- Accepted (👍): ${accepted.map(h=>h.name).join(", ") || "none yet"}
- Rejected (👎): ${rejected.map(h=>h.name).join(", ") || "none"}
- Saved for later: ${saved.map(h=>h.name).join(", ") || "none"}
- Top cuisine affinities from their account: ${(profile.topCuisines||[]).slice(0,4).join(", ")}
- Preferred price level: ${profile.preferredPrice}/4

Write 2 sentences of personality insight about this diner. Be specific, warm, insightful.
Then on a new line: TAGS: 3-4 short descriptor tags (e.g. "Quality-focused, Japanese lover, Mid-range").
Speak directly. No filler like "Based on your interactions".`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.8,
    });

    const raw   = resp.choices[0].message.content.trim();
    const lines = raw.split("\n");
    const text  = lines.filter(l => !l.startsWith("TAGS:")).join(" ").trim();
    const tagLine = lines.find(l => l.startsWith("TAGS:")) || "";
    const tags  = tagLine.replace("TAGS:","").split(",").map(t => t.trim()).filter(Boolean);

    return Response.json({ summary_text: text, top_tags: tags, accuracy });
  } catch {
    const top = (profile.topCuisines||[]).slice(0,2).map(c =>
      c.replace("_restaurant","").replace("_"," ").replace(/^\w/, s => s.toUpperCase())
    );
    return Response.json({
      summary_text: `You gravitate towards ${top.join(" and ")} spots with strong quality standards.`,
      top_tags: top, accuracy,
    });
  }
}
