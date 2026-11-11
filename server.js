"use strict";
/* FixHub secure backend — thin entry point. All logic lives in src/.
   Browsers can only ever download files from public/. The Groq key
   never leaves this process except inside the HTTPS call to Groq. */
const http = require("node:http");
const config = require("./src/config");
const { createRateLimiter } = require("./src/rateLimit");
const { serveStatic, sendJson, securityHeaders } = require("./src/static");
const { handleChat } = require("./src/chat");
const limiter = createRateLimiter({ windowMs: 60 * 1000, max: config.chatMaxPerMin });
function onRequest(req, res) {
  const t0 = Date.now();
  res.on("finish", () => {
    console.log(new Date().toISOString(), req.method, (req.url || "").split("?")[0], res.statusCode, Date.now() - t0 + "ms");
  });
  let pathname = "/";
  try { pathname = new URL(req.url || "/", "http://x").pathname; } catch (e) {}
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, model: config.groqModel, aiConfigured: config.groqKey.length > 0 });
  }
  if (pathname === "/api/chat") {
    if (req.method !== "POST") return sendJson(res, 405, { error: "Use POST." });
    Promise.resolve(handleChat(req, res, { config, limiter })).catch((err) => {
      console.error("[chat] unhandled:", err && err.message);
      if (!res.headersSent) sendJson(res, 500, { error: "Internal error." });
      else { try { res.end(); } catch (e2) {} }
    });
    return;
  }
  if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "Unknown API." });
  if (req.method !== "GET") { res.writeHead(405, securityHeaders()); return res.end("Method not allowed"); }
  return serveStatic(req, res, config.publicDir, pathname);
}
const server = http.createServer(onRequest);
server.listen(config.port, () => {
  console.log("FixHub secure server on http://localhost:" + config.port);
  console.log("AI model: " + config.groqModel + " | Key: " + (config.groqKey ? "set" : "MISSING — /api/chat will 503 until .env has GROQ_API_KEY"));
});
