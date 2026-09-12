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
      $$(".cx-pin", map).forEach(function (pin, i) { pin.style.setProperty("--i", i); });
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
    var content = $(".cx-hero__content", sec), cue = $(".cx-hero__cue", sec);
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
        if (cue) cue.style.opacity = (1 - seg(p, 0, .12)).toFixed(3);
      }
    };
  }

  /* ---------------------------------------------------------- journey -- */
  function journeyScene() {
    var sec = $("#cxJourney");
    if (!sec) return null;
    var track = $(".cx-journey__track", sec);
    var linesBox = $(".cx-intro__lines", sec);
    var lines = $$(".cx-intro__line", sec);
    var from = [-6, 24, -12], to = [6, -22, 22];
    var top = 0, H = 0, travel = 0, linesTop = 0, linesH = 0, pinned = false;
    var f = new Follow(.07), g = new Follow(.07);
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
        if (linesBox) {
          lines.forEach(function (l) { l.style.transform = ""; });
          linesTop = absTop(linesBox);
          linesH = linesBox.offsetHeight;
        }
        f.snap(); g.snap();
      },
      update: function (dt) {
        if (reduced) return;
        var q;
        if (pinned) {
          var a = top + .025 * H, b = top + .975 * H - vh;
          var p = f.step(clamp((y - a) / Math.max(1, b - a), 0, 1), dt);
          track.style.transform = "translate3d(" + (-travel * ease.glide(p)).toFixed(1) + "px,0,0)";
          q = g.step(clamp((y - top) / Math.max(1, H - vh), 0, 1), dt);
        } else {
          q = g.step(clamp((y - (linesTop - vh)) / (vh + linesH), 0, 1), dt);
        }
        lines.forEach(function (l, i) {
          l.style.transform = "translate3d(" + lerp(from[i], to[i], q).toFixed(2) + "%,0,0)";
        });
      }
    };
  }

  /* ------------------------------------------------------------ vista -- */
  function vistaScene() {
    var sec = $("#cxVista");
    if (!sec) return null;
    var media = $(".cx-vista__media", sec), clouds = $(".cx-vista__clouds", sec), card = $(".cx-vista__card", sec);
    var top = 0, h = 1, f = new Follow(.07);
    return {
      measure: function () { top = absTop(sec); h = sec.offsetHeight; f.snap(); },
      update: function (dt) {
        if (reduced) return;
        if (y < top - vh * 1.2 || y > top + h + vh * .2) return;
        var p = f.step(clamp((y - (top - vh)) / h, 0, 1), dt);
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

  /* ---------------------------------------------------------- windows -- */
  function windowsScene() {
    var sec = $("#cxWindows");
    if (!sec) return null;
    var img = $(".cx-windows__img", sec), covers = $(".cx-windows__covers", sec);
    var coverL = $(".cx-windows__cover--l", sec), coverR = $(".cx-windows__cover--r", sec);
    var head = $(".cx-windows__head", sec);
    var copy = $$(".cx-windows__copy [data-cx], .cx-windows__cta[data-cx]", sec);
    var top = 0, H = 1, f = new Follow(0), copyOn = false;

    function hole(el, offset, x0, x1, y0, y1) {
      var W = vw / 2;
      var X0 = ((x0 - offset) / 100 * vw).toFixed(1), X1 = ((x1 - offset) / 100 * vw).toFixed(1);
      var Y0 = (y0 / 100 * vh).toFixed(1), Y1 = (y1 / 100 * vh).toFixed(1);
      el.style.clipPath = 'path(evenodd, "M0 0H' + W + "V" + vh + "H0Z M" + X0 + " " + Y0 + "H" + X1 + "V" + Y1 + "H" + X0 + 'Z")';
    }

    return {
      measure: function () {
        top = absTop(sec);
        H = sec.offsetHeight;
        f.snap();
        if (!desk || reduced) {
          coverL.style.clipPath = coverR.style.clipPath = "";
          covers.style.transform = head.style.transform = "";
        }
      },
      update: function (dt) {
        if (reduced) return;
        var on;
        if (desk) {
          if (y < top - vh * 1.3 || y > top + H + vh * .3) return;
          var p = f.step(clamp((y - (top - vh)) / (3 * vh), 0, 1), dt);
          var a = ease.std(seg(p, 0, .5)), b = seg(p, .5, .6), c = ease.inOut(seg(p, .6, 1));
          hole(coverL, 0,  lerp(25, 22, a), lerp(49.2, 50, b), lerp(44, 18, a), lerp(104, 82, a));
          hole(coverR, 50, lerp(50.8, 50, b), lerp(75, 78, a), lerp(16, 18, a), lerp(78, 82, a));
          covers.style.transform = "scale(" + (1 + .84 * c).toFixed(4) + ")";
          covers.style.visibility = c >= 1 ? "hidden" : "";
          head.style.transform = "scale(" + (.75 + .25 * c).toFixed(4) + ")";
          sec.setAttribute("data-bg", p < .82 ? "light" : "dark");
          var q = clamp((y - (top + .55 * H)) / (.45 * H), 0, 1);
          img.style.transform = "translate3d(0," + (q * 25).toFixed(2) + "%,0)";
          on = y > top + 1.9 * vh;   // once the windows have opened fully
        } else {
          if (y < top - vh * 1.3 || y > top + H + vh * .3) return;
          var m = clamp((y - (top - vh)) / (H + vh), 0, 1);
          img.style.transform = "translate3d(0," + lerp(-8, 8, m).toFixed(2) + "%,0)";
          sec.setAttribute("data-bg", "dark");
          on = y > top + H * .45 - vh;
        }
        if (on && !copyOn) { copyOn = true; showAll(copy, .1); }
        else if (!on && copyOn) { copyOn = false; copy.forEach(hide); }
      }
    };
  }

  /* ------------------------------------------------- views and footer -- */
  function finaleScene() {
    var views = $("#cxViews"), footer = $("#cxFooter");
    if (!views || !footer) return null;
    var clip = $(".cx-views__clip", views), media = $(".cx-views__media", views), title = $(".cx-views__title", views);
    var main = $(".cx-footer__main", footer);
    var footText = $$("[data-cx]", footer);
    var vTop = 0, vH = 1, tTop = 0, tH = 1, fTop = 0, fH = 1, f = new Follow(.08), shown = false;
    return {
      measure: function () {
        title.style.transform = "";
        vTop = absTop(views); vH = views.offsetHeight;
        tTop = absTop(title); tH = title.offsetHeight;
        fTop = absTop(footer); fH = footer.offsetHeight;
        f.snap();
      },
      update: function (dt) {
        if (reduced) return;
        if (y < vTop - vh * 1.2) return;
        var m = clamp((y - (vTop + vH - vh)) / vh, 0, 1);
        media.style.transform = "translate3d(0," + (m * 16).toFixed(2) + "%,0)";
        var t = clamp((y - (tTop - vh * 1.25)) / (tH + vh * 1.5), 0, 1);
        title.style.transform = "translate3d(0," + lerp(10, -10, t).toFixed(2) + "%,0)";

        var a = fTop - .3 * vh, b = Math.max(a + 1, fTop + fH - vh);
        var p = f.step(clamp((y - a) / (b - a), 0, 1), dt);
        var ix = desk ? 22 : 32, iy = desk ? 8 : 4;
        clip.style.clipPath = "inset(" + (iy * p).toFixed(3) + "% " + (ix * p).toFixed(3) + "%)";
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
      for (var i = 0; i < zones.length; i++) {
        var r = zones[i].getBoundingClientRect();
        if (r.top <= py && r.bottom > py) {
          var split = parseFloat(zones[i].getAttribute("data-bg-split"));
          var tone = zones[i].getAttribute("data-bg");
          if (split && py - r.top < r.height * split) tone = tone === "dark" ? "light" : "dark";
          return tone;
        }
      }
      return "light";
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
  function initDrag() {
    $$(".cx-route__scroller").forEach(function (box) {
      var down = false, sx = 0, sl = 0;
      box.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "mouse" || box.classList.contains("is-scrubbed")) return;
        if (box.scrollWidth <= box.clientWidth) return;
        down = true; sx = e.clientX; sl = box.scrollLeft; box.style.cursor = "grabbing";
      });
      window.addEventListener("pointermove", function (e) {
        if (down) box.scrollLeft = sl - (e.clientX - sx);
      });
      window.addEventListener("pointerup", function () { down = false; box.style.cursor = ""; });
    });
  }

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
  function routeScene() {
    var box = $(".cx-route__scroller");
    if (!box) return null;
    var map = $(".cx-route__map", box);
    var label = $(".cx-route__hint b");
    var top = 0, H = 1, travel = 0, live = false;
    var f = new Follow(.09);
    return {
      measure: function () {
        map.style.transform = "";
        box.scrollLeft = 0;
        live = !desk && !reduced;
        box.classList.toggle("is-scrubbed", live);
        if (label) label.textContent = live ? "Keep scrolling to see more" : "Drag to see more";
        travel = live ? Math.max(0, map.scrollWidth - box.clientWidth) : 0;
        top = absTop(box);
        H = box.offsetHeight || 1;
        f.snap();
      },
      update: function (dt) {
        if (!live || !travel) return;
        /* The strip is shorter than the screen, so pace the pan off its centre:
           it starts as the strip comes up from the bottom and ends while it is
           still in view near the top. */
        var mid = top + H / 2, a = mid - vh * .88, b = mid - vh * .12;
        var p = f.step(clamp((y - a) / Math.max(1, b - a), 0, 1), dt);
        map.style.transform = "translate3d(" + (-travel * p).toFixed(1) + "px,0,0)";
      }
    };
  }

  /* ------------------------------------------- arch with curved text -- */
  function arcScene() {
    var sec = $(".cx-arc");
    if (!sec) return null;
    var txt = $(".cx-arc__curve text", sec);
    var panel = $(".cx-arc__panel", sec);
    var top = 0, h = 1, f = new Follow(.08);
    return {
      measure: function () { top = absTop(sec); h = sec.offsetHeight; f.snap(); },
      update: function (dt) {
        if (reduced || !txt) return;
        if (y < top - vh * 1.2 || y > top + h + vh * .2) return;
        var p = f.step(clamp((y - (top - vh)) / (h + vh), 0, 1), dt);
        txt.style.wordSpacing = (p * (desk ? 90 : 40)).toFixed(1) + "px";
        if (panel) panel.style.setProperty("--arc-p", p.toFixed(3));
      }
    };
  }

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

  /* ------------------------------------- everything-included zoom out -- */
  function includedScene() {
    var sec = $("#cxIncluded");
    if (!sec) return null;
    var list = $(".cx-included__list", sec), bg = $(".cx-included__bg", sec);
    var lines = $$(".cx-included__list span", sec);
    var top = 0, h = 1, f = new Follow(0);
    return {
      measure: function () { top = absTop(sec); h = sec.offsetHeight; f.snap(); },
      update: function (dt) {
        if (reduced) return;
        if (y < top - vh * .3 || y > top + h + vh * .2) return;
        var p = f.step(clamp((y - top) / Math.max(1, h - vh), 0, 1), dt);
        var z = ease.inn(seg(p, .25, 1));
        list.style.transform = "scale(" + (1 + z).toFixed(4) + ")";
        list.style.opacity = (1 - seg(p, .45, .95)).toFixed(3);
        bg.style.transform = "scale(" + (1 + .12 * p).toFixed(4) + ")";
        var lit = Math.floor(seg(p, .05, .5) * lines.length);
        lines.forEach(function (l, i) { l.classList.toggle("is-lit", i <= lit); });
      }
    };
  }

  /* --------------------------------------------- rotating header seal -- */
  function sealScene() {
    var rings = $$(".cx-seal circle");
    if (!rings.length) return null;
    var angle = 0, speed = 14, dir = 1, prevY = window.scrollY;
    return {
      measure: function () {},
      update: function (dt) {
        if (reduced) return;
        var delta = y - prevY;
        prevY = y;
        if (delta) dir = delta > 0 ? 1 : -1;
        var want = dir * (14 + Math.min(260, Math.abs(delta) * 7));
        speed += (want - speed) * Math.min(1, dt * 4);
        angle = (angle + speed * dt) % 360;
        var t = "rotate(" + angle.toFixed(2) + "deg)";
        rings.forEach(function (r, i) { r.style.transform = i ? "rotate(" + (-angle).toFixed(2) + "deg)" : t; });
        if (Math.abs(speed) > 15.5) busy = true;
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
    [heroScene(), journeyScene(), routeScene(), vistaScene(), arcScene(), dayNightScene(), galleryScene(),
     includedScene(), windowsScene(), finaleScene(), driftScene(), mehndiScene(), sealScene(), chromeScene()]
      .forEach(function (s) { if (s) scenes.push(s); });
    measureAll();
    initDrag();
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
