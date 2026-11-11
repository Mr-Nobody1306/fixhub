/* FixHub Ghana — PART 5: app logic B (booking, tracking, payment, history, AI chat). Extracted from index.html; loads after app.js. */
/* ---------- booking flow ---------- */
let draft = S.draft || null;
function startBooking(serviceId) {
  draft = { serviceId, desc: "", area: (S.homeArea || AREAS[0]), addr: "", date: new Date().toISOString().slice(0, 10), slot: SLOTS[1], voiceSecs: 0, photo: null, voiceUrl: null };
  S.draft = draft; persist();
  fillBook1();
  show("book1");
}
function svc(id) { return SERVICES.find(s => s.id === id); }
function fillBook1() {
  const s = svc(draft.serviceId);
  document.getElementById("book1Title").textContent = "Book " + s.name;
  document.getElementById("book1Summary").innerHTML =
    `<div class="flex items-center gap-3">
      <span class="w-12 h-12 rounded-full grid place-items-center flex-none" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-6 h-6")}</span>
      <div class="flex-1"><p class="font-display font-extrabold f16">${s.name}</p><p class="f12h text-ink-soft">${s.blurb}</p></div>
      <div class="text-right"><p class="f11 text-ink-soft">EST. TOTAL</p><p class="font-display font-extrabold f18 text-trust-deep">${gh(s.base + TRANSPORT)}</p></div>
    </div>`;
  document.getElementById("jobDesc").value = draft.desc || "";
  const area = document.getElementById("areaSelect");
  area.innerHTML = AREAS.map(a => `<option ${a === draft.area ? "selected" : ""}>${a}</option>`).join("");
  document.getElementById("addrInput").value = draft.addr || "";
  document.getElementById("dateInput").value = draft.date;
  document.getElementById("dateInput").min = new Date().toISOString().slice(0, 10);
  const row = document.getElementById("slotRow");
  row.innerHTML = "";
  SLOTS.forEach(sl => {
    const b = document.createElement("button");
    const on = sl === draft.slot;
    b.className = "flex-none px-4 py-2.5 rounded-full f13h font-bold mh44 " + (on ? "bg-trust text-white" : "bg-slate-100 text-ink-soft");
    b.textContent = sl;
    b.onclick = () => { draft.slot = sl; fillSlots(); };
    row.appendChild(b);
  });
  updateVoiceUI();
  if (draft.photo) { const p = document.getElementById("photoPreview"); p.src = draft.photo; p.hidden = false; document.getElementById("photoStatus").textContent = "Photo attached"; }
}
function fillSlots() {
  const row = document.getElementById("slotRow");
  [...row.children].forEach(b => {
    const on = b.textContent === draft.slot;
    b.className = "flex-none px-4 py-2.5 rounded-full f13h font-bold mh44 " + (on ? "bg-trust text-white" : "bg-slate-100 text-ink-soft");
  });
}
["jobDesc", "areaSelect", "addrInput", "dateInput"].forEach(id => {
  document.getElementById(id === "areaSelect" ? "areaSelect" : id).addEventListener("input", (e) => {
    if (!draft) return;
    if (id === "jobDesc") draft.desc = e.target.value;
    if (id === "areaSelect") draft.area = e.target.value;
    if (id === "addrInput") draft.addr = e.target.value;
    if (id === "dateInput") draft.date = e.target.value;
    S.draft = draft; persist();
  });
});
function priceOf(serviceId, senior) {
  const s = svc(serviceId);
  const discount = senior ? Math.round(s.base * SENIOR_RATE) : 0;
  return { service: s.base, transport: TRANSPORT, discount, total: s.base + TRANSPORT - discount };
}
document.getElementById("toStep2Btn").onclick = () => {
  if (!draft.addr.trim()) { toast("Add your street / landmark so the artisan finds you"); document.getElementById("addrInput").focus(); return; }
  if (!draft.date) { toast("Pick a preferred day"); return; }
  S.draft = draft; persist();
  const s = svc(draft.serviceId);
  const p = priceOf(draft.serviceId, S.senior);
  document.getElementById("book2Summary").innerHTML =
    `<div class="flex items-center gap-3">
      <span class="w-12 h-12 rounded-full grid place-items-center flex-none" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-6 h-6")}</span>
      <div><p class="font-display font-extrabold f16">${s.name}</p>
      <p class="f12h text-ink-soft">${draft.area} · ${draft.addr}</p>
      <p class="f12h text-ink-soft">${draft.date} · ${draft.slot}${draft.voiceSecs ? " · voice note (" + draft.voiceSecs + "s)" : ""}${draft.photo ? " · photo attached" : ""}</p></div>
    </div>${draft.desc ? `<p class="f13h mt-2 bg-canvas rounded-xl p-2.5 border border-line">“${escapeHtml(draft.desc)}”</p>` : ""}`;
  document.getElementById("book2Prices").innerHTML =
    row2("Service fee (" + s.name + ")", gh(p.service)) +
    row2("Transportation", gh(p.transport)) +
    (p.discount ? row2("Senior discount (10%)", "−" + gh(p.discount), true) : "") +
    `<div class="flex justify-between font-display font-extrabold f16 pt-1"><span>Total</span><span class="text-trust-deep">${gh(p.total)}</span></div>`;
  show("book2");
};
function row2(k, v, green) {
  return `<div class="flex justify-between"><span class="text-ink-soft">${k}</span><span class="font-bold ${green ? "text-trust" : ""}">${v}</span></div>`;
}
function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
document.getElementById("dispatchBtn").onclick = async () => {
  if (!LIVE_DB) { toast("Backend not connected yet — add your Supabase keys in public/config.js, then reload"); return; }
  const p = priceOf(draft.serviceId, S.senior);
  const t = TECHS[draft.serviceId];
  const g = Auth.googleUid();
  const asOpen = !!(g && S.profile && S.profile.role === "customer");
  const b = {
    id: "FX-" + Math.floor(1000 + Math.random() * 9000),
    serviceId: draft.serviceId, desc: draft.desc, area: draft.area, addr: draft.addr,
    date: draft.date, slot: draft.slot, senior: S.senior,
    service: p.service, transport: p.transport, discount: p.discount, total: p.total,
    tech: asOpen ? null : t.name, techRating: asOpen ? null : Number(t.rating), techJobs: asOpen ? null : t.jobs,
    status: asOpen ? "open" : "enroute", step: 1, etaMin: 15, prog: 0.06, offRoute: false, method: null,
    createdAt: Date.now(), voiceSecs: draft.voiceSecs, hasPhoto: !!draft.photo,
    customerId: asOpen ? g : null
  };
  S.bookings.unshift(b);
  S.activeId = asOpen ? null : b.id;
  S.draft = null; draft = null;
  persist();
  await Backend.save(b);
  if (asOpen) {
    toast("Request posted! Artisans can now apply");
    show("history");
  } else {
    toast("Dispatched! " + t.name.split(" ")[0] + " is on the way");
    show("track");
  }
};

