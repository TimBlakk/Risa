(() => {
  const NUMBER = "233241280476";            // WhatsApp number, international format, no + or spaces
  const OPEN_DAYS = [5, 6, 0];              // Fri, Sat, Sun (0 = Sunday)
  const OPEN_MIN = 12 * 60, CLOSE_MIN = 20 * 60;
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  /* WhatsApp links: pre-fill the message with the category and spice level */
  const heatInputs = document.querySelectorAll('input[name="heat"]');
  const waLinks = document.querySelectorAll("[data-wa]");
  function updateLinks() {
    const heat = document.querySelector('input[name="heat"]:checked').value;
    document.body.dataset.heat = heat.toLowerCase();
    waLinks.forEach(a => {
      const cat = a.dataset.wa;
      const msg = cat
        ? `Hi RISA, I’d like to order from ${cat}. Spice level: ${heat}.`
        : "Hi RISA, I’d like to place an order.";
      a.href = `https://wa.me/${NUMBER}?text=${encodeURIComponent(msg)}`;
      a.target = "_blank"; a.rel = "noopener";
    });
  }
  heatInputs.forEach(i => i.addEventListener("change", updateLinks));
  updateLinks();

  /* Open / closed badge, always calculated in Ghana time */
  function updateStatus() {
    const el = document.getElementById("status");
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Accra", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23"
      }).formatToParts(new Date()).map(x => [x.type, x.value]));
      const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday);
      const mins = (+p.hour) * 60 + (+p.minute);
      const openToday = OPEN_DAYS.includes(day);
      el.className = "status";
      if (openToday && mins >= OPEN_MIN && mins < CLOSE_MIN) { el.classList.add("open"); el.textContent = "Open now, delivering until 8pm"; }
      else if (openToday && mins < OPEN_MIN) { el.textContent = "Opens today at 12pm"; }
      else {
        let n = 1; while (!OPEN_DAYS.includes((day + n) % 7)) n++;
        el.textContent = "Opens " + (n === 1 ? "tomorrow" : DAY_NAMES[(day + n) % 7]) + " at 12pm";
      }
    } catch (e) { el.textContent = "Friday to Sunday, 12pm to 8pm"; }
  }
  updateStatus(); setInterval(updateStatus, 60000);


  /* Menu tabs: arrow keys, sliding indicator, fade between panels */
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(t => document.getElementById(t.getAttribute("aria-controls")));
  const list = document.querySelector(".tablist");
  const ind = document.querySelector(".tab-ind");
  let current = 0, busy = false, pending = null;

  function moveIndicator(smooth) {
    const t = tabs[current];
    ind.style.setProperty("--x", t.offsetLeft + "px");
    ind.style.setProperty("--w", t.offsetWidth + "px");
    list.scrollTo({ left: t.offsetLeft - (list.clientWidth - t.offsetWidth) / 2, behavior: smooth && !reduced ? "smooth" : "auto" });
  }
  function keepInView() {
    const top = panels[current].getBoundingClientRect().top;
    if (top < 140) scrollBy({ top: top - 150, behavior: reduced ? "auto" : "smooth" });
  }
  function select(i, focus) {
    if (busy) { pending = i; return; }
    if (focus) tabs[i].focus();
    if (i === current) return;
    const out = panels[current], inn = panels[i];
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", k === i); t.tabIndex = k === i ? 0 : -1; });
    current = i; moveIndicator(true);
    const show = () => {
      out.classList.remove("is-active", "is-leaving");
      inn.classList.add("is-active");
      if (!reduced) { inn.classList.add("is-entering"); inn.offsetHeight; requestAnimationFrame(() => inn.classList.remove("is-entering")); }
      busy = false; keepInView();
      if (pending !== null && pending !== current) { const n = pending; pending = null; select(n); } else pending = null;
    };
    if (reduced) { show(); return; }
    busy = true; out.classList.add("is-leaving"); setTimeout(show, 230);
  }
  tabs.forEach((t, i) => t.addEventListener("click", () => select(i)));
  list.addEventListener("keydown", e => {
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    let n = null;
    if (e.key in keys) n = (current + keys[e.key] + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0; else if (e.key === "End") n = tabs.length - 1;
    if (n !== null) { e.preventDefault(); select(n, true); }
  });
  addEventListener("resize", () => moveIndicator(false));
  document.fonts && document.fonts.ready.then(() => moveIndicator(false));
  moveIndicator(false);
  /* Load the photos of hidden tabs once the page is ready, so switching never waits */
  addEventListener("load", () => document.querySelectorAll(".panel img[loading=lazy]").forEach(i => { i.loading = "eager"; }));

  /* Gentle parallax on menu photos (skipped for reduced motion) */
  if (!reduced) {
    const shots = [...document.querySelectorAll(".shot")];
    let ticking = false;
    const run = () => {
      const vh = innerHeight;
      shots.forEach(s => {
        const r = s.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > vh) return;
        s.style.setProperty("--p", ((r.top + r.height / 2) / vh - 0.5).toFixed(3));
      });
      ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }

  /* Order cart: build an order, then send it to WhatsApp */
  const money = n => "GHS " + n.toLocaleString("en-GB");
  const SPICES = ["Mild", "Spicy", "Hot"];
  const heatNow = () => document.querySelector('input[name="heat"]:checked').value;
  const catalog = new Map();   // read from the menu HTML, so prices are edited in one place only
  document.querySelectorAll(".prices li").forEach(li => {
    const prefix = li.closest("[data-prefix]")?.dataset.prefix;
    const label = li.querySelector("span").textContent.trim();
    const key = prefix ? `${prefix}, ${label}` : label;
    catalog.set(key, { price: parseInt(li.querySelector("b").textContent.replace(/\D/g, ""), 10), spice: !!li.closest("[data-spice]") });
    li.classList.add("has-add");
    const b = document.createElement("button");
    b.type = "button"; b.className = "add"; b.dataset.key = key;
    b.innerHTML = '<span aria-hidden="true">+</span><i class="badge" aria-hidden="true"></i>';
    li.append(b);
  });

  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem("risa-cart") || "[]")
      .filter(l => catalog.has(l.key) && l.qty > 0)
      .map(l => ({ key: l.key, qty: l.qty | 0, spice: catalog.get(l.key).spice ? (SPICES.includes(l.spice) ? l.spice : "Mild") : null }));
  } catch (e) { cart = []; }

  const dlg = document.getElementById("cart"), listEl = document.getElementById("cart-list");
  const sendEl = document.getElementById("cart-send"), notesEl = document.getElementById("cart-notes");
  const closeBtn = dlg.querySelector(".x"), live = document.getElementById("live");
  const count = () => cart.reduce((s, l) => s + l.qty, 0);
  const total = () => cart.reduce((s, l) => s + catalog.get(l.key).price * l.qty, 0);
  const announce = t => { live.textContent = ""; setTimeout(() => { live.textContent = t; }, 50); };
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

  function waUrl() {
    const lines = cart.map(l => `• ${l.qty} × ${l.key}${l.spice ? ` (${l.spice})` : ""} – ${money(catalog.get(l.key).price * l.qty)}`);
    const notes = notesEl.value.trim();
    const msg = ["Hi RISA, I’d like to order:", ...lines, "", `Subtotal: ${money(total())} (delivery fee not included)`, ...(notes ? ["", `Notes: ${notes}`] : [])].join("\n");
    return `https://wa.me/${NUMBER}?text=${encodeURIComponent(msg)}`;
  }
  function ctl(text, label, i, act, fn, cls) {
    const b = mk("button", cls, text); b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    b.dataset.i = i; b.dataset.act = act;
    b.addEventListener("click", () => { fn(); update(); (listEl.querySelector(`[data-i="${i}"][data-act="${act}"]`) || closeBtn).focus(); });
    return b;
  }
  const bump = (i, d) => { cart[i].qty += d; if (cart[i].qty <= 0) cart.splice(i, 1); };
  function setSpice(i, s) {
    const l = cart[i]; l.spice = s;
    const dup = cart.findIndex((x, k) => k !== i && x.key === l.key && x.spice === s);
    if (dup > -1) { cart[dup].qty += l.qty; cart.splice(i, 1); }
  }
  function render() {
    listEl.replaceChildren();
    cart.forEach((l, i) => {
      const it = catalog.get(l.key), li = mk("li", "line"), top = mk("div", "line-top"), info = mk("div", "line-info"), step = mk("div", "step");
      info.append(mk("strong", "", l.key), mk("span", "", `${money(it.price)} each`));
      step.append(ctl("−", `Remove one ${l.key}`, i, "minus", () => bump(i, -1)), mk("output", "", String(l.qty)), ctl("+", `Add one ${l.key}`, i, "plus", () => bump(i, 1)));
      top.append(info, step); li.append(top);
      if (it.spice) {
        const seg = mk("div", "seg"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", `Spice level for ${l.key}`);
        SPICES.forEach(s => { const b = ctl(s, "", i, "s" + s, () => setSpice(i, s)); b.setAttribute("aria-pressed", String(s === l.spice)); seg.append(b); });
        li.append(seg);
      }
      listEl.append(li);
    });
    document.getElementById("cart-empty").hidden = cart.length > 0;
    document.getElementById("cart-total").textContent = money(total());
    sendEl.setAttribute("aria-disabled", String(!cart.length));
    sendEl.href = cart.length ? waUrl() : "#";
  }
  function update() {
    try { localStorage.setItem("risa-cart", JSON.stringify(cart)); } catch (e) {}
    document.querySelectorAll(".add").forEach(b => {
      const n = cart.filter(l => l.key === b.dataset.key).reduce((s, l) => s + l.qty, 0);
      b.querySelector(".badge").textContent = n || "";
      b.classList.toggle("on", n > 0);
      b.setAttribute("aria-label", `Add ${b.dataset.key} to your order${n ? `, ${n} in your order` : ""}`);
    });
    const n = count();
    document.querySelectorAll(".cart-trigger").forEach(a => {
      a.textContent = "dock" in a.dataset ? (n ? `View order · ${money(total())}` : "Order on WhatsApp") : (n ? `Order (${n})` : "WhatsApp");
    });
    render();
  }
  const openCart = () => { if (!dlg.open) dlg.showModal(); };
  const closeCart = () => {
    if (!dlg.open) return;
    dlg.classList.add("closing");
    setTimeout(() => { dlg.classList.remove("closing"); dlg.close(); }, reduced ? 0 : 200);
  };

  document.addEventListener("click", e => {
    const b = e.target.closest(".add");
    if (b) {
      const key = b.dataset.key, spice = catalog.get(key).spice ? heatNow() : null;
      const line = cart.find(l => l.key === key && l.spice === spice);
      line ? line.qty++ : cart.push({ key, spice, qty: 1 });
      update(); announce(`Added ${key}. ${count()} in your order.`);
      b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
      return;
    }
    const t = e.target.closest(".cart-trigger");
    if (t && count()) { e.preventDefault(); openCart(); }
  });
  closeBtn.addEventListener("click", closeCart);
  dlg.addEventListener("click", e => { if (e.target === dlg) closeCart(); });
  document.getElementById("cart-clear").addEventListener("click", () => { cart = []; update(); closeBtn.focus(); });
  sendEl.addEventListener("click", e => { if (!cart.length) e.preventDefault(); });
  notesEl.addEventListener("input", () => { if (cart.length) sendEl.href = waUrl(); });
  update();
})();
