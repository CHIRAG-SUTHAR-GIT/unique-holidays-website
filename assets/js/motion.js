/* Unique Holidays — motion layer.
   Intro loader, left-hand scroll meter, word-mask headline reveals,
   scroll-linked parallax, a sticky-pinned horizontal gallery and the
   day/night visual state. Vanilla ES2017, no libraries. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* ==================================================== day / night state == */
  var THEME_KEY = "uh-theme";
  function readTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function applyTheme(mode) {
    if (mode === "night") doc.setAttribute("data-theme", "night");
    else doc.removeAttribute("data-theme");
    $$(".theme-toggle").forEach(function (b) {
      b.setAttribute("aria-pressed", String(mode === "night"));
      b.setAttribute("aria-label", mode === "night" ? "Switch to day mode" : "Switch to night mode");
    });
  }
  applyTheme(readTheme() === "night" ? "night" : "day");

  $$(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = doc.getAttribute("data-theme") === "night" ? "day" : "night";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  });

  /* ============================================================== splitter == */
  function splitWords(root) {
    if (!root || root.dataset.split === "done") return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      if (!node.textContent.trim()) return;
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var w = document.createElement("span");
        w.className = "uh-word";
        var i = document.createElement("i");
        i.textContent = part;
        w.appendChild(i);
        frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    $$(".uh-word > i", root).forEach(function (el, k) {
      el.style.transitionDelay = (k * 55) + "ms";
    });
    root.classList.add("uh-split");
    root.dataset.split = "done";
  }

  if (!reduced) $$("[data-split]").forEach(splitWords);

  /* =============================================================== reveals == */
  var revealObserver = null;
  function startReveals() {
    var targets = $$("[data-anim], [data-split], .uh-frame");
    if (!targets.length) return;

    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    // stagger children of any [data-stagger] container
    $$("[data-stagger]").forEach(function (group) {
      var step = parseInt(group.getAttribute("data-stagger"), 10) || 90;
      $$("[data-anim]", group).forEach(function (el, i) {
        if (!el.style.transitionDelay) el.style.transitionDelay = (i * step) + "ms";
      });
    });
    $$("[data-anim-delay]").forEach(function (el) {
      el.style.transitionDelay = el.getAttribute("data-anim-delay") + "ms";
    });

    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        revealObserver.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.01 });

    targets.forEach(function (el) { revealObserver.observe(el); });

    // Safety net. A fast flick can outrun IntersectionObserver's sampling, and a
    // section that never gets its class stays invisible for good. So once
    // scrolling settles, sweep anything on screen that is still hidden. This
    // also covers main.js's plain .reveal elements, which have the same risk.
    pending = targets.map(function (el) { return { el: el, cls: "is-in" }; })
      .concat($$(".reveal").map(function (el) { return { el: el, cls: "is-visible" }; }));
    scheduleSweep();
  }

  var pending = [];
  var sweepTimer = null;
  function sweep() {
    if (!pending.length) return;
    var vh = window.innerHeight;
    pending = pending.filter(function (item) {
      if (item.el.classList.contains(item.cls)) return false;
      var r = item.el.getBoundingClientRect();
      if (r.height && r.top < vh * 1.1 && r.bottom > -vh * 0.1) {
        item.el.classList.add(item.cls);
        return false;
      }
      return true;
    });
  }
  function scheduleSweep() {
    if (!pending.length) return;
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(sweep, 220);
  }

  /* ========================================================= scroll engine == */
  var meterNum  = $("#uhMeterNum");
  var meterFill = $("#uhMeterFill");
  var parallax  = [];
  var hscrolls  = [];
  var ticking = false;

  function collect() {
    parallax = $$("[data-parallax]").map(function (el) {
      return { el: el, speed: parseFloat(el.getAttribute("data-parallax")) || 0.1 };
    });
  }

  function measureAll() {
    hscrolls.forEach(function (h) { h.measure(); });
  }

  function onFrame() {
    ticking = false;
    var vh = window.innerHeight;

    // left-hand scroll percentage
    if (meterNum) {
      var max = document.body.scrollHeight - vh;
      var pct = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      var shown = Math.round(pct * 100);
      meterNum.textContent = (shown < 10 ? "0" : "") + shown;
      if (meterFill) meterFill.style.height = (pct * 100) + "%";
    }

    if (!reduced) {
      parallax.forEach(function (p) {
        var r = p.el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var prog = (vh - r.top) / (vh + r.height);   // 0 entering -> 1 leaving
        p.el.style.transform = "translate3d(0," + ((prog - 0.5) * p.speed * -160).toFixed(2) + "px,0)";
      });
    }

    updateProgress();
    hscrolls.forEach(function (h) { h.update(); });
    scheduleSweep();
  }

  function requestFrame() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onFrame);
  }

  /* ------------------------------------ progress publisher for pinned bits -- */
  var progressEls = [];
  function collectProgress() {
    progressEls = $$("[data-progress]");
  }
  function updateProgress() {
    var vh = window.innerHeight;
    progressEls.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      var total = el.offsetHeight - vh;
      var p = total > 0 ? clamp(-rect.top / total, 0, 1) : clamp((vh - rect.top) / (vh + rect.height), 0, 1);
      el.style.setProperty("--p", p.toFixed(4));
    });
  }

  /* ------------------------------------------- pinned horizontal gallery -- */
  function initHScroll(section) {
    var track = $(".hscroll__track", section);
    var fill  = $(".hscroll__progress span", section);
    if (!track) return null;
    var distance = 0;

    function measure() {
      var stack = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (stack) { section.style.height = ""; track.style.transform = ""; distance = 0; return; }
      distance = Math.max(0, track.scrollWidth - window.innerWidth);
      // vertical scroll distance == horizontal travel, plus one screen of pin
      section.style.height = (window.innerHeight + distance) + "px";
    }
    function update() {
      if (!distance) return;
      var rect = section.getBoundingClientRect();
      var total = section.offsetHeight - window.innerHeight;
      var p = total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
      track.style.transform = "translate3d(" + (-distance * p).toFixed(2) + "px,0,0)";
      if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    }
    measure();
    return { measure: measure, update: update };
  }

  $$("[data-hscroll]").forEach(function (sec) {
    var h = initHScroll(sec);
    if (h) hscrolls.push(h);
  });

  collect();
  collectProgress();
  window.addEventListener("scroll", requestFrame, { passive: true });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { measureAll(); requestFrame(); }, 140);
  });
  window.addEventListener("load", function () { measureAll(); requestFrame(); });

  /* ==================================================== page transitions == */
  /* Fade out before an internal navigation so the next page's curtain picks up
     from black rather than from a white flash. */
  if (!reduced) {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var url;
      try { url = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / anchor
      if (!/\.html?$|\/$/.test(url.pathname)) return;
      e.preventDefault();
      doc.classList.add("uh-leaving");
      setTimeout(function () { location.href = url.href; }, 300);
    });
    // a bfcache restore must never leave the page faded out
    window.addEventListener("pageshow", function () { doc.classList.remove("uh-leaving"); });
  }

  /* ================================================================ loader == */
  function finish() {
    doc.classList.remove("uh-loading");
    doc.classList.add("is-ready");
    startReveals();
    measureAll();
    requestFrame();
  }

  var loader = $("#uhLoader");
  if (!loader || reduced) {
    if (loader) loader.parentNode.removeChild(loader);
    finish();
    return;
  }

  var SEEN = "uh-seen";
  var seen = false;
  try { seen = sessionStorage.getItem(SEEN) === "1"; } catch (e) {}
  var duration = seen ? 520 : 1650;

  var countEl = $("#uhCount");
  var barEl   = $("#uhBar");
  var start = null;

  function step(ts) {
    if (start === null) start = ts;
    var p = clamp((ts - start) / duration, 0, 1);
    var eased = 1 - Math.pow(1 - p, 2.2);
    var val = Math.round(eased * 100);
    if (countEl) countEl.textContent = val < 10 ? "0" + val : String(val);
    if (barEl) barEl.style.width = (eased * 100) + "%";
    if (p < 1) { requestAnimationFrame(step); return; }

    try { sessionStorage.setItem(SEEN, "1"); } catch (e) {}
    loader.classList.add("is-done");
    setTimeout(function () { loader.classList.add("is-open"); }, 330);
    setTimeout(finish, 560);
    setTimeout(function () {
      loader.classList.add("is-gone");
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 1500);
  }
  requestAnimationFrame(step);

  // never leave the page locked if something goes wrong
  setTimeout(function () {
    if (doc.classList.contains("uh-loading")) finish();
  }, 6000);
})();