/* ---------- voice note + photo ---------- */
let recorder = null, recChunks = [], recTimer = null, recSecs = 0;
const voiceBtn = document.getElementById("voiceBtn");
voiceBtn.onclick = async () => {
  if (recorder) { stopRec(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    recChunks = []; recSecs = 0;
    recorder.ondataavailable = (e) => recChunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach(tr => tr.stop());
      const blob = new Blob(recChunks, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      if (draft) { draft.voiceSecs = recSecs; draft.voiceUrl = url; S.draft = draft; persist(); }
      const pb = document.getElementById("voicePlayback");
      pb.src = url; pb.hidden = false;
      recorder = null;
      updateVoiceUI();
    };
    recorder.start();
    recTimer = setInterval(() => { recSecs++; updateVoiceUI(true); }, 1000);
    updateVoiceUI(true);
  } catch (e) { toast("Microphone blocked — describe the issue in words instead"); }
};
function stopRec() { if (recorder) recorder.stop(); clearInterval(recTimer); }
function updateVoiceUI(active) {
  const on = !!recorder || (draft && draft.voiceSecs);
  document.getElementById("voiceIcon").innerHTML = recorder
    ? '<span class="rec-dot"></span>'
    : '<svg class="w-5 h-5 text-impact-deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></svg>';
  document.getElementById("voiceLabel").textContent = recorder ? ("Recording… " + recSecs + "s — tap to stop") : "Tap to Speak";
  document.getElementById("voiceStatus").textContent = recorder ? "Listening…" : (draft && draft.voiceSecs ? "Saved (" + draft.voiceSecs + "s)" : "No recording");
}
document.getElementById("photoInput").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    const k = Math.min(1, 480 / Math.max(img.width, img.height));
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.7);
    if (draft) { draft.photo = url; S.draft = draft; persist(); }
    const p = document.getElementById("photoPreview");
    p.src = url; p.hidden = false;
    document.getElementById("photoStatus").textContent = "Photo attached";
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f);
});

