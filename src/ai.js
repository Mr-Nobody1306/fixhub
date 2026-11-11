"use strict";
/* Groq client. The server-held key is attached here — the only place it
   ever leaves process memory is inside this HTTPS request to Groq. */
async function completeGroq(opts, messages, o2) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, o2.timeoutMs);
  let upstream;
  try {
    upstream = await fetch(opts.baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + opts.apiKey },
      body: JSON.stringify({ model: opts.model, messages: messages, temperature: 0.4, max_tokens: 300 }),
      signal: ctrl.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === "AbortError") throw Object.assign(new Error("aborted"), { code: "ABORTED" });
    throw Object.assign(new Error("unreachable"), { code: "UNREACHABLE" });
  }
  clearTimeout(timer);
  if (!upstream.ok) {
    const detail = await upstream.text().catch(function () { return ""; });
    console.error("[ai] upstream error", upstream.status, String(detail).slice(0, 300));
    if (upstream.status === 401 || upstream.status === 403) throw Object.assign(new Error("bad-key"), { code: "BAD_KEY" });
    throw Object.assign(new Error("http-" + upstream.status), { code: "UPSTREAM_HTTP" });
  }
  let j;
  try { j = await upstream.json(); }
  catch (e) { throw Object.assign(new Error("bad-upstream-json"), { code: "UPSTREAM_HTTP" }); }
  const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (typeof content !== "string" || !content) throw Object.assign(new Error("empty-upstream"), { code: "UPSTREAM_HTTP" });
  return content;
}
module.exports = { completeGroq: completeGroq };
