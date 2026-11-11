"use strict";
/* Static file serving + shared HTTP helpers.
   Only files under publicDir are ever reachable. Anything else
   (server.js, src/, .env) returns 404 — the key cannot be downloaded. */
const fs = require("node:fs");
const path = require("node:path");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };
function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' https://js.paystack.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self' https:; frame-src https://js.paystack.co https://checkout.paystack.com; object-src 'none'; base-uri 'self'"
  };
}
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "X-Content-Type-Options": "nosniff" });
  res.end(body);
}
function serveStatic(req, res, publicDir, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  let file;
  try { file = path.normalize(path.join(publicDir, decodeURIComponent(rel))); }
  catch (e) { res.writeHead(400, securityHeaders()); return res.end("Bad request"); }
  if (file !== publicDir && file.indexOf(publicDir + path.sep) !== 0) { res.writeHead(403, securityHeaders()); return res.end("Forbidden"); }
  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) { res.writeHead(404, securityHeaders()); return res.end("Not found"); }
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const headers = securityHeaders();
    headers["Content-Type"] = type;
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
}
module.exports = { securityHeaders: securityHeaders, sendJson: sendJson, serveStatic: serveStatic };