/* ---------- tracking: live GPS simulation + off-route detection ---------- */
const STEPS = ["Booking confirmed", "Artisan on the way", "Arrives & inspects", "Repair in progress"];
function activeBooking() { return S.bookings.find(b => b.id === S.activeId && ["dispatched", "enroute", "arrived", "working"].includes(b.status)) || null; }
const Track = {
  timer: null, lastUpdate: 0, saveTick: 0,
  ensure() { if (!this.timer) this.timer = setInterval(() => this.tick(false), 4000); },
  progOf(b) {
    if (typeof b.prog === "number") return Math.min(1, Math.max(0, b.prog));
    return (b.status === "arrived" || b.status === "working") ? 1 : b.status === "enroute" ? 0.55 : 0.2;
  },
  tick(force) {
    const b = activeBooking();
    if (!b) return;
    if (!force && document.getElementById("view-track").hidden) return;
    if (b.status === "arrived" || b.status === "working") {
      b.prog = 1; b.offRoute = false;
    } else {
      if (!b.offRoute && Math.random() < 0.14 && this.progOf(b) > 0.12 && this.progOf(b) < 0.88) { b.offRoute = true; b.offTicks = 2; }
      else if (b.offRoute) { b.offTicks = (b.offTicks || 1) - 1; if (b.offTicks <= 0) b.offRoute = false; }
      const p = Math.min(1, this.progOf(b) + 0.045 + Math.random() * 0.05);
      b.prog = p;
      b.etaMin = Math.max(1, Math.round((1 - p) * 22));
      if (p >= 1) { b.status = "arrived"; b.offRoute = false; b.etaMin = 0; persist(); try { Backend.save(b); } catch (e) {} renderTrack(); toast("Artisan has arrived"); return; }
      else if (b.status === "dispatched") b.status = "enroute";
    }
    this.lastUpdate = Date.now();
    persist();
    this.saveTick++;
    if (LIVE_DB && this.saveTick % 2 === 0) { try { Backend.save(b); } catch (e) {} }
    renderTrack();
  }
};
Track.ensure();
function renderTrack() {
  const b = activeBooking();
  document.getElementById("trackEmpty").hidden = !!b;
  document.getElementById("trackBody").hidden = !b;
  if (!b) return;
  const t = TECHS[b.serviceId] || { name: "FixHub artisan", title: "CID-checked artisan", rating: "5.0", jobs: 0, phone: "0800349548", wa: "233800349548", from: b.area || "Accra" };
  const dispName = b.tech || t.name;
  const first = String(dispName).split(" ")[0];
  const rating = b.techRating != null ? Number(b.techRating).toFixed(1) : t.rating;
  const jobs = b.techJobs != null ? b.techJobs : t.jobs;
  const arrived = b.status === "arrived" || b.status === "working";
  const off = !!b.offRoute && !arrived;
  document.getElementById("trackRef").textContent = b.id + " · " + svc(b.serviceId).name;
  document.getElementById("liveBanner").textContent = arrived
    ? "LIVE: " + first + " is at your location"
    : off ? "LIVE: " + first + " branched off route — recalculating…"
    : "LIVE DISPATCH: " + first + " is on his way!";
  document.getElementById("etaText").textContent = arrived ? "Arrived" : "In about " + b.etaMin + " min";
  document.getElementById("routeText").textContent = off
    ? "Detour detected — " + first + " left the planned route. New ETA " + b.etaMin + " min."
    : "Departing from " + t.from + (S.homeGeo && S.homeGeo.label ? " → " + S.homeGeo.label : "");
  const alert = document.getElementById("routeAlert");
  if (alert) {
    alert.hidden = !off;
    if (off) document.getElementById("routeAlertText").textContent = first + " branched off the planned route — rerouting. You are seeing the live detour.";
  }
  const pill = document.getElementById("offPill");
  if (pill) {
    pill.textContent = arrived ? "Arrived" : off ? "Off route" : "On route · live";
    pill.className = "offpill " + (off ? "off" : "live");
  }
  const meta = document.getElementById("gpsMeta");
  if (meta) {
    if (!Track.lastUpdate) meta.textContent = "Live GPS · acquiring signal…";
    else {
      const s = Math.max(0, Math.round((Date.now() - Track.lastUpdate) / 1000));
      meta.textContent = "Live GPS · updated " + (s < 3 ? "just now" : s + "s ago");
    }
  }
  document.getElementById("techAvatar").textContent = String(dispName)[0].toUpperCase();
  document.getElementById("techName").textContent = dispName;
  document.getElementById("techTitle").textContent = b.tech && !TECHS[b.serviceId] ? "Accepted artisan" : t.title;
  document.getElementById("techRating").textContent = rating;
  document.getElementById("techJobs").textContent = jobs;
  document.getElementById("callTechBtn").href = "tel:" + t.phone;
  document.getElementById("callTechBtn").innerHTML = document.getElementById("callTechBtn").innerHTML.replace(/Call .*Now/, "Call " + first + " Now");
  document.getElementById("waTechBtn").href = "https://wa.me/" + t.wa + "?text=" + encodeURIComponent("Hello " + first + ", this is about my FixHub booking " + b.id);
  const idx = b.status === "dispatched" ? 1 : b.status === "enroute" ? 1 : b.status === "arrived" ? 2 : 3;
  const box = document.getElementById("tlSteps");
  box.innerHTML = "";
  STEPS.forEach((s, i) => {
    const done = i <= idx, cur = i === idx;
    const row = document.createElement("div");
    row.className = "flex items-start gap-3";
    row.innerHTML = `<span class="tl-dot ${done ? "bg-trust text-white" : "bg-slate-200 text-slate-400"}">
        ${done
          ? '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
          : '<span class="w-2 h-2 rounded-full bg-current"></span>'}
      </span>
      <span class="pt-1"><span class="block font-bold f14 ${done ? "" : "text-slate-400"}">${s}</span>
      ${cur ? '<span class="block f12 text-trust font-bold">In progress</span>' : ""}</span>`;
    box.appendChild(row);
  });
  document.getElementById("tlFill").style.height = (idx / (STEPS.length - 1)) * 100 + "%";
  document.getElementById("tlSteps").parentElement.style.setProperty("--x", 1);
  try {
    const prog = Track.progOf(b);
    const path = document.getElementById("routePath");
    if (path && path.getTotalLength) {
      const L = path.getTotalLength();
      const pt = path.getPointAtLength(L * prog);
      const pt2 = path.getPointAtLength(Math.min(L, L * prog + 2));
      const car = document.getElementById("carMarker");
      if (car) {
        const ox = off ? 16 : 0, oy = off ? -12 : 0;
        car.setAttribute("transform", "translate(" + (pt.x + ox) + "," + (pt.y + oy) + ") rotate(" + (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI) + ")");
        car.style.opacity = off ? "0.85" : "1";
      }
    }
    const mm = document.getElementById("mapEtaMin");
    if (mm) mm.textContent = arrived ? "Arrived" : "about " + b.etaMin + " min";
  } catch (e) {}
}
document.getElementById("refreshEtaBtn").onclick = () => { Track.tick(true); toast("Live location refreshed"); };
document.getElementById("payNowBtn").onclick = () => show("pay");
document.getElementById("cancelBtn").onclick = () => { document.getElementById("cancelDrawer").hidden = false; };
document.getElementById("confirmCancelBtn").onclick = async () => {
  const b = activeBooking();
  document.getElementById("cancelDrawer").hidden = true;
  if (!b) return;
  b.status = "cancelled";
  S.activeId = null;
  persist();
  await Backend.save(b);
  toast("Booking cancelled — free of charge");
  show("history");
};
document.getElementById("reschedBtn").onclick = () => {
  document.getElementById("schedDrawer").hidden = false;
  const r = document.getElementById("reschedSlots");
  r.innerHTML = "";
  SLOTS.forEach(sl => {
    const x = document.createElement("button");
    x.className = "flex-none px-4 py-2.5 rounded-full f13h font-bold mh44 bg-slate-100";
    x.textContent = sl;
    x.onclick = () => { [...r.children].forEach(c => c.classList.replace("bg-trust", "bg-slate-100") || c.classList.remove("text-white")); x.classList.add("bg-trust", "text-white"); r.dataset.pick = sl; };
    r.appendChild(x);
  });
};
document.getElementById("saveReschedBtn").onclick = async () => {
  const b = activeBooking();
  if (!b) return;
  const d = document.getElementById("reschedDate").value;
  const sl = document.getElementById("reschedSlots").dataset.pick;
  if (!d || !sl) { toast("Pick a day and a time slot"); return; }
  b.date = d; b.slot = sl;
  persist();
  await Backend.save(b);
  document.getElementById("schedDrawer").hidden = true;
  toast("Rescheduled to " + d + ", " + sl);
};

