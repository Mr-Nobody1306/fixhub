/* FixHub Ghana — PART 4: app logic A (config, data, backend, router, home). Extracted from index.html; order matters (loads before flows.js). */
/* FixHub Ghana — PART 4 (secure split: public keys in config.js, Groq key in server .env) */
function publicSetting(name) {
  if (typeof window !== "undefined" && window.FIXHUB_CONFIG && window.FIXHUB_CONFIG[name]) return String(window.FIXHUB_CONFIG[name]);
  if (typeof root !== "undefined" && root[name]) return String(root[name]);
  return "";
}
const CFG = {
  paystackKey: publicSetting("paystackPublicKey"),
  supabaseUrl: publicSetting("supabaseUrl"),
  supabaseKey: publicSetting("supabaseAnonKey")
};
const LIVE_PAY = CFG.paystackKey && CFG.paystackKey.indexOf("PASTE") !== 0 && typeof PaystackPop !== "undefined";
const LIVE_DB = CFG.supabaseUrl && CFG.supabaseUrl.indexOf("PASTE") !== 0 && CFG.supabaseKey && CFG.supabaseKey.indexOf("PASTE") !== 0;


const SERVICES = [
  { id: "plumbing", name: "Plumbing", base: 80, tint: "#E0F2FE", color: "#0369A1", blurb: "Leaks, pipes, tanks & fittings",
    icon: '<path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3z"/>' },
  { id: "electrical", name: "Electrical", base: 90, tint: "#FEF3C7", color: "#B45309", blurb: "Wiring, sockets & faults",
    icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { id: "cleaning", name: "Deep Cleaning", base: 150, tint: "#E6F4EC", color: "#0A7A42", blurb: "Homes, offices & move-out",
    icon: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>' },
  { id: "carpentry", name: "Carpentry", base: 100, tint: "#FFF3E8", color: "#994700", blurb: "Doors, roofs & furniture",
    icon: '<path d="M11 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5"/><path d="M14 4l6 6L9 21H4v-5z"/>' },
  { id: "hvac", name: "HVAC", base: 120, tint: "#EDE9FE", color: "#6D28D9", blurb: "AC install & servicing",
    icon: '<path d="M12 2v20M4 6l16 12M20 6L4 18M12 6l-2-2m2 2l2-2m-2 14l-2 2m2-2l2 2M3.5 9L2 8m1.5 1L2 10m18.5-1L22 8m-1.5 1L22 10M3.5 15L2 16m1.5-1L2 14m18.5 1L22 16m-1.5-1l1.5 2"/>' }
];
const TECHS = {
  plumbing:   { name: "Emmanuel Mensah", title: "Master Plumber", rating: "4.9", jobs: 142, phone: "+233244123456", wa: "233244123456", from: "Spintex Road, Accra" },
  electrical: { name: "Ama Serwaa", title: "Certified Electrician", rating: "4.8", jobs: 117, phone: "+233244654321", wa: "233244654321", from: "Osu, Accra" },
  cleaning:   { name: "Efua Owusu", title: "Cleaning Team Lead", rating: "4.9", jobs: 203, phone: "+233244789012", wa: "233244789012", from: "East Legon, Accra" },
  carpentry:  { name: "Kwame Boateng", title: "Master Carpenter", rating: "4.7", jobs: 98, phone: "+233244345678", wa: "233244345678", from: "Kaneshie, Accra" },
  hvac:       { name: "Yaw Adjei", title: "HVAC Specialist", rating: "4.8", jobs: 86, phone: "+233244901234", wa: "233244901234", from: "Tema Comm. 25" }
};
const AREAS = ["Spintex", "Osu", "East Legon", "Kaneshie", "Tema", "Kasoa", "Kumasi – Asokwa", "Takoradi – Anaji"];
const SLOTS = ["8–10am", "10–12pm", "12–2pm", "2–4pm", "4–6pm"];
const TRANSPORT = 20, SENIOR_RATE = 0.10;

/* ---------- persistent store (device) ---------- */
const Store = {
  load() {
    try {
      const s = JSON.parse(localStorage.getItem("fixhub_gh") || "{}");
      return { bookings: s.bookings || [], activeId: s.activeId || null, senior: !!s.senior, draft: s.draft || null, homeArea: s.homeArea || null, homeGeo: s.homeGeo || null, profile: s.profile || null };
    } catch (e) { return { bookings: [], activeId: null, senior: false, draft: null, homeArea: null, homeGeo: null, profile: null }; }
  },
  save(s) { try { localStorage.setItem("fixhub_gh", JSON.stringify(s)); } catch (e) {} }
};
let S = Store.load();
/* one-time purge of retired demo data (seeded jobs, demo applications) */
try {
  const before = (S.bookings || []).length;
  S.bookings = (S.bookings || []).filter(b => b && b.id !== "FX-1042" && b.id !== "FX-1017");
  if (S.bookings.length !== before) Store.save(S);
  localStorage.removeItem("fixhub_gh_seeded");
  Object.keys(localStorage).filter(k => k.indexOf("fixhub_demo_apps_") === 0).forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
} catch (e) {}
function gh(n) { return "GH₵ " + Number(n).toFixed(2); }
function persist() { Store.save(S); }

/* ---------- backend: Supabase when configured, else device ----------
   Secure mode: each device signs in anonymously (Supabase Auth) so the RLS
   policies in src/supabase.sql scope every row to its owner
   (owner_id = auth.uid()). Street address, voice notes and full photos never
   leave the device — only the hasPhoto flag syncs. */
const Auth = {
  key: "fixhub_sb_session",
  mem: null,
  load() {
    if (this.mem) return this.mem;
    try { this.mem = JSON.parse(localStorage.getItem(this.key) || "null"); } catch (e) { this.mem = null; }
    return this.mem;
  },
  persist(s) { this.mem = s; try { localStorage.setItem(this.key, JSON.stringify(s)); } catch (e) {} },
  uid() { const s = this.load(); return s && s.uid ? s.uid : null; },
  googleUid() { const s = this.load(); return s && s.provider === "google" && s.uid ? s.uid : null; },
  topUrl() { try { return location.origin + location.pathname; } catch (e) { return ""; } },
  async fetchUser() {
    const s = this.load();
    if (!s || !s.access || s.uid) return s;
    const r = await fetch(CFG.supabaseUrl + "/auth/v1/user", {
      headers: { apikey: CFG.supabaseKey, Authorization: "Bearer " + s.access }
    });
    if (!r.ok) throw 0;
    const u = await r.json();
    const meta = (u && u.user_metadata) || {};
    const n = Object.assign({}, s, {
      uid: u.id,
      email: u.email || null,
      name: meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : "FixHub user")
    });
    this.persist(n);
    return n;
  },
  loginWithGoogle() {
    if (!LIVE_DB) { toast("Backend not connected yet — add your Supabase URL + anon key in public/config.js, then reload"); return; }
    const url = new URL("/auth/v1/authorize", CFG.supabaseUrl);
    url.searchParams.set("provider", "google");
    url.searchParams.set("apikey", CFG.supabaseKey);
    url.searchParams.set("redirect_to", this.topUrl());
    location.assign(url.toString());
  },
  logout() {
    try { localStorage.removeItem(this.key); } catch (e) {}
    this.mem = null;
    S.profile = null; persist();
    toast("Logged out — browsing as guest");
    try { updateAvatar(); } catch (e) {}
    renderAccount();
  },
  async signup() {
    const r = await fetch(CFG.supabaseUrl + "/auth/v1/signup", {
      method: "POST",
      headers: { apikey: CFG.supabaseKey, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!r.ok) throw 0;
    const j = await r.json();
    if (!j.access_token || !j.user) throw 0;
    const s = { uid: j.user.id, access: j.access_token, refresh: j.refresh_token || null, exp: Date.now() + 50 * 60 * 1000 };
    this.persist(s);
    return s;
  },
  async refresh() {
    const s = this.load();
    if (!s || !s.refresh) throw 0;
    const r = await fetch(CFG.supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: CFG.supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh })
    });
    if (!r.ok) throw 0;
    const j = await r.json();
    if (!j.access_token) throw 0;
    const n = { uid: (j.user && j.user.id) || s.uid, access: j.access_token, refresh: j.refresh_token || s.refresh, exp: Date.now() + 50 * 60 * 1000 };
    this.persist(n);
    return n;
  },
  async session() {
    if (!LIVE_DB) return null;
    const s = this.load();
    if (s && s.access && Date.now() < s.exp) return s;
    try { return await this.refresh(); }
    catch (e) {
      if (s && s.provider === "google") return null; // keep Google identity; never mint anon over it
      try { return await this.signup(); }
      catch (e2) { return null; } // anonymous sign-ins disabled → transitional mode
    }
  },
  async bearer() {
    const s = await this.session();
    return s ? s.access : CFG.supabaseKey;
  }
};
const Backend = {
  headers(token) { return { apikey: CFG.supabaseKey, Authorization: "Bearer " + token }; },
  async sbGet(path) {
    const token = await Auth.bearer();
    const r = await fetch(CFG.supabaseUrl + "/rest/v1/" + path, { headers: this.headers(token) });
    if (!r.ok) throw 0;
    return r.json();
  },
  async sbSend(path, method, body, prefer) {
    const token = await Auth.bearer();
    const headers = Object.assign(this.headers(token), { "Content-Type": "application/json" });
    if (prefer) headers.Prefer = prefer;
    const r = await fetch(CFG.supabaseUrl + "/rest/v1/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw 0;
    try { return await r.json(); } catch (e) { return null; }
  },
  async list() {
    if (!LIVE_DB) return [];
    try {
      const g = Auth.googleUid();
      const token = await Auth.bearer();
      const q = g
        ? "/rest/v1/bookings?select=*&customer_id=eq." + encodeURIComponent(g) + "&order=created_at.desc&limit=50"
        : "/rest/v1/bookings?select=*" + (Auth.uid() ? "&owner_id=eq." + encodeURIComponent(Auth.uid()) : "") + "&order=created_at.desc&limit=50";
      const r = await fetch(CFG.supabaseUrl + q, { headers: this.headers(token) });
      if (!r.ok) throw 0;
      const rows = await r.json();
      return rows.map(rowToBooking);
    } catch (e) { return S.bookings; }
  },
  async save(b) {
    S.bookings = [b].concat(S.bookings.filter(x => x.id !== b.id));
    persist();
    if (!LIVE_DB) return true;
    try {
      const token = await Auth.bearer();
      await fetch(CFG.supabaseUrl + "/rest/v1/bookings", {
        method: "POST",
        headers: Object.assign(this.headers(token), { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify(bookingToRow(b))
      });
    } catch (e) {}
    return true;
  },
  async openJobs() {
    if (!LIVE_DB) return [];
    try {
      const rows = await this.sbGet("bookings?select=*&status=eq.open&order=created_at.desc&limit=20");
      return (rows || []).map(rowToBooking);
    } catch (e) { return []; }
  },
  async applicants(bookingId) {
    if (!LIVE_DB) return [];
    try {
      const rows = await this.sbGet("applications?select=*&booking_id=eq." + encodeURIComponent(bookingId) + "&order=created_at.asc");
      return (rows || []).slice().sort((a, b) => ((Number(b.rating) || 0) - (Number(a.rating) || 0)) || ((Number(b.jobs) || 0) - (Number(a.jobs) || 0)));
    } catch (e) { return []; }
  },
  async apply(booking) {
    const g = Auth.googleUid();
    if (!g || !S.profile || S.profile.role !== "artisan") throw 0;
    if (!LIVE_DB) throw 0;
    return await this.sbSend("applications", "POST", {
      booking_id: booking.id, artisan_id: g,
      artisan_name: String(S.profile.name || "Artisan").slice(0, 120),
      trade: S.profile.trade || null,
      rating: Number(S.profile.rating) || 5.0,
      jobs: Number(S.profile.jobs) || 0
    }, "resolution=merge-duplicates");
  },
  async setApplication(id, status) {
    return await this.sbSend("applications?id=eq." + encodeURIComponent(id), "PATCH", { status });
  },
  async saveProfile(patch) {
    const g = Auth.googleUid();
    if (!g) throw 0;
    await this.sbSend("profiles?id=eq." + encodeURIComponent(g), "PATCH", patch);
    S.profile = Object.assign({}, S.profile, patch);
    persist();
    return S.profile;
  }
};
function bookingToRow(b) {
  return { id: b.id, owner_id: Auth.uid(), customer_id: b.customerId || null, service: b.serviceId, description: b.desc, area: b.area, slot: b.slot, date: b.date, total: b.total, method: b.method || null, status: b.status, tech: b.tech || null, prog: (typeof b.prog === "number" ? b.prog : null), offroute: !!b.offRoute, tech_rating: (b.techRating != null ? b.techRating : null), tech_jobs: (b.techJobs != null ? b.techJobs : null) };
}
function rowToBooking(r) {
  return { id: r.id, customerId: r.customer_id || null, serviceId: r.service, desc: r.description, area: r.area, slot: r.slot, date: r.date, total: r.total, method: r.method, status: r.status, tech: r.tech, prog: (r.prog != null ? Number(r.prog) : null), offRoute: !!r.offroute, techRating: (r.tech_rating != null ? Number(r.tech_rating) : null), techJobs: (r.tech_jobs != null ? Number(r.tech_jobs) : null) };
}
function rowToProfile(r) {
  return { id: r.id, role: r.role, name: r.name, trade: r.trade || null, area: r.area || null, rating: (r.rating != null ? Number(r.rating) : 5.0), jobs: (r.jobs != null ? Number(r.jobs) : 0) };
}
async function ensureProfile() {
  if (!LIVE_DB) return null;
  const s = Auth.load();
  if (!s || s.provider !== "google") return null;
  try {
    await Auth.fetchUser();
    const me = Auth.load();
    if (!me || !me.uid) return null;
    const token = await Auth.bearer();
    const r = await fetch(CFG.supabaseUrl + "/rest/v1/profiles?id=eq." + encodeURIComponent(me.uid) + "&select=*", { headers: Backend.headers(token) });
    if (!r.ok) throw 0;
    const rows = await r.json();
    if (rows && rows[0]) { S.profile = rowToProfile(rows[0]); persist(); try { updateAvatar(); } catch (e) {} return S.profile; }
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem("fixhub_pending_role") || "null"); } catch (e) {}
    const role = pending && pending.role === "artisan" ? "artisan" : "customer";
    const body = {
      id: me.uid, role,
      name: String((me.name || "FixHub user")).slice(0, 120),
      trade: role === "artisan" ? (pending && pending.trade) || null : null,
      area: role === "artisan" ? (pending && pending.area) || null : null,
      rating: 5.0, jobs: 0
    };
    const w = await fetch(CFG.supabaseUrl + "/rest/v1/profiles", {
      method: "POST",
      headers: Object.assign(Backend.headers(token), { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify(body)
    });
    if (!w.ok) throw 0;
    S.profile = { id: me.uid, role, name: body.name, trade: body.trade, area: body.area, rating: 5.0, jobs: 0 };
    persist();
    try { updateAvatar(); } catch (e) {}
    return S.profile;
  } catch (e) { return null; }
}
/* OAuth popup lands back here top-level with #access_token — stash the
   session where the iframed app can read it (same origin), then close. */
(function oauthCallback() {
  try {
    const hash = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    const access = hash.get("access_token");
    const error = query.get("error_description") || query.get("error") || hash.get("error_description") || hash.get("error");
    if (!access && !error) return;
    history.replaceState(null, "", location.pathname);
    if (error) { toast("Google sign-in failed: " + error); return; }
    Auth.persist({
      uid: null,
      access: access,
      refresh: hash.get("refresh_token") || null,
      exp: Date.now() + (Number(hash.get("expires_in")) || 3600) * 1000 - 60000,
      provider: "google"
    });
    Auth.fetchUser().then(() => ensureProfile()).then((profile) => {
      if (!profile) {
        toast("Signed in, but your profile could not load. Check Supabase profile policies.");
        return;
      }
      show("account");
      toast("Welcome" + (profile.name ? ", " + String(profile.name).split(" ")[0] : "") + "!");
    }).catch(() => toast("Google sign-in completed, but your account could not be loaded. Please try again."));
  } catch (e) { toast("Google sign-in could not be started. Please reload and try again."); }
})();

/* ---------- tiny router ---------- */
const VIEWS = ["home", "diag", "services", "account", "privacy", "book1", "book2", "track", "pay", "history"];
let privacyFrom = "account";
function show(name) {
  VIEWS.forEach(v => { document.getElementById("view-" + v).hidden = (v !== name); });
  const tb = document.getElementById("tabbar");
  if (tb) tb.hidden = ["book1", "book2", "pay"].includes(name);
  document.querySelectorAll(".tabbtn").forEach(b => {
    const on = b.dataset.goto === name || (name === "book1" || name === "book2" ? b.dataset.goto === "home" : false) || (name === "track" ? b.dataset.goto === "history" : false);
    b.classList.toggle("on", !!on);
  });
  document.getElementById("screens").scrollTop = 0;
  window.scrollTo(0, 0);
  if (name === "home") renderHomeExtras();
  if (name === "diag") renderDiag();
  if (name === "services") renderServices();
  if (name === "account") renderAccount();
  if (name === "track") renderTrack();
  if (name === "history") renderHistory();
  if (name === "pay") renderPay();
}
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-goto]");
  if (g) {
    if (g.dataset.goto === "privacy") {
      try { privacyFrom = VIEWS.find(v => !document.getElementById("view-" + v).hidden) || "account"; } catch (err) {}
    }
    show(g.dataset.goto); return;
  }
  const b = e.target.closest("[data-back]");
  if (b) { show(b.dataset.back); return; }
  const c = e.target.closest("[data-close]");
  if (c) { document.getElementById(c.dataset.close).hidden = true; }
});

