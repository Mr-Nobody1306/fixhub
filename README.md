# FixHub Ghana

FixHub is split into a static frontend and a small Node.js API. The frontend
is deployed to GitHub Pages; the API is deployed to Render. The Groq API key
is stored only as a secret environment variable on the API host.

## Deploy

### 1. Push this project to GitHub

Create a GitHub repository and push this project to its `main` branch. Do not
commit `.env` or paste any private API key into a source file.

### 2. Deploy the API to Render

Create a Render Blueprint Instance from the GitHub repository so Render can
read the included `render.yaml` and create the Web Service. Set these
environment variables when prompted:

- `GROQ_API_KEY`: a newly issued Groq API key (keep it in Render's environment
  settings; never put it in GitHub or the frontend).
- `FRONTEND_ORIGIN`: `https://<github-owner>.github.io` (the site origin only,
  without the repository path or trailing slash).

Render provides an HTTPS service URL after deployment. Confirm that its
`/api/health` endpoint responds successfully.

### 3. Configure GitHub Pages

In the repository settings, choose **Pages → Build and deployment → GitHub
Actions**. Add a repository Actions variable named `BACKEND_URL` with the
Render service's HTTPS origin (for example, `https://fixhub-api.onrender.com`,
with no path).

The workflow in `.github/workflows/deploy-pages.yml` builds the deployment
configuration and publishes only `public/`. Pushes to `main` deploy
automatically. The browser sends AI chat requests to the configured Render
service; it never receives the Groq key.

The published URL is typically
`https://<github-owner>.github.io/<repository-name>/`. Add that URL to the
allowed redirect URLs in Supabase Authentication. The `FRONTEND_ORIGIN` value
is only the origin (`https://<github-owner>.github.io`), not this full URL.

## Local checks

- Requires Node.js 18 or newer.
- `npm test` runs the security smoke tests.
- `npm start` starts the API for development. Set `GROQ_API_KEY` in a local
  `.env` file or in the process environment; `.env` is ignored by Git.

The frontend's Supabase URL/anon key and Paystack public key are intentionally
public and live in `public/config.js`. Never put private credentials there.
The backend serves only `public/`; server source, private configuration, and
`.env` are not served.
