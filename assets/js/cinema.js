/* Unique Holidays — cinematic homepage engine.
   Arch intro, scroll-scrubbed scenes and text reveals for index.html.
   Vanilla ES2017, no libraries. Only runs on <body class="cx">. */
(function () {
  "use strict";

  var body = document.body;
  if (!body || !body.classList.contains("cx")) return;

  var doc = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BREAK = 992;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };
  var seg   = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };

  /* ------------------------------------------------------------ easing -- */
  function bezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    var sx = function (t) { return ((ax * t + bx) * t + cx) * t; };
    var sy = function (t) { return ((ay * t + by) * t + cy) * t; };
    var dx = function (t) { return (3 * ax * t + 2 * bx) * t + cx; };
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x, i, d;
      for (i = 0; i < 8; i++) {
        d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= (sx(t) - x) / d;
      }
      if (t < 0 || t > 1 || Math.abs(sx(t) - x) > 1e-4) {
        var lo = 0, hi = 1;
        t = x;
        for (i = 0; i < 40; i++) {
          if (sx(t) < x) lo = t; else hi = t;
          t = (lo + hi) / 2;
        }
      }
      return sy(t);
    };
  }
  var ease = {
    out:   bezier(.25, 1, .5, 1),
    inOut: bezier(.75, 0, .25, 1),
    inn:   bezier(.5, 0, .75, 0),
    std:   bezier(.25, .1, .25, 1),
    dive:  bezier(.6, 0, 0, 1),
    glide: bezier(.25, 0, .75, 1)
  };

  /* ---------------------------------------------------------- viewport -- */
  var vw = 0, vh = 0, y = 0, desk = false;
  function readViewport() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    desk = vw >= BREAK;
  }
  readViewport();
  function absTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

  /* ============================================================ splitting == */
  function splitChars(el) {
    if (el.__cxChars) return;
    el.__cxChars = true;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n, i = 0;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      if (!node.textContent.trim()) return;
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        var word = document.createElement("span");
        word.className = "cx-w";
        Array.from(part).forEach(function (ch) {
          var c = document.createElement("span");
          c.className = "cx-c";
          c.textContent = ch;
          c.style.setProperty("--i", i++);
          word.appendChild(c);
        });
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* Lines are measured, so this re-runs whenever the width changes. */
  function splitLines(el) {
    if (el.__cxHTML == null) el.__cxHTML = el.innerHTML;
    else el.innerHTML = el.__cxHTML;

    var tokens = [];
    (function walk(node, wrap) {
      Array.prototype.forEach.call(node.childNodes, function (ch) {
        if (ch.nodeType === 3) {
          ch.textContent.split(/\s+/).forEach(function (w) { if (w) tokens.push({ text: w, wrap: wrap }); });
        } else if (ch.nodeName === "BR") {
          tokens.push({ br: true });
        } else if (ch.nodeType === 1) {
          walk(ch, ch);
        }
      });
    })(el, null);

    el.innerHTML = "";
    var items = [];
    tokens.forEach(function (tok) {
      if (tok.br) { el.appendChild(document.createElement("br")); items.push(null); return; }
      var w = tok.wrap ? tok.wrap.cloneNode(false) : document.createElement("span");
      w.textContent = tok.text;
      w.style.display = "inline-block";
      el.appendChild(w);
      el.appendChild(document.createTextNode(" "));
      items.push(w);
    });

    var lines = [], cur = null, lastTop = null;
    items.forEach(function (w) {
      if (!w) { cur = null; return; }
      var top = w.offsetTop;
      if (!cur || Math.abs(top - lastTop) > 3) { cur = []; lines.push(cur); lastTop = top; }
      cur.push(w);
    });

    el.innerHTML = "";
    lines.forEach(function (words, i) {
      var line = document.createElement("span");
      line.className = "cx-l";
      var inner = document.createElement("span");
      inner.className = "cx-li";
      inner.style.setProperty("--i", i);
      words.forEach(function (w, k) {
        w.style.display = "";
        if (k) inner.appendChild(document.createTextNode(" "));
        inner.appendChild(w);
      });
      line.appendChild(inner);
      el.appendChild(line);
    });
  }

  function typeOf(el) { return el.getAttribute("data-cx") || el.getAttribute("data-cx-part"); }
  function prepare(el) {
    var t = typeOf(el);
    if (t === "h" || t === "a") splitChars(el);
    else if (t === "p") splitLines(el);
  }
  function show(el, delay) {
    if (delay != null) el.style.setProperty("--cx-d", delay + "s");
    el.classList.remove("is-out");
    el.classList.add("is-in");
  }
  function hide(el) {
    if (!el.classList.contains("is-in")) return;
    el.classList.remove("is-in");
    el.classList.add("is-out");
  }
  function showAll(list, base) {
    var counts = {};
    list.forEach(function (el) {
      var t = typeOf(el);
      counts[t] = counts[t] || 0;
      show(el, (base == null ? .3 : base) + counts[t] * .1);
      counts[t]++;
    });
  }

  /* ============================================================= reveals == */
  var revealEls = [];
  function initReveals() {
    revealEls = $$("[data-cx]").filter(function (el) { return !el.closest("[data-cx-manual]"); });
    $$("[data-cx]").forEach(prepare);

    var groups = new Map();
    revealEls.forEach(function (el) {
      var g = el.closest("[data-cx-group]") || el;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(el);
    });
    groups.forEach(function (list) {
      var counts = {};
      list.forEach(function (el) {
        var t = typeOf(el);
        counts[t] = counts[t] || 0;
        var d = el.hasAttribute("data-cx-delay") ? parseFloat(el.getAttribute("data-cx-delay")) : .3 + counts[t] * .1;
        el.style.setProperty("--cx-d", d + "s");
        counts[t]++;
      });
    });

    var draws = $$("[data-cx-draw]");
    draws.forEach(function (map) {
      $$(".cx-pin, .cx-stop", map).forEach(function (pin, i) { pin.style.setProperty("--i", i); });
    });

    if (reduced || !("IntersectionObserver" in window)) {
      revealEls.concat(draws).forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var list = groups.get(e.target);
        if (list) list.forEach(function (el) { el.classList.add("is-in"); });
        else e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    groups.forEach(function (list, g) { io.observe(g); });
    draws.forEach(function (d) { io.observe(d); });
  }

  /* ========================================================= scroll loop == */
  var scenes = [];
  var busy = false, running = false, last = 0;

  function Follow(lag) { this.lag = lag; this.v = null; }
  Follow.prototype.step = function (target, dt) {
    if (this.v === null || !this.lag || reduced) { this.v = target; return target; }
    this.v += (target - this.v) * (1 - Math.exp(-dt / this.lag));
    if (Math.abs(target - this.v) < .0002) this.v = target;
    else busy = true;
    return this.v;
  };
  Follow.prototype.snap = function () { this.v = null; };

  function measureAll() {
    readViewport();
    scenes.forEach(function (s) { s.measure(); });
  }
  function tick(now) {
    var dt = Math.min(.1, (now - last) / 1000) || .016;
    last = now;
    busy = false;
    y = window.scrollY;
    scenes.forEach(function (s) { s.update(dt); });
    if (busy) requestAnimationFrame(tick);
    else running = false;
  }
  function kick() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------- hero -- */
  function heroScene() {
    var sec = $("#cxHero");
    if (!sec) return null;
    var bg = $(".cx-hero__bg", sec), zoom = $(".cx-hero__zoom", sec);
    var content = $(".cx-hero__content", sec);
    var deco = $(".cx-hero__deco", sec);
    var meter = $(".uh-meter");
    var top = 0, dist = 1, bgH = 0, f = new Follow(0);

    return {
      measure: function () {
        top = absTop(sec);
        dist = Math.max(1, sec.offsetHeight - vh);
        bgH = bg.offsetHeight;
      },
      update: function (dt) {
        if (y > top + dist + vh * 1.5 && f.v === 1) return;
        var p = f.step(clamp((y - top) / dist, 0, 1), dt);
        if (reduced) return;
        if (desk) {
          var m = ease.std(seg(p, 0, .6));
          content.style.transform = "translate3d(0," + (-(1.25 * bgH - vh) * m).toFixed(1) + "px,0)";
          bg.style.transform = "translate3d(0," + (-(bgH - vh) * m).toFixed(1) + "px,0)";
          zoom.style.transform = "scale(" + (1 + ease.inn(seg(p, .4, 1))).toFixed(4) + ")";
        } else {
          content.style.transform = "";
          bg.style.transform = "";
          zoom.style.transform = "scale(" + (1 + ease.inn(p)).toFixed(4) + ")";
        }
        /* the socials and the reel link clear out before the
           picture starts travelling up the screen */
        if (deco) deco.style.opacity = (1 - seg(p, .05, .45)).toFixed(3);
        if (meter) meter.classList.toggle("is-off", p < .1);
      }
    };
  }

  /* ---------------------------------------------------------- journey -- */
  function journeyScene() {
    var sec = $("#cxJourney");
    if (!sec) return null;
    var track = $(".cx-journey__track", sec);
    var top = 0, H = 0, travel = 0, pinned = false;
    var f = new Follow(.07);
    return {
      measure: function () {
        sec.style.height = "";
        track.style.transform = "";
        pinned = desk && !reduced;
        if (pinned) {
          var w = track.scrollWidth;
          travel = Math.max(0, w - vw);
          H = Math.max(w, vh + travel);
          sec.style.height = H + "px";
        }
        top = absTop(sec);
        f.snap();
      },
      update: function (dt) {
        if (reduced || !pinned) return;
        var a = top + .025 * H, b = top + .975 * H - vh;
        var p = f.step(clamp((y - a) / Math.max(1, b - a), 0, 1), dt);
        track.style.transform = "translate3d(" + (-travel * ease.glide(p)).toFixed(1) + "px,0,0)";
      }
    };
  }

  /* ------------------------------------------------------------ vista -- */
  function vistaScene() {
    var sec = $("#cxVista");
    if (!sec) return null;
    var media = $(".cx-vista__media", sec), clouds = $(".cx-vista__clouds", sec), card = $(".cx-vista__card", sec);
    var top = 0, h = 1, sideways = false, f = new Follow(.07);
    return {
      measure: function () { top = absTop(sec); h = sec.offsetHeight; sideways = desk && !reduced; f.snap(); },
      update: function (dt) {
        if (reduced) return;
        var q;
        if (sideways) {
          /* It is the last panel of the horizontal run: it slides in from the
             right, so its own left edge is the progress. */
          var r = sec.getBoundingClientRect();
          if (r.right <= 0 || r.left >= vw) return;
          q = clamp(1 - r.left / vw, 0, 1);
        } else {
          if (y < top - vh * 1.2 || y > top + h + vh * .2) return;
          q = clamp((y - (top - vh)) / h, 0, 1);
        }
        var p = f.step(q, dt);
        media.style.transform = "scale(" + (1.15 - .15 * ease.std(p)).toFixed(4) + ")";
        if (clouds) clouds.style.transform = "translate3d(0," + (-p * 34).toFixed(2) + "vh,0)";
        if (card) {
          var c = seg(p, .5, 1);
          card.style.opacity = c.toFixed(3);
          card.style.transform = "translateX(-50%) scale(" + (.75 + .25 * c).toFixed(4) + ")";
          if (c > .15) showAll($$("[data-cx]", card), .05);
          else if (c === 0) $$("[data-cx]", card).forEach(hide);
        }
      }
    };
  }

  /* ------------------------------------------------------------ footer -- */
  /* This used to be finaleScene, which drove the "Evenings by the sea" panel
     and the footer together and bailed out if either was missing. That panel
     is gone, so the footer half stands on its own — otherwise the footer text,
     which is marked data-cx-manual and is revealed from here and nowhere else,
     would never appear at all. */
  function footerScene() {
    var footer = $("#cxFooter");
    if (!footer) return null;
    var main = $(".cx-footer__main", footer);
    if (!main) return null;
    var footText = $$("[data-cx]", footer);
    var fTop = 0, fH = 1, f = new Follow(.08), shown = false;
    return {
      measure: function () { fTop = absTop(footer); fH = footer.offsetHeight; f.snap(); },
      update: function (dt) {
        if (reduced) return;
        var a = fTop - .3 * vh, b = Math.max(a + 1, fTop + fH - vh);
        var p = f.step(clamp((y - a) / (b - a), 0, 1), dt);
        main.style.opacity = p.toFixed(3);
        main.style.transform = "scale(" + (.75 + .25 * p).toFixed(4) + ")";
        if (y >= a && !shown) { shown = true; showAll(footText, .1); }
        else if (y < a - 2 && shown) { shown = false; footText.forEach(hide); }
      }
    };
  }

  /* --------------------------------------------------------- drifters -- */
  function driftScene() {
    var items = $$("[data-cx-drift]").map(function (el) {
      return { el: el, amt: parseFloat(el.getAttribute("data-cx-drift")) || 10, rot: el.getAttribute("data-cx-rot") || "", box: el.offsetParent || el.parentElement };
    });
    if (!items.length) return null;
    return {
      measure: function () {},
      update: function () {
        if (reduced) return;
        items.forEach(function (it) {
          var r = it.box.getBoundingClientRect();
          if (r.bottom < -vh * .2 || r.top > vh * 1.2) return;
          var p = clamp((vh - r.top) / (vh + r.height), 0, 1);
          it.el.style.transform = "translate3d(0," + lerp(-it.amt, it.amt, p).toFixed(2) + "%,0)" + (it.rot ? " rotate(" + it.rot + "deg)" : "");
        });
      }
    };
  }

  /* ------------------------------------- mehndi flowers, turned by scroll -- */
  function mehndiScene() {
    var items = $$("[data-cx-spin]").map(function (el) {
      return {
        art: el,
        turn: parseFloat(el.getAttribute("data-cx-spin")) || 140,
        box: el.offsetParent || el.parentElement,
        f: new Follow(.09)
      };
    });
    if (!items.length) return null;
    return {
      measure: function () { items.forEach(function (it) { it.f.snap(); }); },
      update: function (dt) {
        if (reduced) return;
        items.forEach(function (it) {
          var r = it.box.getBoundingClientRect();
          if (r.bottom < -vh * .3 || r.top > vh * 1.3) return;
          var p = it.f.step(clamp((vh - r.top) / (vh + r.height), 0, 1), dt);
          it.art.style.rotate = (p * it.turn).toFixed(2) + "deg";
        });
      }
    };
  }

  /* ---------------------------------------- scroll meter and header tint -- */
  function chromeScene() {
    var meter = $("#uhMeter"), numEl = $("#uhMeterNum"), header = $("#siteHeader");
    var zones = $$("[data-bg]");
    function toneAt(py) {
      /* Zones nest now that 05 is a panel inside the journey, so keep going
         and let the innermost one — the last in document order — decide. */
      var found = "light";
      for (var i = 0; i < zones.length; i++) {
        var r = zones[i].getBoundingClientRect();
        if (r.top <= py && r.bottom > py && r.right > 0 && r.left < vw) {
          var split = parseFloat(zones[i].getAttribute("data-bg-split"));
          var tone = zones[i].getAttribute("data-bg");
          if (split && py - r.top < r.height * split) tone = tone === "dark" ? "light" : "dark";
          found = tone;
        }
      }
      return found;
    }
    return {
      measure: function () { zones = $$("[data-bg]"); },
      update: function () {
        var max = document.documentElement.scrollHeight - vh;
        var pct = max > 0 ? clamp(y / max, 0, 1) : 0;
        if (meter) {
          meter.style.setProperty("--cx-p", pct.toFixed(4));
          meter.classList.toggle("on-dark", toneAt(vh * .5) === "dark");
        }
        if (numEl) numEl.textContent = String(Math.round(pct * 100)).padStart(2, "0");
        if (header) {
          var dark = toneAt(38) === "dark";
          header.classList.toggle("on-dark", dark);
          header.classList.toggle("on-light", !dark);
        }
      }
    };
  }

  /* ---------------------------------------------------------- fit text -- */
  function fitText() {
    $$("[data-cx-fit]").forEach(function (el) {
      var target = (parseFloat(el.getAttribute("data-cx-fit")) || 94) / 100 * vw;
      el.style.fontSize = "100px";
      var w = el.scrollWidth;
      if (w) el.style.fontSize = (100 * target / w).toFixed(2) + "px";
    });
  }

  /* ------------------------------------------------- draggable route map -- */
  /* ============================================================== intro == */
  function runIntro(onReveal) {
    var pre = $("#cxPre");
    var img = $(".cx-hero__zoom img");
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
      doc.classList.remove("cx-lock", "cx-intro");
      /* Lines are split by measuring where words land, and document.fonts.ready
         fires while the intro still owns the layout — so breaks got baked from
         the wrong widths. Split again now the page is in its final state. */
      fitText();
      $$('[data-cx="p"], [data-cx-part="p"]').forEach(splitLines);
      measureAll();
      kick();
    }

    if (!pre || reduced) { onReveal(); finish(); return; }

    var seen = false;
    try { seen = sessionStorage.getItem("cx-seen") === "1"; } catch (e) {}
    try { sessionStorage.setItem("cx-seen", "1"); } catch (e) {}

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    doc.classList.add("cx-lock");

    var w0 = desk ? 24 : 40, w1 = desk ? 36 : 52;
    function setArch(w, h) {
      pre.style.setProperty("--aw", w.toFixed(3) + "vw");
      pre.style.setProperty("--ay", h.toFixed(3) + "vh");
    }
    setArch(w0, 104);

    var parts = $$("[data-cx-part]", pre);
    parts.forEach(prepare);

    function arch() {
      var RISE = 1500, DIVE = 2400, HAND = RISE * .9;
      var k0 = ease.inOut(HAND / RISE), sw = lerp(w0, w1, k0), sy = lerp(104, 15, k0);
      var start = null, settled = false, revealed = false;
      function frame(now) {
        if (start === null) start = now;
        var t = now - start;
        if (t < HAND) {
          var k = ease.inOut(t / RISE);
          setArch(lerp(w0, w1, k), lerp(104, 15, k));
        } else {
          if (!settled) {
            settled = true;
            if (img) img.classList.add("is-settling");
            doc.classList.remove("cx-intro");
          }
          var k2 = ease.dive(clamp((t - HAND) / DIVE, 0, 1));
          setArch(lerp(sw, 140, k2), lerp(sy, -100, k2));
          if (!revealed && t - HAND > DIVE * .25) { revealed = true; onReveal(); }
        }
        if (t < HAND + DIVE) requestAnimationFrame(frame);
        else finish();
      }
      requestAnimationFrame(frame);
    }

    if (seen) {
      pre.classList.add("is-short", "is-decor", "is-logo");
      setTimeout(arch, 1150);   // long enough for the logo to read
    } else {
      pre.classList.add("is-logo");                       // the logo lands first
      setTimeout(function () { showAll(parts, .05); }, 1300);
      setTimeout(function () { pre.classList.add("is-decor"); }, 2300);
      setTimeout(function () { pre.classList.add("is-loading"); }, 3100);
      setTimeout(arch, 7100);
    }

    // never leave the page locked if a frame loop stalls
    setTimeout(function () { if (!finished) { onReveal(); finish(); } }, 14000);
  }

  function revealHero() {
    var hero = $("#cxHero");
    if (!hero || hero.__cxShown) return;
    hero.__cxShown = true;
    showAll($$("[data-cx]", hero), .15);
  }

  /* --------------------------------------- route map, scrubbed on phones -- */
  /* The desktop journey is one long horizontal track, so the route already
     slides past on its own. Below the breakpoint the map is wider than the
     screen and used to need a drag; here the vertical scroll moves it. */
  /* ------------------------------------------------ day / night piece -- */
  function dayNightScene() {
    var sec = $("#cxDayNight");
    if (!sec) return null;
    var stage = $(".cx-dn__stage", sec);
    var tabs = $$(".cx-dn__tab", sec);
    var top = 0, h = 1, f = new Follow(.1), forced = null, forceAt = 0;

    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        forced = btn.getAttribute("data-dn") === "night" ? 1 : 0;
        forceAt = performance.now();
        tabs.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        kick();
      });
    });

    return {
      measure: function () { top = absTop(sec); h = sec.offsetHeight; f.snap(); },
      update: function (dt) {
        if (y < top - vh * 1.2 || y > top + h + vh * .2) return;
        var scrolled = clamp((y - top) / Math.max(1, h - vh), 0, 1);
        var target = seg(scrolled, .18, .78);
        // a click wins for a few seconds, then the scroll takes back over
        if (forced !== null) {
          if (performance.now() - forceAt > 4000 && Math.abs(target - forced) < .35) forced = null;
          else target = forced;
        }
        var p = reduced ? target : f.step(target, dt);
        stage.style.setProperty("--dn", p.toFixed(3));
        if (forced === null) {
          tabs.forEach(function (b) {
            b.setAttribute("aria-pressed", String((b.getAttribute("data-dn") === "night") === (p > .5)));
          });
        }
      }
    };
  }

  /* ------------------------------------------------- gallery columns --- */
  function galleryScene() {
    var sec = $(".cx-gallery");
    if (!sec) return null;
    var cols = $$(".cx-gallery__col", sec);
    var speeds = [-26, 16, -38];
    var top = 0, h = 1;
    return {
      measure: function () {
        top = absTop(sec); h = sec.offsetHeight;
        if (!desk || reduced) cols.forEach(function (c) { c.style.transform = ""; });
      },
      update: function () {
        if (reduced || !desk) return;
        if (y < top - vh * 1.2 || y > top + h + vh * .2) return;
        var p = clamp((y - (top - vh)) / (h + vh), 0, 1);
        cols.forEach(function (c, i) {
          c.style.transform = "translate3d(0," + ((p - .5) * (speeds[i % speeds.length])).toFixed(1) + "px,0)";
        });
      }
    };
  }

  /* ------------------------------------------------- magnetic buttons -- */
  function initMagnets() {
    if (reduced || !window.matchMedia("(hover: hover)").matches) return;
    $$("[data-cx-magnet]").forEach(function (el) {
      var pull = parseFloat(el.getAttribute("data-cx-magnet")) || .3;
      var raf = null, tx = 0, ty = 0;
      function apply() {
        raf = null;
        el.style.transform = "translate3d(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px,0)";
      }
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * pull;
        ty = (e.clientY - (r.top + r.height / 2)) * pull;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      el.addEventListener("pointerleave", function () {
        tx = ty = 0;
        el.style.transition = "transform .6s var(--cx-out)";
        if (!raf) raf = requestAnimationFrame(apply);
        setTimeout(function () { el.style.transition = ""; }, 620);
      });
      el.addEventListener("pointerenter", function () { el.style.transition = ""; });
    });
  }

  /* ------------------------------------------- nav labels swap on hover -- */
  function initNavSwap() {
    if (reduced) return;
    $$(".cx .nav-list a").forEach(function (a) {
      var text = a.textContent.trim();
      if (!text || a.querySelector(".cx-swap")) return;
      a.innerHTML = '<span class="cx-swap"><i></i><i></i></span>';
      var box = a.firstChild;
      box.children[0].textContent = text;
      box.children[1].textContent = text;
      box.setAttribute("aria-label", text);
    });
  }

  /* =============================================================== boot == */
  function build() {
    fitText();
    $$("[data-cx-part]").forEach(prepare);
    initReveals();
    [heroScene(), journeyScene(), vistaScene(), dayNightScene(), galleryScene(),
     footerScene(), driftScene(), mehndiScene(), chromeScene()]
      .forEach(function (s) { if (s) scenes.push(s); });
    measureAll();
    initMagnets();
    initNavSwap();

    window.addEventListener("scroll", kick, { passive: true });

    var lastW = vw, timer = null;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        readViewport();
        if (vw !== lastW) {
          lastW = vw;
          fitText();
          $$('[data-cx="p"], [data-cx-part="p"]').forEach(splitLines);
        }
        measureAll();
        kick();
      }, 150);
    });
    window.addEventListener("load", function () { measureAll(); kick(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        fitText();
        $$('[data-cx="p"], [data-cx-part="p"]').forEach(splitLines);
        measureAll();
        kick();
      });
    }

    runIntro(revealHero);
    kick();
  }

  build();
})();
