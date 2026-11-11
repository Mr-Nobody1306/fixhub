"use strict";
/* Security smoke tests. Run with: npm test (or: node --test test/).
   These prove the frontend/backend split holds. */
const t = require("node:test");
const describe = t.describe;
const it = t.it;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
describe("backend isolation", function () {
  it("public/ files reference no secrets or server internals", function () {
    const names = ["public/config.js", "public/index.html", "public/app.js", "public/flows.js"];
    for (const f of names) {
      const body = read(f);
      // Groq key handling must never appear in the browser. Supabase JWT
      // auth headers are fine — they carry the user's own login token
      // (enforced by RLS) — so Bearer alone is NOT a violation here.
      assert.ok(!/GROQ_API_KEY|groqApiKey|groqKey|api\.groq\.com|process\.env|require\(/i.test(body), f + " must not touch secrets");
      const lines = body.split("\n");
      for (const line of lines) {
        // Capital-B "Bearer" only ever appears in the Supabase JWT header
        // string ("Bearer " + user token). The lowercase Auth.bearer()
        // method name is just a getter for that same user token.
        if (line.indexOf("Bearer") !== -1) assert.ok(line.indexOf("supabaseKey") !== -1, f + ": Bearer auth must only be Supabase user tokens");
      }
    }
  });
  it("frontend AI traffic goes only to our own /api/chat", function () {
    const body = read("public/flows.js") + read("public/app.js") + read("public/index.html");
    assert.match(body, /fetch\(["']\/api\/chat["']/);
    assert.ok(!/chat\/completions|openai\/v1/i.test(body), "no direct provider URLs in the browser");
  });
  it("server-side prompt is not shipped to the browser", function () {
    const pub = read("public/flows.js") + read("public/app.js") + read("public/index.html");
    assert.ok(read("src/persona.js").indexOf("starting prices in GH cedis") !== -1);
    assert.ok(pub.indexOf("starting prices in GH cedis") === -1);
  });
  it("server validates the trade allowlist before answering", function () {
    const body = read("src/chat.js");
    assert.ok(body.indexOf("plumbing") !== -1 && body.indexOf("hvac") !== -1, "allowlist required");
    assert.ok(body.indexOf("SERVICES.indexOf") !== -1, "service must be allowlisted");
  });
  it("server serves only public/ (plus /api/*)", function () {
    const body = read("server.js") + read("src/static.js");
    assert.ok(body.indexOf("publicDir") !== -1, "static root must be the public dir");
    assert.ok(body.indexOf("startsWith(publicDir") !== -1 || body.indexOf("indexOf(publicDir") !== -1, "path traversal guard required");
  });
  it(".env is ignored; the example ships a placeholder, never a key", function () {
    assert.match(read(".gitignore"), /^\.env$/m);
    const ex = read(".env.example");
    assert.match(ex, /GROQ_API_KEY=PASTE_YOUR_KEY_HERE/);
    assert.ok(!/gsk_[A-Za-z0-9]/.test(ex), ".env.example must not contain a real key");
  });
  it("every backend module the server loads exists", function () {
    const names = ["src/config.js", "src/persona.js", "src/ai.js", "src/chat.js", "src/rateLimit.js", "src/static.js"];
    for (const f of names) assert.ok(fs.existsSync(path.join(ROOT, f)), f + " missing");
  });
  it("public config uses public credential formats and contains no server secrets", function () {
    const body = read("public/config.js");
    assert.match(body, /supabaseUrl:\s*"https:\/\/[^"]+\.supabase\.co"/);
    assert.match(body, /supabaseAnonKey:\s*"(?:sb_publishable_[^"]+|eyJ[A-Za-z0-9_.-]+)"/);
    assert.match(body, /paystackPublicKey:\s*"pk_(?:test|live)_[A-Za-z0-9]+"/);
    assert.ok(!/gsk_[A-Za-z0-9]|sk-[A-Za-z0-9]/.test(body), "public/config.js must not contain server secrets");
  });
  it("Google OAuth navigation includes the public Supabase API key", function () {
    const body = read("public/app.js");
    assert.match(body, /searchParams\.set\("apikey", CFG\.supabaseKey\)/);
    assert.match(body, /location\.assign\(url\.toString\(\)\)/);
    assert.doesNotMatch(body, /window\.open\(url/);
  });
  it("Paystack checkout iframe is allowed by the content security policy", function () {
    const csp = require("../src/static").securityHeaders()["Content-Security-Policy"];
    assert.match(csp, /frame-src[^;]*https:\/\/checkout\.paystack\.com/);
  });
  it("only a successful Paystack callback completes a payment", function () {
    const body = read("public/flows.js");
    assert.match(body, /if \(!resp \|\| resp\.status !== "success"\)/);
  });
});