/* ---------- payment ---------- */
function payMethod() {
  const el = document.querySelector('input[name="paymethod"]:checked');
  return el ? el.value : "MTN Mobile Money";
}
function renderPay() {
  const b = S.bookings.find(x => x.id === S.activeId) || S.bookings.find(x => ["paid", "completed"].includes(x.status));
  if (!b) { show("history"); return; }
  document.getElementById("payLines").innerHTML =
    row2("Service fee", gh(b.service)) +
    row2("Transportation", gh(b.transport)) +
    (b.discount ? row2("Senior discount (10%)", "−" + gh(b.discount), true) : "") +
    row2("Escrow protection", "Free", true);
  document.getElementById("payTotal").textContent = gh(b.total);
  updatePayBtn();
}
document.querySelectorAll('input[name="paymethod"]').forEach(el => el.addEventListener("change", updatePayBtn));
function updatePayBtn() {
  const b = S.bookings.find(x => x.id === S.activeId) || S.bookings[0];
  const m = payMethod();
  const short = m === "MTN Mobile Money" ? "MTN MoMo" : m === "Telecel Cash" ? "Telecel" : "Cash";
  document.getElementById("payBtn").textContent = m === "Cash to Artisan"
    ? "Confirm — I'll pay " + gh(b ? b.total : 0) + " in cash"
    : "Pay " + gh(b ? b.total : 0) + " with " + short;
}
document.getElementById("payBtn").onclick = () => {
  const b = S.bookings.find(x => x.id === S.activeId);
  if (!b) return;
  const m = payMethod();
  if (m === "Cash to Artisan") { completeBooking(b, m); return; }
  if (!LIVE_PAY || typeof PaystackPop === "undefined") { toast("Payment not connected — check the Paystack public key and reload"); return; }
  const session = Auth.load() || {};
  const email = session.email || ("customer-" + String(Auth.uid() || "guest").replace(/[^a-zA-Z0-9]/g, "") + "@fixhub.gh");
  try {
    const handler = PaystackPop.setup({
      key: CFG.paystackKey,
      email,
      amount: Math.round(Number(b.total) * 100),
      currency: "GHS",
      ref: b.id + "-" + Date.now(),
      metadata: { booking: b.id, service: b.serviceId, method: m, total: b.total },
      channels: ["mobile_money"],
      callback: (resp) => {
        if (!resp || resp.status !== "success") {
          toast("Payment was not completed — please try again");
          return;
        }
        b.payRef = resp.reference || null;
        completeBooking(b, m);
      },
      onClose: () => toast("Payment window closed — no charge made")
    });
    handler.openIframe();
  }
  catch (e) { toast("Could not open Paystack checkout — check your connection and try again"); }
};
async function completeBooking(b, method) {
  b.status = "paid";
  b.method = method;
  if (S.activeId === b.id) S.activeId = null;
  persist();
  await Backend.save(b);
  toast(method === "Cash to Artisan" ? "Booked — pay cash after inspection" : "Payment successful — held in escrow");
  show("history");
}

