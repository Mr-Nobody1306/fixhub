# FixHub — Secure deployment (split frontend + backend)

The FixHub Ghana app, organized so the Groq key can never be seen or
taken from the browser — the same split as NetBuddy secure.

How the split protects the key:

  browser --POST /api/chat--> server.js --key attached HERE--> Groq
    only chat text in,            .env lives on YOUR machine
    reply+service out             only public/ is ever served
    NO key in either direction

- server.js + src/*.js hold the key (from .env into process memory).
  The server ONLY serves files inside public/ — server.js, src/ and
  .env return 404 and can never be downloaded.
- public/index.html contains ZERO secrets. Its only AI call is
  fetch("/api/chat") on the same server (plus the documented public
  APIs: your Supabase project, Paystack popup, Google Fonts,
  BigDataCloud reverse-geocode).
- The assistant's instructions live in src/persona.js on the server —
  visitors cannot read or override them. The server also allowlists the
  trade (plumbing..hvac) before answering.
- Hardening: per-IP rate limiting (30 AI chats/min), body-size caps
  (64 KB), strict message validation (12 turns max, 2000 chars each),
  security headers, generic browser errors with details in your
  terminal only.
- Proof: npm test runs security smoke tests that fail the build if
  any secret reference ever appears in public/.

Project layout:

  fixhub-secure/
    server.js            # thin entry point: routing + listen
    src/
      config.js          # .env loading + validation (key lives here)
      persona.js         # assistant instructions (server-side)
      ai.js              # Groq client (key attached here only)
      chat.js            # POST /api/chat: validate -> Groq -> answer
      rateLimit.js       # per-IP sliding-window limiter
      static.js          # traversal-safe static serving + headers
    public/              # EVERYTHING the browser may download
      index.html         # markup + views (loads the files below)
      styles.css         # all hand-written CSS (no frameworks)
      app.js             # PART 4: config, data, backend, router, home
      flows.js           # PART 5: booking, tracking, pay, history, AI chat
      config.js          # PUBLIC keys only (Supabase anon + Paystack public)
    test/
      security.test.js   # npm test — proves the split holds
    .env.example         # copy to .env, fill in your Groq key
    package.json / README.md

Setup (3 minutes):

  cd fixhub-secure
  cp .env.example .env        # Windows: copy .env.example .env
  # edit .env and paste your Groq key into GROQ_API_KEY
  # edit public/config.js: paste Supabase URL + anon key + Paystack PUBLIC key
  node server.js
  # open http://localhost:8000

Needs Node.js 18+ (node -v). Zero dependencies — npm install is not
required. Run npm test any time to re-verify the split. GET /api/health
shows whether Server AI is configured (never the key).

Google sign-in setup:

1. Enable Google under Supabase Authentication → Providers and enter the
   OAuth client ID and secret from Google Cloud.
2. In Google Cloud, set the authorized redirect URI to the callback URL shown
   by Supabase for your project (usually
   https://<project-ref>.supabase.co/auth/v1/callback).
3. In Supabase Authentication → URL Configuration, allow the app's origin
   (http://localhost:8000 for local development and your production origin
   when deployed). The app returns to its current page after sign-in.
4. Confirm the Supabase URL and publishable/anon key in public/config.js are
   for that same project.

Without a Groq key the app still runs: /api/chat answers 503 and the
chat falls back to built-in keyword triage on the phone.

Deploying (VPS, Render, Railway…):

1. Upload everything EXCEPT .env (it is git-ignored).
2. Set GROQ_API_KEY in the host dashboard (plus GROQ_MODEL, PORT if changed).
   Fill public/config.js with your public Supabase/Paystack values.
3. Run node server.js (or npm start). Put HTTPS in front (host TLS).

Rotating a leaked key: revoke it at console.groq.com, put the new one in
.env (or the host dashboard), restart. Nothing in the frontend changes.

Relation to the Perchance preview: the Perchance generator (index.html +
main.pjs at the project root) calls Groq directly from the browser with a
key pasted in main.pjs — the only way a pure client-side preview can reach
Groq, and anyone can copy that key. Treat the preview key as disposable
(dedicated key, tight limits) and run THIS secure package for real use.
