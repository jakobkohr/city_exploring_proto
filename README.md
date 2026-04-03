# For You · Maps v2

Personalised restaurant recommendation engine — Google Maps "For You" feature prototype.

## Stack
- **Next.js 14** (App Router) — frontend + API routes
- **Framer Motion** — draggable bottom sheet, animations
- **Google Places API** — real restaurant data (server-side proxy)
- **OpenAI gpt-4o-mini** — 3 LLM features (all server-side)
- **Vercel** — one-click deploy

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in your API keys in .env.local
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel (5 minutes)

1. Push to GitHub
2. Import repo at vercel.com/new
3. Add environment variables: `GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY`
4. Deploy

## API Keys needed

| Key | Where to get | Cost |
|-----|--------------|------|
| `GOOGLE_PLACES_API_KEY` | console.cloud.google.com → Enable Places API | $200/month free credit |
| `OPENAI_API_KEY` | platform.openai.com | ~$0.01 per demo session |

## Project structure

```
app/
  page.js              # Full client-side app (login, map, bottom sheet, tabs)
  layout.js
  globals.css
  api/
    places/route.js    # Google Places proxy (server-side)
    explain/route.js   # Per-card LLM explanation
    summary/route.js   # LLM personality summary (You tab)
    parse-pref/route.js# Free-text → scoring weights (Tools pattern)
lib/
  users.js             # Mock user personas (simulated OAuth)
  engine.js            # Scoring engine (profile synthesis + weighted ranking)
```

## Non-straightforward LLM features

1. **`/api/summary`** — LLM reasons over structured interaction history → personality insights + tags (output parsed into structured fields)
2. **`/api/parse-pref`** — LLM converts free-text mood → JSON scoring weights that directly modify the ranking algorithm (Tools pattern)

## Mock OAuth

The login screen simulates Google OAuth with 3 pre-built personas (David/Eixample, Sofia/Gràcia, Marc/Barceloneta). Each has a distinct review history, visit pattern, and taste profile. Swapping personas shows how dramatically recommendations change — demonstrating the personalization engine's value. In production: replace `MOCK_USERS` with a call to Google's People API using the OAuth access token.
