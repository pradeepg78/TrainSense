# Deploying TrainSense (web) to Vercel

This deploys the **frontend + backend in one Vercel project**:

- The Expo web build (`mobile/dist`) is served as the static site.
- The Flask API runs as a Python serverless function at `/api/*`.
- Same origin → no CORS, no separate backend host, free Hobby tier.

## What's already wired up

| File | Purpose |
|------|---------|
| `vercel.json` | Builds the web app, serves `mobile/dist`, routes `/api/*` to the function |
| `api/index.py` | Serverless entry — loads the Flask app from `backend/`, copies the SQLite DB to `/tmp` |
| `requirements.txt` | Trimmed Python deps for the API (no pandas/numpy — faster cold starts) |
| `mobile/src/services/api.ts` | Web build calls `/api` on its own origin |
| `mobile/showcase/index.html` | Phone-frame page (also published at `/showcase`) |

## Option A — Vercel Dashboard (no CLI, recommended)

1. Commit & push these new/changed files to GitHub (`pradeepg78/TrainSense`, `main`):
   - `vercel.json`, `api/index.py`, `requirements.txt`, `DEPLOY.md`
   - `mobile/src/screens/MapScreen.web.tsx`, `mobile/src/services/api.ts`
   - `mobile/showcase/index.html`
   - `backend/app/routes/transit_routes.py` (lazy pandas import)
   - `package-lock.json` changes (mapbox-gl, react-map-gl)
2. Go to **vercel.com → Add New → Project → Import** `pradeepg78/TrainSense`.
3. **Root Directory:** leave as the repo root (where `vercel.json` lives).
4. **Environment Variables:** add `MAPBOX_ACCESS_TOKEN` = (the token from `mobile/.env`).
   Needed at build time so the map renders.
5. Click **Deploy**. First build takes a few minutes.

Result:
- `https://<project>.vercel.app/` → the live app
- `https://<project>.vercel.app/showcase` → the app inside the phone frame
- `https://<project>.vercel.app/api/health` → backend health check

## Option B — Vercel CLI

```bash
npm i -g vercel
cd /Users/daniellee/trainsense/TrainSense
vercel            # follow prompts; set root to this dir
vercel env add MAPBOX_ACCESS_TOKEN     # paste the token
vercel --prod
```

## Embedding in your portfolio

Drop this where you want the phone to appear (replace the URL with your deployed one):

```html
<iframe
  src="https://<project>.vercel.app/showcase"
  style="width: 520px; height: 920px; border: 0;"
  allow="geolocation"
  title="TrainSense demo">
</iframe>
```

Or copy the markup from `mobile/showcase/index.html` directly into your site and
point its inner iframe at `https://<project>.vercel.app/`.

## Notes / caveats

- **Cold starts:** after idle, the first station-tap (arrivals) may take ~1–3s
  while the function spins up. The map itself is instant (bundled data).
- **Real-time arrivals** use MTA's public feeds — no API key required.
- **SQLite is read-only** on Vercel; the `/api/data/load` admin endpoint won't
  work there (not needed for the demo). Read endpoints work fine.
- Rebuild the local preview after code changes with
  `cd mobile && npx expo export --platform web`.
