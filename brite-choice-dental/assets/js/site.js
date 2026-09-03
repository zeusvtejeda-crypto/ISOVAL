/* ═══════════════════════════════════════════════════════════
   BRITE CHOICE DENTAL — site.js
   Header behavior, mobile menu, location switcher, reveal-on-scroll,
   live open/closed status (America/Los_Angeles), nearest-location,
   lightbox gallery, FAQ accordion, appointment form, toasts.
   No dependencies. Progressive enhancement — page works without JS.
═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var DATA = window.__BCD__ || { slug: null, locations: [] };
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts || false); }

  /* ---------- header: scroll shadow + hide-on-scroll-down ---------- */
  (function header() {
    var hdr = $(".hdr");
    if (!hdr) return;
    var lastY = window.scrollY;
    var ticking = false;
    function update() {
      var y = window.scrollY;
      hdr.classList.toggle("is-scrolled", y > 8);
      if (y > lastY && y > 140) hdr.classList.add("is-hidden");
      else hdr.classList.remove("is-hidden");
      lastY = y;
      ticking = false;
    }
    on(window, "scroll", function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();

    // scroll progress bar
    var bar = $(".hdr-progress");
    if (bar) {
      function updateProgress() {
        var h = document.documentElement;
        var max = h.scrollHeight - h.clientHeight;
        var p = max > 0 ? (window.scrollY / max) : 0;
        bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, p)) + ")";
      }
      on(window, "scroll", updateProgress, { passive: true });
      updateProgress();
    }
  })();

  /* ---------- mobile menu ---------- */
  (function mobileMenu() {
    var btn = $(".hamburger");
    var menu = $(".mobile-menu");
    if (!btn || !menu) return;
    on(btn, "click", function () {
      var open = menu.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    $all(".mobile-menu a").forEach(function (a) {
      on(a, "click", function () {
        menu.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  })();

  /* ---------- location switcher (desktop dropdown) ---------- */
  (function locSwitcher() {
    var box = $(".locsw");
    if (!box) return;
    var btn = $(".locsw-btn", box);
    function close() { box.setAttribute("data-open", "false"); }
    function toggle() { box.setAttribute("data-open", box.getAttribute("data-open") === "true" ? "false" : "true"); }
    on(btn, "click", function (e) { e.stopPropagation(); toggle(); });
    on(document, "click", function (e) { if (!box.contains(e.target)) close(); });
    on(document, "keydown", function (e) { if (e.key === "Escape") close(); });
  })();

  /* ---------- reveal on scroll ---------- */
  (function reveal() {
    var els = $all("[data-reveal], .reveal-group");
    if (!els.length) return;
    if (REDUCE || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el, i) {
      if (el.hasAttribute("data-reveal") && !el.style.getPropertyValue("--d")) {
        el.style.setProperty("--d", (Math.min(i % 6, 5) * 0.07) + "s");
      }
      io.observe(el);
    });
  })();

  /* ---------- hero "is-in" trigger (letter/photo animation) ---------- */
  (function heroIn() {
    var hero = $(".hero");
    if (!hero) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add("is-in"); }); });
  })();

  /* ---------- live hours status (America/Los_Angeles) ---------- */
  var HOURS = [
    { open: 9 * 60, close: 18 * 60 },   // Sun=0 closed
    { open: 9 * 60, close: 18 * 60 },   // Mon
    { open: 9 * 60, close: 18 * 60 },   // Tue
    { open: 9 * 60, close: 18 * 60 },   // Wed
    { open: 9 * 60, close: 18 * 60 },   // Thu
    { open: 9 * 60, close: 18 * 60 },   // Fri
    { open: 9 * 60, close: 14 * 60 },   // Sat
  ];
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function nowInLA() {
    try {
      var fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles", hour12: false,
        weekday: "short", hour: "2-digit", minute: "2-digit",
      });
      var parts = fmt.formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[map.weekday];
      var h = parseInt(map.hour, 10) % 24;
      var m = parseInt(map.minute, 10);
      return { day: wd, minutes: h * 60 + m };
    } catch (e) {
      var d = new Date();
      return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function statusFor() {
    var t = nowInLA();
    var today = HOURS[t.day];
    var open = !!today && t.minutes >= today.open && t.minutes < today.close;
    var closesInMin = open ? today.close - t.minutes : null;
    var minutesToOpen = null;
    if (!open) {
      // find next open slot within 7 days
      for (var i = 0; i < 7; i++) {
        var d = (t.day + i) % 7;
        var slot = HOURS[d];
        if (!slot) continue;
        if (i === 0 && t.minutes < slot.open) { minutesToOpen = slot.open - t.minutes; break; }
        if (i > 0) { minutesToOpen = (i * 1440) - t.minutes + slot.open; break; }
      }
    }
    return { open: open, day: t.day, minutes: t.minutes, closesInMin: closesInMin, minutesToOpen: minutesToOpen };
  }

  function fmtHM(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " AM" : " PM");
  }

  function paintStatus() {
    var s = statusFor();
    $all("[data-open-badge]").forEach(function (el) {
      el.classList.toggle("closed", !s.open);
      el.classList.toggle("live", s.open);
      var label = el.querySelector("[data-open-label]") || el;
      if (s.open) {
        label.textContent = "Open now · closes " + fmtHM(s.minutes + s.closesInMin);
      } else {
        label.textContent = "Closed now" + (s.minutesToOpen != null ? " · opens " + fmtHM((s.minutes + s.minutesToOpen) % 1440) : "");
      }
    });
    $all("[data-hours-status]").forEach(function (el) {
      el.textContent = s.open
        ? "● Open now — closes at " + fmtHM(s.minutes + s.closesInMin)
        : "● Closed now" + (s.minutesToOpen != null ? " — opens " + fmtHM((s.minutes + s.minutesToOpen) % 1440) : "");
      el.classList.toggle("is-open", s.open);
      el.classList.toggle("is-closed", !s.open);
    });
    $all("[data-fc-open]").forEach(function (el) { el.classList.toggle("closed", !s.open); });
    var today = s.day;
    $all("[data-hours-table] tr").forEach(function (tr) {
      var d = parseInt(tr.getAttribute("data-day"), 10);
      tr.classList.toggle("today", d === today);
      tr.classList.toggle("closed", d === 0);
    });
  }
  paintStatus();
  setInterval(paintStatus, 60000);

  /* ---------- nearest location (geolocation, optional) ---------- */
  (function nearest() {
    var bar = $("[data-nearest-bar]");
    if (!bar || !DATA.locations || !DATA.locations.length || !("geolocation" in navigator)) return;
    function haversine(a, b) {
      var R = 3958.8, toRad = function (d) { return d * Math.PI / 180; };
      var dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
      var la1 = toRad(a.lat), la2 = toRad(b.lat);
      var h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.asin(Math.sqrt(h));
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      var ranked = DATA.locations.map(function (l) { return { l: l, d: haversine(me, l) }; }).sort(function (a, b) { return a.d - b.d; });
      var nearestLoc = ranked[0];
      if (!nearestLoc) return;
      bar.hidden = false;
      var msg = bar.querySelector("[data-nearest-msg]");
      var link = bar.querySelector("[data-nearest-link]");
      var mi = nearestLoc.d.toFixed(1);
      if (nearestLoc.l.slug === DATA.slug) {
        if (msg) msg.textContent = "You're close to this office (" + mi + " mi).";
        if (link) link.hidden = true;
      } else {
        if (msg) msg.textContent = "Your nearest office is " + nearestLoc.l.name + " (" + mi + " mi).";
        if (link) { link.hidden = false; link.href = "/" + nearestLoc.l.slug + "/"; link.textContent = "Go to " + nearestLoc.l.name + " →"; }
      }
      $all(".loc-card[data-slug]").forEach(function (card) {
        var slug = card.getAttribute("data-slug");
        var item = ranked.filter(function (r) { return r.l.slug === slug; })[0];
        if (!item) return;
        card.classList.add("has-dist");
        card.classList.toggle("is-nearest", item === ranked[0]);
        var distEl = card.querySelector("[data-dist]");
        if (distEl) distEl.textContent = item.d.toFixed(1) + " mi";
      });
    }, function () { /* denied or unavailable — silently skip */ }, { timeout: 6000, maximumAge: 300000 });
  })();

  /* ---------- gallery lightbox ---------- */
  (function lightbox() {
    var links = $all("[data-lightbox]");
    if (!links.length) return;
    var lb = document.createElement("div");
    lb.className = "lb";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.innerHTML =
      '<button class="lb-close" aria-label="Close">' + iconX() + '</button>' +
      '<button class="lb-prev" aria-label="Previous">' + iconChevL() + '</button>' +
      '<img alt="">' +
      '<button class="lb-next" aria-label="Next">' + iconChevR() + '</button>' +
      '<div class="lb-cap"></div>';
    document.body.appendChild(lb);
    var img = $("img", lb), cap = $(".lb-cap", lb);
    var idx = 0, lastFocus = null;

    function openAt(i) {
      idx = (i + links.length) % links.length;
      var a = links[idx];
      img.src = a.getAttribute("href");
      img.alt = a.getAttribute("data-caption") || "";
      cap.textContent = a.getAttribute("data-caption") || "";
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      lb.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    links.forEach(function (a, i) {
      on(a, "click", function (e) { e.preventDefault(); lastFocus = a; openAt(i); });
    });
    on($(".lb-close", lb), "click", close);
    on($(".lb-prev", lb), "click", function () { openAt(idx - 1); });
    on($(".lb-next", lb), "click", function () { openAt(idx + 1); });
    on(lb, "click", function (e) { if (e.target === lb) close(); });
    on(document, "keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") openAt(idx - 1);
      if (e.key === "ArrowRight") openAt(idx + 1);
    });
  })();

  function iconX() { return '<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'; }
  function iconChevL() { return '<svg class="icon" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'; }
  function iconChevR() { return '<svg class="icon" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'; }

  /* ---------- FAQ: close siblings when one opens ---------- */
  (function faq() {
    var items = $all(".faq details");
    items.forEach(function (d) {
      on(d, "toggle", function () {
        if (d.open) items.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  })();

  /* ---------- sticky CTA hide-on-scroll ---------- */
  (function stickyCta() {
    var el = $(".sticky-cta");
    if (!el) return;
    var lastY = window.scrollY;
    on(window, "scroll", function () {
      var y = window.scrollY;
      el.classList.toggle("is-hidden", y > lastY && y > 200);
      lastY = y;
    }, { passive: true });
  })();

  /* ---------- toast ---------- */
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2400);
  }

  /* ---------- click-to-copy phone ---------- */
  (function copyPhone() {
    $all("[data-copy]").forEach(function (el) {
      on(el, "click", function (e) {
        var val = el.getAttribute("data-copy");
        if (!val || !navigator.clipboard) return;
        e.preventDefault();
        navigator.clipboard.writeText(val).then(function () { toast("Phone number copied: " + val); });
      });
    });
  })();

  /* ---------- appointment form ---------- */
  (function appointmentForm() {
    var form = $("#appt-form");
    if (!form) return;
    var card = form.closest(".form-card");
    var office = form.getAttribute("data-office-email") || "office@britechoicedental.com";
    on(form, "submit", function (e) {
      e.preventDefault();
      var name = $("#f-name", form).value.trim();
      var phone = $("#f-phone", form).value.trim();
      var service = $("#f-service", form).value;
      var day = $("#f-day", form).value;
      var loc = form.getAttribute("data-location") || "";
      var subject = "Appointment Request" + (loc ? " — " + loc : "");
      var body = "Name: " + name + "\nPhone: " + phone + "\nService: " + service +
        (day ? "\nPreferred day: " + day : "") + (loc ? "\nOffice: " + loc : "");
      var mailto = "mailto:" + office + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      var win = window.open(mailto, "_blank");
      if (!win) window.location.href = mailto;
      if (card) card.classList.add("is-sent");
      form.reset();
    });
  })();

  /* ---------- footer year ---------- */
  $all("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

})();