/* ---------- history ---------- */
async function renderHistory() {
  document.getElementById("backendChip").textContent = LIVE_DB ? "Live Supabase" : "Not connected";
  document.getElementById("histSub").textContent = LIVE_DB ? "Synced jobs" : "Add keys in public/config.js to connect";
  const all = await Backend.list();
  const a = all.find(b => b.id === S.activeId && ["dispatched", "enroute", "arrived", "working"].includes(b.status));
  const box = document.getElementById("activeJobCard");
  box.innerHTML = "";
  if (!LIVE_DB) {
    box.innerHTML = `<div class="bg-white border border-line rounded-2xl shadow-card p-4"><p class="font-display font-extrabold f16">Backend not connected</p><p class="f13 text-ink-soft mt-1">Your bookings will sync here once the app is connected. Add your Supabase URL + anon key and Paystack public key to <span class="font-bold">public/config.js</span>, then reload.</p></div>`;
    const pl = document.getElementById("pastList");
    if (pl) pl.innerHTML = "";
    const ow = document.getElementById("openWrap");
    if (ow) ow.hidden = true;
    return;
  }
  if (a) {
    const t = TECHS[a.serviceId] || { name: "FixHub artisan", phone: "0800349548" };
    const aname = a.tech || t.name;
    const afirst = String(aname).split(" ")[0];
    const d = document.createElement("div");
    d.className = "bg-ink text-white rounded-2xl shadow-card p-4";
    d.innerHTML = `<div class="flex items-center gap-2"><span class="live-dot"></span>
        <p class="font-display font-bold f15 flex-1">${svc(a.serviceId).name} · ${a.id}</p>
        <span class="font-display font-extrabold">${gh(a.total)}</span></div>
      <p class="f13 text-white/80 mt-1">${aname} · ETA ${a.etaMin} min · ${a.date}, ${a.slot}</p>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <button class="bg-white text-ink font-display font-bold f14 rounded-xl py-3 mh50" data-goto="track">Track ${afirst}</button>
        <a href="tel:${t.phone}" class="bg-trust text-white font-display font-bold f14 rounded-xl py-3 mh50 flex items-center justify-center">Call ${afirst}</a>
      </div>`;
    box.appendChild(d);
  }
  await renderOpenMine(all);
  const past = all.filter(b => ["paid", "completed", "cancelled"].includes(b.status));
  const list = document.getElementById("pastList");
  list.innerHTML = "";
  if (!past.length) list.innerHTML = '<p class="f14 text-ink-soft">No completed jobs yet.</p>';
  past.slice(0, 20).forEach(b => {
    const s = svc(b.serviceId) || { name: b.serviceId, tint: "#F1F5F9", color: "#4A5268", icon: "" };
    const tech = b.tech || (TECHS[b.serviceId] ? TECHS[b.serviceId].name : "FixHub artisan");
    const el = document.createElement("div");
    el.className = "bg-white border border-line rounded-2xl shadow-card p-4";
    el.innerHTML = `<div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-full grid place-items-center flex-none" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-5 h-5")}</span>
        <div class="flex-1 min-w-0"><p class="font-display font-bold f15 truncate">${s.name}</p>
        <p class="f12 text-ink-soft">${b.date || ""} · ${gh(b.total || 0)} · ${b.method || "—"}</p>
        <p class="f12 text-ink-soft">${b.status === "cancelled" ? "Cancelled (free)" : "Done by " + tech + " · CID-checked"}</p></div>
        <span class="font-display font-extrabold f15">${gh(b.total || 0)}</span></div>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <button class="rounded-xl border border-line font-bold f13h py-2.5 mh48" data-again="${b.serviceId}">Book Again</button>
        <a href="tel:${TECHS[b.serviceId] ? TECHS[b.serviceId].phone : "0800349548"}" class="rounded-xl bg-trust-tint text-trust-deep font-bold f13h py-2.5 mh48 flex items-center justify-center">Call Again</a>
      </div>`;
    el.querySelector("[data-again]").onclick = (e) => startBooking(e.currentTarget.dataset.again);
    list.appendChild(el);
  });
}
/* ---------- open requests: artisans apply, customer picks ---------- */
async function renderOpenMine(all) {
  const wrap = document.getElementById("openWrap"), box = document.getElementById("openList");
  if (!wrap || !box) return;
  if (!LIVE_DB) { wrap.hidden = true; box.innerHTML = ""; return; }
  const mine = (all || []).filter(b => b.status === "open");
  if (!mine.length) { wrap.hidden = true; box.innerHTML = ""; return; }
  wrap.hidden = false;
  box.innerHTML = "";
  for (const b of mine.slice(0, 10)) {
    const s = svc(b.serviceId) || { name: b.serviceId, tint: "#F1F5F9", color: "#4A5268", icon: "" };
    const el = document.createElement("div");
    el.className = "bg-white border border-line rounded-2xl shadow-card p-4";
    el.innerHTML = `<div class="flex items-center gap-3">
      <span class="w-11 h-11 rounded-full grid place-items-center flex-none" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-5 h-5")}</span>
      <div class="flex-1 min-w-0"><p class="font-display font-bold f15 truncate">${s.name} · ${b.id}</p>
      <p class="f12 text-ink-soft">${b.date || ""} · ${b.slot || ""} · ${gh(b.total || 0)}</p></div>
      <span class="greenpill flex-none">Open</span></div>
      <div class="applicants mt-2 space-y-2"><p class="f12 soft">Checking applications…</p></div>`;
    box.appendChild(el);
    const list = el.querySelector(".applicants");
    let apps = [];
    try { apps = await Backend.applicants(b.id); } catch (e) { apps = []; }
    list.innerHTML = "";
    const pending = (apps || []).filter(x => x.status === "pending")
      .slice().sort((a, b) => ((Number(b.rating) || 0) - (Number(a.rating) || 0)) || ((Number(b.jobs) || 0) - (Number(a.jobs) || 0)));
    if (!pending.length) list.innerHTML = '<p class="f12 soft">No applications yet — artisans nearby have been notified.</p>';
    else list.innerHTML = '<p class="f11 soft">Sorted by rating — highest first</p>';
    pending.forEach((app, idx) => {
      const r = Number(app.rating) || 0;
      const row = document.createElement("div");
      row.className = "rounded-xl p-3 flex items-center gap-2" + "";
      row.style.cssText = "background:#F4F6FA;border:1px solid #E7EBF2";
      row.innerHTML = `<span class="w-10 h-10 rounded-full btn-dark grid place-items-center font-display font-bold text-white flex-none">${escapeHtml(String(app.artisan_name || "A")[0]).toUpperCase()}</span>
        <span class="flex-1 min-w-0"><span class="block font-bold f14 truncate">${idx === 0 ? "★ " : ""}${escapeHtml(app.artisan_name || "Artisan")}</span>
        <span class="block f12 soft">${escapeHtml(app.trade || "General")} · ★ ${r ? r.toFixed(1) : "new"}${app.jobs ? " (" + app.jobs + " fixes)" : ""} · applied</span></span>
        <button class="f12 font-bold text-white rounded-full px-3 py-2 mh44" style="background:#057A55" data-act="accept">Accept</button>
        <button class="f12 font-bold rounded-full px-3 py-2 mh44 border border-line" data-act="decline">Pass</button>`;
      row.querySelector('[data-act="accept"]').onclick = () => acceptApplication(app, b);
      row.querySelector('[data-act="decline"]').onclick = () => declineApplication(app);
      list.appendChild(row);
    });
  }
}
async function acceptApplication(app, b) {
  try {
    await Backend.setApplication(app.id, "accepted");
    b.tech = app.artisan_name; b.techRating = Number(app.rating) || 5.0; b.techJobs = Number(app.jobs) || 0;
    b.status = "enroute"; b.etaMin = 15; b.prog = 0.06; b.offRoute = false; b.step = 1;
    if (S.activeId === b.id || !S.activeId) S.activeId = b.id;
    persist();
    await Backend.save(b);
    toast(String(app.artisan_name).split(" ")[0] + " accepted! Tracking is live");
    renderHistory();
  } catch (e) { toast("Could not accept — check your connection"); }
}
async function declineApplication(app) {
  try {
    await Backend.setApplication(app.id, "declined");
    toast("Application passed");
    renderHistory();
  } catch (e) { toast("Could not update — check your connection"); }
}
/* ---------- AI assistant (Groq live, rule-based fallback) ---------- */
let diagPending = null, diagInit = false;
/* Groq key + instructions live server-side (src/persona.js + .env). */
const DIAG_SERVICE_CHIPS = [
  { label: "Cooling / AC", pick: "hvac", detail: "Cooling system issue" },
  { label: "Water / Pipes", pick: "plumbing", detail: "Leak or pipe-fitting issue" },
  { label: "Power / Wiring", pick: "electrical", detail: "Wiring or socket fault" },
  { label: "Cleaning", pick: "cleaning", detail: "Deep-clean recommended" },
  { label: "Woodwork", pick: "carpentry", detail: "Joinery repair needed" }
];
let groqMsgs = null;
function parseGroq(content) {
  try {
    const m = String(content || "").trim().match(/\{[\s\S]*\}\s*$/);
    if (m) return JSON.parse(m[0]);
  } catch (e) { /* fall through to raw text */ }
  return { reply: String(content || ""), service: null, detail: "" };
}
async function sendDiagServer(text) {
  /* Secure variant: the Groq key lives in the server .env — the browser
     only sends chat text to our own /api/chat. Returns true on answer. */
  if (!groqMsgs) groqMsgs = [];
  groqMsgs.push({ role: "user", content: text });
  const typing = diagTyping();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, 30000);
    let r;
    try {
      r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: groqMsgs.slice(-12) }), signal: ctl.signal });
    } finally { clearTimeout(timer); }
    if (!r.ok) throw new Error("http-" + r.status);
    const p = await r.json();
    groqMsgs.push({ role: "assistant", content: p.reply || "" });
    typing.remove();
    diagBubble(escapeHtml(p.reply || "Hmm?"), "ai");
    if (p.service && svc(p.service)) { showIssue(p.service, p.detail || "Inspection recommended"); }
    else { diagChips(DIAG_SERVICE_CHIPS); }
    return true;
  } catch (e) { typing.remove(); return false; }
}
function matchSymptom(text) {
  const t = (text || "").toLowerCase();
  const has = (...ws) => ws.some(w => t.indexOf(w) !== -1);
  if (has("air condition", "aircon", " a/c", "ac ", "cooling", "not cooling", "isn't cooling", "isnt cooling", "no cold", "airflow", "air flow")) return "hvac";
  if (has("leak", "pipe", "tap", "toilet", "sink", "drain", "tank", "burst", "faucet", "sewage", "water")) return "plumbing";
  if (has("socket", "plug", "wire", "wiring", "spark", "power", "light", "bulb", "switch", "breaker", "shock", "fuse", "voltage", "fan", "fridge", "freezer")) return "electrical";
  if (has("clean", "dirty", "dust", "stain", "mould", "mold", "smell", "cockroach", "paint")) return "cleaning";
  if (has("door", "wood", "furniture", "roof", "lock", "window", "cabinet", "chair", "table", "hinge")) return "carpentry";
  if (has("heat", "hot", "warm")) return "hvac";
  return null;
}
function estRange(id) { const s = svc(id); const hi = Math.round(s.base * 1.6 / 10) * 10; return [s.base, hi]; }
function diagScroll() { const sc = document.getElementById("screens"); sc.scrollTop = sc.scrollHeight; }
function diagBubble(text, who) {
  const box = document.getElementById("diagChat");
  const d = document.createElement("div");
  d.className = who === "user" ? "flex justify-end" : "flex justify-start";
  d.innerHTML = `<div class="${who === "user" ? "bub-user" : "bub-ai"}">${text}</div>`;
  box.appendChild(d); diagScroll();
  return d;
}
function diagChips(items) {
  const row = document.getElementById("diagChips");
  row.innerHTML = "";
  (items || []).forEach(it => {
    const b = document.createElement("button");
    b.className = "chipx" + (it.on ? " on" : "");
    b.textContent = it.label;
    b.onclick = () => sendDiag(it.label, it);
    row.appendChild(b);
  });
}
function diagTyping() {
  const box = document.getElementById("diagChat");
  const d = document.createElement("div");
  d.className = "flex justify-start";
  d.innerHTML = '<div class="bub-ai"><span class="typing"><span></span><span></span><span></span></span></div>';
  box.appendChild(d); diagScroll();
  return d;
}
function renderDiag() {
  if (diagInit) { diagScroll(); return; }
  diagInit = true;
  diagBubble("Hi, I'm your FixHub assistant. Tell me what's wrong and I'll point you to the right CID-checked technician.", "ai");
  diagChips([{ label: "AC not cooling" }, { label: "Leaking pipe" }, { label: "Socket sparks" }]);
}
function startDiagnose(prefill) {
  show("diag");
  if (!diagInit) renderDiag();
  if (prefill) { document.getElementById("diagInput").value = prefill; sendDiag(prefill); }
}
async function sendDiag(text, opt) {
  const input = document.getElementById("diagInput");
  input.value = "";
  diagBubble(escapeHtml(text), "user");
  diagChips([]);
  diagPending = null; if (await sendDiagServer(text)) return;
  const typing = diagTyping();
  await new Promise(r => setTimeout(r, 750));
  typing.remove();
  if (diagPending && diagPending.kind === "airflow") {
    const low = text.toLowerCase();
    const weak = low.indexOf("weak") !== -1 || low.indexOf("not sure") !== -1 || low.indexOf("not") !== -1;
    diagPending = null;
    diagBubble(weak ? "Got it — weak airflow usually means a refrigerant or airflow blockage." : "Good — steady airflow usually points to a thermostat or sensor fault.", "ai");
    showIssue("hvac", weak ? "Airflow or refrigerant-related issue" : "Thermostat or sensor-related issue");
    return;
  }
  if (opt && opt.pick) { showIssue(opt.pick, opt.detail); return; }
  const sid = matchSymptom(text);
  if (!sid) {
    diagBubble("To point you to the right specialist — which area is the problem in?", "ai");
    diagChips(DIAG_SERVICE_CHIPS);
    return;
  }
  if (sid === "hvac") {
    diagBubble("Is that airflow weak or normal?", "ai");
    diagPending = { kind: "airflow" };
    diagChips([{ label: "Normal" }, { label: "Weak" }, { label: "Not sure" }]);
    return;
  }
  const details = {
    plumbing: "Leak or pipe-fitting issue",
    electrical: "Wiring or socket fault",
    cleaning: "Deep-clean recommended",
    carpentry: "Joinery repair needed"
  };
  diagBubble("Thanks — I have what I need.", "ai");
  showIssue(sid, details[sid] || "Inspection recommended");
}
function showIssue(sid, detail) {
  const s = svc(sid);
  const [lo, hi] = estRange(sid);
  const card = document.getElementById("diagIssue");
  card.hidden = false;
  card.innerHTML =
    `<div class="flex items-center gap-2">
      <svg class="w-4 h-4 text-impact-deep flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7z"/></svg>
      <p class="font-display font-extrabold f15">Possible issue detected</p>
    </div>
    <p class="f13 soft mt-1">${detail}</p>
    <button class="mt-3 w-full rounded-2xl p-3.5 flex items-center gap-3 text-left" style="background:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.9)" id="diagSvcBtn">
      <span class="w-10 h-10 rounded-full grid place-items-center flex-none" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-5 h-5")}</span>
      <span class="flex-1 min-w-0"><span class="block f11 soft font-bold">Recommended</span><span class="block font-display font-bold f14 truncate">${s.name} Diagnostic &amp; Repair</span></span>
      <span class="w-9 h-9 rounded-full btn-dark grid place-items-center flex-none"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M8 7h9v9"/></svg></span>
    </button>
    <div class="mt-2 rounded-2xl p-3.5" style="background:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.9)">
      <p class="f11 soft font-bold">Estimated</p>
      <p class="font-display font-extrabold f17">${gh(lo)} - ${gh(hi)}</p>
    </div>
    <p class="f11 soft mt-2 flex items-center gap-1">
      <svg class="w-3.5 h-3.5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
      AI estimate - professional inspection recommended.
    </p>
    <button id="diagFindBtn" class="btn-dark mt-2 w-full font-display font-bold f15 rounded-2xl py-4 mh56">Find a Technician</button>`;
  document.getElementById("diagFindBtn").onclick = () => startBooking(sid);
  document.getElementById("diagSvcBtn").onclick = () => startBooking(sid);
  diagScroll();
}
document.getElementById("diagSend").onclick = () => {
  const t = document.getElementById("diagInput").value.trim();
  if (!t) return;
  sendDiag(t);
};
const DIAG_EXAMPLES = [
  "My AC is running but the room isn't getting cold.",
  "Water is leaking under my kitchen sink.",
  "The bedroom socket sparks when I plug in."
];
let diagExIdx = 0;
document.getElementById("diagPlus").onclick = () => {
  const inp = document.getElementById("diagInput");
  inp.value = DIAG_EXAMPLES[diagExIdx % DIAG_EXAMPLES.length];
  diagExIdx++;
  inp.focus();
};
document.getElementById("diagMic").onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Voice typing isn't supported in this browser — type instead"); return; }
  try {
    const rec = new SR();
    rec.lang = "en-GH"; rec.interimResults = false; rec.maxAlternatives = 1;
    toast("Listening… speak now");
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      const inp = document.getElementById("diagInput");
      inp.value = (inp.value ? inp.value + " " : "") + t;
      inp.focus();
    };
    rec.onerror = () => toast("Couldn't hear that — try again");
    rec.start();
  } catch (e) { toast("Voice typing isn't available right now"); }
};
document.getElementById("diagInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("diagSend").click(); }
});
document.getElementById("diagClear").onclick = () => {
  document.getElementById("diagChat").innerHTML = "";
  document.getElementById("diagIssue").hidden = true;
  document.getElementById("diagIssue").innerHTML = "";
  diagPending = null; diagInit = false; groqMsgs = null;
  renderDiag();
};