/* ---------- toast ---------- */
let toastT = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.style.opacity = "0"; }, 2600);
}

/* ---------- home: categories, search, senior mode ---------- */
function svcIcon(s, cls) {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>`;
}
function renderCats(filter) {
  const grid = document.getElementById("catGrid");
  grid.innerHTML = "";
  const q = (filter || "").toLowerCase();
  SERVICES.filter(s => !q || s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)).forEach(s => {
    const b = document.createElement("button");
    b.className = "glasscard p-3 flex flex-col items-center gap-1.5 mh128 justify-center text-center";
    b.innerHTML = `<span class="w-12 h-12 rounded-full grid place-items-center flex-none" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-6 h-6")}</span>
      <span class="cat-label font-display font-bold f13 leading-tight">${s.name}</span>
      <span class="f11 soft">from ${gh(s.base)}</span>`;
    b.onclick = () => startBooking(s.id);
    grid.appendChild(b);
  });
  if (!grid.children.length) grid.innerHTML = '<p class="col-span-3 text-center text-ink-soft f14 py-6">No matches. Try "plumber" or "clean".</p>';
}
document.getElementById("searchInput").addEventListener("input", (e) => renderCats(e.target.value));
document.getElementById("svcSearch").addEventListener("input", (e) => { svcQuery = e.target.value; renderServices(); });
function applySenior() {
  document.body.classList.toggle("easy-view", S.senior);
  document.getElementById("seniorToggle").setAttribute("aria-checked", S.senior ? "true" : "false");
}
document.getElementById("seniorToggle").onclick = () => { S.senior = !S.senior; persist(); applySenior(); toast(S.senior ? "Easy View on: larger text" : "Easy View off"); };
const GOOGLE_G_SVG = '<svg class="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>';
function updateAvatar() {
  const btn = document.getElementById("avatarBtn");
  if (!btn) return;
  const name = S.profile && S.profile.name ? String(S.profile.name).trim() : "";
  if (name) {
    btn.textContent = name[0].toUpperCase();
    btn.style.background = "";
    btn.style.border = "";
    btn.setAttribute("aria-label", "Account — signed in as " + name);
  } else {
    btn.innerHTML = GOOGLE_G_SVG;
    btn.style.background = "#fff";
    btn.style.border = "1px solid #E7EBF2";
    btn.setAttribute("aria-label", "Sign in with Google");
  }
}
function refreshAreaPill() {
  const el = document.getElementById("areaPillText");
  if (!el) return;
  if (S.homeGeo && S.homeGeo.label) el.textContent = S.homeGeo.label;
  else el.textContent = (S.homeArea || AREAS[0]) + ", Ghana";
}
async function reverseLabel(lat, lng) {
  try {
    const r = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + lat + "&longitude=" + lng + "&localityLanguage=en");
    if (!r.ok) throw 0;
    const j = await r.json();
    const place = j.city || j.locality || j.principalSubdivision || "";
    if (place) return (j.countryCode === "GH" || !j.countryCode) ? place + ", Ghana" : place;
  } catch (e) {}
  return null;
}
function cycleArea() {
  const i = AREAS.indexOf(S.homeArea || AREAS[0]);
  S.homeArea = AREAS[(i + 1) % AREAS.length];
  S.homeGeo = null;
  persist(); refreshAreaPill();
  toast("Home area set to " + S.homeArea);
}
async function locateUser(opts) {
  const silent = !!(opts && opts.silent);
  if (!("geolocation" in navigator)) { if (!silent) cycleArea(); return; }
  if (!silent) toast("Getting your current location…");
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 9000, maximumAge: 600000 }));
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    let label = await reverseLabel(lat, lng);
    if (!label) label = "My location · " + lat.toFixed(2) + ", " + lng.toFixed(2);
    S.homeGeo = { lat, lng, label, ts: Date.now() };
    const short = String(label).split(",")[0].trim();
    if (short) S.homeArea = short;
    persist(); refreshAreaPill();
    if (!silent) toast("Location set: " + label);
  } catch (e) {
    if (!silent) {
      if (e && e.code === 1) toast("Location blocked — tap again to pick your area manually");
      else toast("Couldn't get GPS — picked " + (S.homeArea || AREAS[0]) + " instead");
      if (!e || e.code !== 1) cycleArea();
    }
  }
}
function renderHomeExtras() {
  updateAvatar();
  const h = new Date().getHours();
  document.getElementById("homeGreet").textContent = h < 12 ? "Good Morning," : h < 17 ? "Good Afternoon," : "Good Evening,";
  try { document.getElementById("homeDate").textContent = new Date().toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" }); } catch (e) {}
  refreshAreaPill();
  const isArtisan = S.profile && S.profile.role === "artisan";
  document.getElementById("homeHero").hidden = !!isArtisan;
  document.getElementById("quickWrap").hidden = !!isArtisan;
  document.getElementById("jobsWrap").hidden = !isArtisan;
  if (isArtisan) {
    document.getElementById("activeBanner").hidden = true;
    document.getElementById("upcomingWrap").hidden = true;
    renderJobs();
    return;
  }
  const a = S.bookings.find(b => b.id === S.activeId && ["dispatched", "enroute", "arrived"].includes(b.status));
  document.getElementById("activeBanner").hidden = !a;
  if (a) {
    const t = TECHS[a.serviceId];
    document.getElementById("activeBannerText").textContent = a.status === "arrived" ? t.name.split(" ")[0] + " has arrived" : t.name.split(" ")[0] + " is on the way · ETA " + a.etaMin + " min";
  }
  renderUpcoming();
}
async function renderJobs() {
  const box = document.getElementById("jobsList");
  if (!box) return;
  if (!LIVE_DB) { box.innerHTML = '<div class="glasscard p-4"><p class="font-display font-bold f15">Backend not connected</p><p class="f13 soft mt-1">Open requests appear here once you add your Supabase URL + anon key in public/config.js and reload.</p></div>'; return; }
  box.innerHTML = '<p class="f14 soft">Finding open requests…</p>';
  let jobs = [];
  try { jobs = await Backend.openJobs(); } catch (e) { jobs = []; }
  box.innerHTML = "";
  if (!jobs.length) box.innerHTML = '<p class="f14 soft glasscard p-4">No open requests right now. New customer jobs appear here — check back soon.</p>';
  jobs.slice(0, 20).forEach(j => {
    const s = svc(j.serviceId) || { name: j.serviceId, tint: "#F1F5F9", color: "#4A5268", icon: "" };
    const el = document.createElement("div");
    el.className = "glasscard p-4";
    el.innerHTML = `<div class="flex items-center gap-3">
      <span class="w-12 h-12 rounded-full grid place-items-center flex-none" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-6 h-6")}</span>
      <div class="flex-1 min-w-0"><p class="font-display font-extrabold f15 truncate">${s.name}</p>
      <p class="f12 soft">${j.area || ""} · ${j.date || ""} · ${j.slot || ""}</p></div>
      <span class="font-display font-extrabold f15">${gh(j.total || 0)}</span></div>
      ${j.desc ? `<p class="f13 soft mt-2">“${escapeHtml(j.desc)}”</p>` : ""}
      <button class="btn-dark mt-2 w-full font-display font-bold f14 rounded-2xl py-3 mh50">Apply for this job</button>`;
    el.querySelector("button").onclick = () => applyForJob(j);
    box.appendChild(el);
  });
}
async function applyForJob(j) {
  if (!LIVE_DB) { toast("Backend not connected yet — add your Supabase keys in public/config.js"); return; }
  if (!S.profile || S.profile.role !== "artisan" || !Auth.googleUid()) { toast("Log in as an artisan to apply"); show("account"); return; }
  try {
    await Backend.apply(j);
    toast("Application sent — the customer will review it");
  } catch (e) { toast("Could not apply — you may have already applied"); }
}
function renderUpcoming() {
  const wrap = document.getElementById("upcomingWrap"), box = document.getElementById("upcomingCard");
  if (!wrap || !box) return;
  const a = S.bookings.find(b => b.id === S.activeId && ["dispatched", "enroute", "arrived", "working"].includes(b.status));
  const target = a || [...S.bookings].sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
  if (!target) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const s = svc(target.serviceId) || { name: target.serviceId, tint: "#F1F5F9", color: "#4A5268", icon: "" };
  const t = TECHS[target.serviceId];
  box.innerHTML = "";
  const d = document.createElement("div");
  d.className = "glasscard p-4 flex items-center gap-3";
  d.innerHTML = `<span class="w-12 h-12 rounded-full grid place-items-center flex-none" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-6 h-6")}</span>
    <div class="flex-1 min-w-0"><p class="f11 font-bold uptime">${a ? "Arriving " + (target.etaMin || 15) + " min · " + target.slot : (target.date || "") + " · " + (target.slot || "")}</p>
    <p class="font-display font-extrabold f15 truncate">${s.name}</p>
    <p class="f12 soft truncate">${t ? t.name : (target.tech || "")} · ${target.area || ""}</p></div>
    <button class="chipx on flex-none" id="upcomingView">View</button>`;
  box.appendChild(d);
  document.getElementById("upcomingView").onclick = () => show(a ? "track" : "history");
}
document.getElementById("activeBannerBtn").onclick = () => show("track");
document.getElementById("seeAllBtn").onclick = () => {
  const g = document.getElementById("catGrid");
  if (g) g.scrollIntoView({ behavior: "smooth", block: "center" });
};
document.querySelectorAll("[data-start]").forEach(b => { b.onclick = () => startBooking(b.dataset.start); });
document.getElementById("areaPill").onclick = () => { locateUser({ silent: false }); };
const EXAMPLES = [
  "My AC is running but isn't cooling...",
  "Kitchen sink is leaking under the pipe...",
  "Bedroom socket sparks when I plug in...",
  "My room stays hot even with the fan on...",
  "Wooden door won't lock properly..."
];
let exIdx = 0;
document.getElementById("exampleBtn").onclick = () => {
  document.getElementById("homeSymptom").value = EXAMPLES[exIdx % EXAMPLES.length];
  exIdx++;
};
document.getElementById("aiWriteBtn").onclick = () => {
  const el = document.getElementById("homeSymptom");
  const t = el.value.trim();
  if (!t) { toast("Describe the issue in a few words first"); el.focus(); return; }
  const sid = matchSymptom(t);
  el.value = t.replace(/\.*$/, "") + ". " + (sid ? "This looks like a " + svc(sid).name.toLowerCase() + " issue — please send a CID-checked " + svc(sid).name.toLowerCase() + " technician to inspect and fix it." : "Please send a CID-checked technician to inspect and fix it.");
  toast("Draft enhanced");
};
document.getElementById("describeBtn").onclick = () => {
  const t = document.getElementById("homeSymptom").value.trim();
  startDiagnose(t);
};
applySenior();
renderCats("");