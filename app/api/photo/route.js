// app/api/photo/route.js — Proxy for Google Places photos (keeps API key server-side)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!ref || !key) return new Response("Missing params", { status: 400 });

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${ref}&key=${key}`;
  const res = await fetch(url);
  const blob = await res.arrayBuffer();
  return new Response(blob, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