/* ---------- services browse + wallet ---------- */
let svcFilter = "all", svcQuery = "";
const SVC_FILTERS = [
  { id: "all", label: "All" },
  { id: "same", label: "Same-day" },
  { id: "top", label: "Top rated" },
  { id: "under100", label: "Under GH₵100" }
];
function svcPasses(s) {
  if (svcFilter === "top" && !(TECHS[s.id] && Number(TECHS[s.id].rating) >= 4.8)) return false;
  if (svcFilter === "under100" && !(s.base < 100)) return false;
  if (svcQuery) {
    const q = svcQuery.toLowerCase();
    if ((s.name + " " + s.blurb).toLowerCase().indexOf(q) === -1) return false;
  }
  return true;
}
function renderServices() {
  const chips = document.getElementById("svcChips");
  chips.innerHTML = "";
  SVC_FILTERS.forEach(f => {
    const b = document.createElement("button");
    b.className = "chipx" + (svcFilter === f.id ? " on" : "");
    b.textContent = f.label;
    b.onclick = () => { svcFilter = f.id; renderServices(); };
    chips.appendChild(b);
  });
  const grid = document.getElementById("svcGrid");
  grid.innerHTML = "";
  const list = SERVICES.filter(svcPasses);
  document.getElementById("svcSub").textContent = list.length + " of " + SERVICES.length + " trades · verified pros nearby";
  if (!list.length) grid.innerHTML = '<p class="emptyNote f14 soft py-6" style="grid-column:1/-1">No matches — try "leak" or "wiring".</p>';
  list.forEach(s => {
    const t = TECHS[s.id];
    const b = document.createElement("button");
    b.className = "glasscard p-4 flex flex-col items-start gap-2 text-left";
    b.innerHTML = `<span class="w-12 h-12 rounded-full grid place-items-center" style="background:${s.tint};color:${s.color}">${svcIcon(s, "w-6 h-6")}</span>
      <span><span class="block font-display font-extrabold f15">${s.name}</span>
      <span class="block f12 soft">from ${gh(s.base)} · ${t ? t.jobs + " fixes" : "verified pro"}</span></span>
      <span class="f12 font-bold uptime">Book now →</span>`;
    b.onclick = () => startBooking(s.id);
    grid.appendChild(b);
  });
}

