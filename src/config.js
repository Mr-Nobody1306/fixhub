"use strict";
/* Central configuration. The Groq key is read here — once, at startup —
   from the .env file / environment, into process memory only.
   Nothing in public/ can ever reach it. */
const fs = require("node:fs");
const path = require("node:path");
const ROOT_DIR = path.join(__dirname, "..");
function loadDotEnv(file) {
  try {
    if (!fs.existsSync(file)) return;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.charAt(0) === "#") continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (v.length >= 2 && ((v.charAt(0) === '"' && v.slice(-1) === '"') || (v.charAt(0) === "'" && v.slice(-1) === "'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch (err) { console.error("[config] could not read .env:", err.message); }
}
function loadConfig() {
  loadDotEnv(path.join(ROOT_DIR, ".env"));
  const cfg = {
    port: Number(process.env.PORT || 8000),
    groqBaseUrl: String(process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
    groqModel: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    groqKey: process.env.GROQ_API_KEY || "",
    frontendOrigin: String(process.env.FRONTEND_ORIGIN || "").replace(/\/+$/, ""),
    rootDir: ROOT_DIR,
    publicDir: path.join(ROOT_DIR, "public"),
    maxBodyBytes: 64 * 1024,
    maxMessages: 12,
    maxMessageChars: 2000,
    upstreamTimeoutMs: 30000,
    chatMaxPerMin: 30
  };
  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) throw new Error("[config] PORT must be 1-65535");
  const httpsRe = new RegExp("^https://");
  if (!httpsRe.test(cfg.groqBaseUrl)) throw new Error("[config] GROQ_BASE_URL must start with https://");
  if (!cfg.groqModel) throw new Error("[config] GROQ_MODEL must not be empty");
  if (cfg.frontendOrigin) {
    let origin;
    try { origin = new URL(cfg.frontendOrigin); }
    catch (err) { throw new Error("[config] FRONTEND_ORIGIN must be a valid HTTPS origin"); }
    if (origin.protocol !== "https:" || origin.origin !== cfg.frontendOrigin || origin.pathname !== "/") {
      throw new Error("[config] FRONTEND_ORIGIN must be an HTTPS origin without a path");
    }
  }
  return Object.freeze(cfg);
}
module.exports = loadConfig();
