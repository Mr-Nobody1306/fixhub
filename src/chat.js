"use strict";
/* POST /api/chat — validates the browser's request, asks Groq with the
   server-held key + server-side instructions, and returns a small
   structured answer: { reply, service, detail }. Browser errors generic. */
const modStatic = require("./static");
const sendJson = modStatic.sendJson;
const persona = require("./persona");
const ai = require("./ai");
const SERVICES = ["plumbing", "electrical", "cleaning", "carpentry", "hvac"];
function readBody(req, maxBytes) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on("data", function (c) { size += c.length; if (size > maxBytes) { reject(new Error("body_too_large")); req.destroy(); return; } chunks.push(c); });
    req.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}
function parseAnswer(content) {
  const text = String(content || "").trim();
  const tailRe = /\{[\s\S]*\}\s*$/;
  const withoutJson = text.replace(tailRe, "").trim();
  const fallbackReply = (withoutJson || "Hmm, I didn't catch that — which area is the problem in?").slice(0, 600);
  try {
    const m = text.match(tailRe);
    if (!m) return { reply: fallbackReply, service: null, detail: "" };
    const o = JSON.parse(m[0]);
    if (!o || typeof o.reply !== "string" || !o.reply.trim()) return { reply: fallbackReply, service: null, detail: "" };
    const service = SERVICES.indexOf(o.service) !== -1 ? o.service : null;
    const detail = (typeof o.detail === "string" ? o.detail.trim() : "").slice(0, 160);
    return { reply: o.reply.trim().slice(0, 600), service: service, detail: service ? detail : "" };
  } catch (e) { return { reply: fallbackReply, service: null, detail: "" }; }
}
async function handleChat(req, res, ctx) {
  const config = ctx.config;
  const limiter = ctx.limiter;
  const ip = req.socket.remoteAddress || "unknown";
  if (limiter.isLimited(ip)) return sendJson(res, 429, { error: "Too many requests — please wait a minute." });
  let raw;
  try { raw = await readBody(req, config.maxBodyBytes); }
  catch (e) { return sendJson(res, 413, { error: "Request too large." }); }
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { return sendJson(res, 400, { error: "Invalid JSON." }); }
  if (!data || !Array.isArray(data.messages) || data.messages.length === 0 || data.messages.length > config.maxMessages) {
    return sendJson(res, 400, { error: "Send 1-" + config.maxMessages + " messages." });
  }
  const clean = [];
  for (const m of data.messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return sendJson(res, 400, { error: "Bad message format." });
    const content = m.content.slice(0, config.maxMessageChars);
    if (!content.trim()) return sendJson(res, 400, { error: "Empty message." });
    clean.push({ role: m.role, content: content });
  }
  if (!config.groqKey) return sendJson(res, 503, { error: "Server AI is not configured yet." });
  const payload = [{ role: "system", content: persona.systemPrompt() }].concat(clean);
  try {
    const content = await ai.completeGroq({ baseUrl: config.groqBaseUrl, model: config.groqModel, apiKey: config.groqKey }, payload, { timeoutMs: config.upstreamTimeoutMs });
    return sendJson(res, 200, parseAnswer(content));
  } catch (err) {
    console.error("[chat]", err && err.code ? err.code : err);
    if (err && err.code === "BAD_KEY") return sendJson(res, 502, { error: "Server key rejected — contact the site owner." });
    return sendJson(res, 502, { error: "AI provider failed — try again." });
  }
}
module.exports = { handleChat: handleChat, parseAnswer: parseAnswer, SERVICES: SERVICES };