/* ---------- account: Google login, roles, profile ---------- */
let acctRole = "customer";
function tradeOptions(sel) {
  return SERVICES.map(s => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${s.name}</option>`).join("");
}
function areaOptions(sel) {
  return AREAS.map(a => `<option ${a === sel ? "selected" : ""}>${a}</option>`).join("");
}
function renderAccount() {
  const box = document.getElementById("acctBody");
  if (!box) return;
  const g = Auth.googleUid();
  if (!g || !S.profile) {
    box.innerHTML =
    `<div class="glasscard p-4">
      <p class="font-display font-extrabold f16">I am a…</p>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <button id="roleCustomer" class="rounded-2xl p-3.5 font-bold f14 mh56 border ${acctRole === "customer" ? "btn-dark text-white" : "border-line"}">Customer<br><span class="f11 font-normal opacity-70">Book artisans</span></button>
        <button id="roleArtisan" class="rounded-2xl p-3.5 font-bold f14 mh56 border ${acctRole === "artisan" ? "btn-dark text-white" : "border-line"}">Artisan<br><span class="f11 font-normal opacity-70">Apply for jobs</span></button>
      </div>
      <div id="artisanFields" class="grid grid-cols-2 gap-2 mt-2" ${acctRole === "artisan" ? "" : "hidden"}>
        <select id="acctTrade" class="field rounded-xl p-3 f14">${tradeOptions("plumbing")}</select>
        <select id="acctArea" class="field rounded-xl p-3 f14">${areaOptions(S.homeArea || AREAS[0])}</select>
      </div>
      ${LIVE_DB
        ? '<button id="googleBtn" class="btn-dark mt-3 w-full font-display font-bold f15 rounded-2xl py-4 mh56 flex items-center justify-center gap-2"><svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.7 3-4.3 3-7.5z"/><path fill="#fff" opacity=".8" d="M12 22c2.7 0 5-1 6.6-2.5l-3.2-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.7A10 10 0 0 0 12 22z"/><path fill="#fff" opacity=".8" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.5H3.1a10 10 0 0 0 0 9z"/><path fill="#fff" opacity=".8" d="M12 5.9c1.5 0 2.8.5 3.8 1.5L18.7 4A10 10 0 0 0 3.1 7.5l3.3 2.5c.8-2.3 3-4.1 5.6-4.1z"/></svg> Continue with Google</button>'
        : '<p class="f13 soft mt-3 glasscard p-3">Google login + live bookings + real MoMo payments activate once you add your Supabase + Paystack keys in public/config.js. You can still look around as a guest.</p>'}
      <button class="mt-2 w-full font-bold f14 rounded-2xl py-3.5 mh52 border border-line" data-goto="home">Continue as guest</button>
      <button class="mt-2 w-full font-bold f14 rounded-2xl py-3.5 mh52 border border-line bg-white" data-goto="privacy">Privacy & data safety</button>
      <p class="f11 soft mt-2">Guests can browse the app. Booking and payments go live once the backend keys are added.</p>
    </div>`;
    document.getElementById("roleCustomer").onclick = () => { acctRole = "customer"; renderAccount(); };
    document.getElementById("roleArtisan").onclick = () => { acctRole = "artisan"; renderAccount(); };
    const gb = document.getElementById("googleBtn");
    if (gb) gb.onclick = () => {
      try {
        localStorage.setItem("fixhub_pending_role", JSON.stringify({
          role: acctRole,
          trade: acctRole === "artisan" ? document.getElementById("acctTrade").value : null,
          area: acctRole === "artisan" ? document.getElementById("acctArea").value : null
        }));
      } catch (e) {}
      Auth.loginWithGoogle();
    };
    return;
  }
  const p = S.profile;
  const initial = String(p.name || "F")[0].toUpperCase();
  box.innerHTML =
  `<div class="glasscard p-4 flex items-center gap-3">
    <span class="avatarbtn flex-none" style="width:52px;height:52px">${initial}</span>
    <div class="flex-1 min-w-0"><p class="font-display font-extrabold f16 truncate">${escapeHtml(p.name || "FixHub user")}</p>
    <p class="f12 soft truncate">${Auth.load() && Auth.load().email ? escapeHtml(Auth.load().email) : "Google account"}</p></div>
    <span class="${p.role === "artisan" ? "greenpill" : "chipx on"} flex-none" style="${p.role === "artisan" ? "" : "padding:4px 10px;font-size:11px;border-radius:9999px"}">${p.role === "artisan" ? "Artisan" : "Customer"}</span>
  </div>
  ${p.role === "artisan" ? `<div class="glasscard p-4 mt-3">
    <p class="font-display font-bold f15">My trade</p>
    <div class="grid grid-cols-2 gap-2 mt-2">
      <select id="acctTrade" class="field rounded-xl p-3 f14">${tradeOptions(p.trade || "plumbing")}</select>
      <select id="acctArea" class="field rounded-xl p-3 f14">${areaOptions(p.area || AREAS[0])}</select>
    </div>
    <button id="saveTradeBtn" class="mt-2 w-full btn-dark font-display font-bold f14 rounded-2xl py-3.5 mh52">Save trade</button>
  </div>` : ""}
  <button id="logoutBtn" class="mt-3 w-full font-bold f14 rounded-2xl py-3.5 mh52 border border-red-200 text-cancel bg-white">Log out</button>
  <button class="mt-2 w-full font-bold f14 rounded-2xl py-3.5 mh52 border border-line bg-white" data-goto="privacy">Privacy & data safety</button>`;
  const st = document.getElementById("saveTradeBtn");
  if (st) st.onclick = async () => {
    try {
      await Backend.saveProfile({ trade: document.getElementById("acctTrade").value, area: document.getElementById("acctArea").value });
      toast("Trade updated");
    } catch (e) { toast("Could not save — check your connection"); }
  };
  document.getElementById("logoutBtn").onclick = () => Auth.logout();
}

updateAvatar();
refreshAreaPill();
document.getElementById("privacyBackBtn").onclick = () => show(privacyFrom);
show("home");
try {
  const g = S.homeGeo;
  if (!g || (Date.now() - (g.ts || 0)) > 24 * 3600 * 1000) locateUser({ silent: true });
} catch (e) {}