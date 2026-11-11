"use strict";
/* Sliding-window per-IP rate limiter (in-memory — fine for one box). */
function createRateLimiter(opts) {
  const hits = new Map();
  const timer = setInterval(function () {
    const now = Date.now();
    const it = hits.entries();
    let cur = it.next();
    while (!cur.done) {
      const fresh = cur.value[1].filter(function (t) { return now - t < opts.windowMs; });
      if (fresh.length) hits.set(cur.value[0], fresh); else hits.delete(cur.value[0]);
      cur = it.next();
    }
  }, opts.windowMs);
  if (timer.unref) timer.unref();
  return {
    isLimited: function (ip) {
      const now = Date.now();
      const arr = (hits.get(ip) || []).filter(function (t) { return now - t < opts.windowMs; });
      arr.push(now);
      hits.set(ip, arr);
      return arr.length > opts.max;
    },
    stop: function () { clearInterval(timer); }
  };
}
module.exports = { createRateLimiter: createRateLimiter };
