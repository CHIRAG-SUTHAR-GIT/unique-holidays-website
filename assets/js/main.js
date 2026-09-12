/* Unique Holidays — site interactions.
   Plain ES2017, no dependencies, safe to run on every page. */
(function () {
  "use strict";

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------- header -- */
  var header = $("#siteHeader");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* --------------------------------------------------------- mobile nav -- */
  var toggle = $("#navToggle"), nav = $("#primaryNav");
  if (toggle && nav) {
    var setNav = function (open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", function () {
      setNav(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setNav(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 940) setNav(false);
    });
  }

  /* ------------------------------------------------------ current year -- */
  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ------------------------------------------------------ scroll reveal -- */
  var reveals = $$(".reveal");
  if (reveals.length) {
    if (!("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
      reveals.forEach(function (el, i) {
        el.style.transitionDelay = (i % 4) * 70 + "ms";
        io.observe(el);
      });
    }
  }

  /* --------------------------------------------------- animated counters -- */
  var counters = $$("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var format = function (n) { return n.toLocaleString("en-IN"); };
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        co.unobserve(el);
        var target = parseInt(el.getAttribute("data-count"), 10) || 0;
        var suffix = el.getAttribute("data-suffix") || "";
        if (reduce) { el.textContent = format(target) + suffix; return; }
        var start = null, dur = 1400;
        var tick = function (ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = format(Math.round(target * eased)) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* -------------------------------------------------- testimonial slider -- */
  var slider = $("#reviewSlider");
  if (slider) {
    var track = $(".slider-track", slider);
    var slides = $$(".slide", slider);
    var dots = $$(".slider-dots button", slider);
    var index = 0, timer = null;

    var go = function (i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = "translateX(" + (-index * 100) + "%)";
      dots.forEach(function (d, n) { d.setAttribute("aria-selected", String(n === index)); });
    };
    var play = function () {
      stop();
      timer = setInterval(function () { go(index + 1); }, 6500);
    };
    var stop = function () { if (timer) { clearInterval(timer); timer = null; } };

    $$("[data-slide]", slider).forEach(function (btn) {
      btn.addEventListener("click", function () {
        go(index + (btn.getAttribute("data-slide") === "next" ? 1 : -1));
        play();
      });
    });
    dots.forEach(function (dot, n) {
      dot.addEventListener("click", function () { go(n); play(); });
    });
    slider.addEventListener("mouseenter", stop);
    slider.addEventListener("mouseleave", play);
    slider.addEventListener("focusin", stop);

    // touch swipe
    var x0 = null;
    slider.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    slider.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
      x0 = null; play();
    });

    go(0);
    play();
  }

  /* ----------------------------------------------------------- accordion -- */
  $$(".faq-item").forEach(function (item) {
    var q = $(".faq-q", item), a = $(".faq-a", item);
    if (!q || !a) return;
    q.setAttribute("aria-expanded", "false");
    q.addEventListener("click", function () {
      var open = item.classList.toggle("is-open");
      q.setAttribute("aria-expanded", String(open));
      a.style.height = open ? a.scrollHeight + "px" : "0px";
    });
  });
  window.addEventListener("resize", function () {
    $$(".faq-item.is-open .faq-a").forEach(function (a) { a.style.height = a.scrollHeight + "px"; });
  });

  /* ------------------------------------------------------------ filters -- */
  var filterBar = $("#pkgFilters");
  if (filterBar) {
    var cards = $$("#pkgGrid .pkg-card");
    var countEl = $("#filterCount");
    var emptyEl = $("#pkgEmpty");
    var current = "all";

    var apply = function () {
      var shown = 0;
      cards.forEach(function (card) {
        var match = current === "all" || card.getAttribute("data-category") === current;
        card.classList.toggle("is-hidden", !match);
        if (match) shown++;
      });
      if (countEl) {
        countEl.textContent = shown + (shown === 1 ? " package" : " packages");
      }
      if (emptyEl) emptyEl.classList.toggle("is-hidden", shown !== 0);
    };

    filterBar.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      current = chip.getAttribute("data-filter");
      $$(".chip", filterBar).forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === chip));
      });
      apply();
    });

    // deep links: packages.html?destination=goa / ?type=honeymoon
    var params = new URLSearchParams(window.location.search);
    var dest = params.get("destination");
    var type = params.get("type");
    if (dest) {
      cards.forEach(function (card) {
        card.classList.toggle("is-hidden", card.getAttribute("data-destination") !== dest);
      });
      var visible = cards.filter(function (c) { return !c.classList.contains("is-hidden"); });
      if (countEl) countEl.textContent = visible.length + (visible.length === 1 ? " package" : " packages");
      if (emptyEl) emptyEl.classList.toggle("is-hidden", visible.length !== 0);
      var note = $("#filterNote");
      if (note) {
        note.textContent = "Showing trips to " + dest.charAt(0).toUpperCase() + dest.slice(1) + ".";
        note.classList.remove("is-hidden");
      }
    } else if (type) {
      var chipEl = $('.chip[data-filter="' + type + '"]', filterBar);
      if (chipEl) chipEl.click();
    } else {
      apply();
    }
  }

  /* --------------------------------------------- destination page search -- */
  var destSearch = $("#destSearch");
  if (destSearch) {
    var destCards = $$("#destGrid .dest-card");
    var destRegions = $("#destRegions");
    var region = "all";
    var term = "";

    var applyDest = function () {
      var shown = 0;
      destCards.forEach(function (card) {
        var okRegion = region === "all" || card.getAttribute("data-region") === region;
        var okTerm = !term || (card.getAttribute("data-name") || "").indexOf(term) > -1;
        var match = okRegion && okTerm;
        card.classList.toggle("is-hidden", !match);
        if (match) shown++;
      });
      var c = $("#destCount");
      if (c) c.textContent = shown + (shown === 1 ? " destination" : " destinations");
      var empty = $("#destEmpty");
      if (empty) empty.classList.toggle("is-hidden", shown !== 0);
    };

    destSearch.addEventListener("input", function () {
      term = destSearch.value.trim().toLowerCase();
      applyDest();
    });
    if (destRegions) {
      destRegions.addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (!chip) return;
        region = chip.getAttribute("data-region");
        $$(".chip", destRegions).forEach(function (c) {
          c.setAttribute("aria-pressed", String(c === chip));
        });
        applyDest();
      });
    }
    applyDest();
  }

  /* ------------------------------------------------------- trip search -- */
  var tripSearch = $("#tripSearch");
  if (tripSearch) {
    tripSearch.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(tripSearch);
      var qs = [];
      if (data.get("destination")) qs.push("destination=" + encodeURIComponent(data.get("destination")));
      if (data.get("type")) qs.push("type=" + encodeURIComponent(data.get("type")));
      window.location.href = "packages.html" + (qs.length ? "?" + qs.join("&") : "");
    });
  }

  /* ---------------------------------------------------- enquiry form ---- */
  var form = $("#enquiryForm");
  if (form) {
    // prefill the package field from packages.html?package=slug
    var pkgParam = new URLSearchParams(window.location.search).get("package");
    if (pkgParam) {
      var interest = $("#interest", form);
      if (interest) {
        var pretty = pkgParam.replace(/-/g, " ").replace(/\b\w/g, function (m) { return m.toUpperCase(); });
        var opt = Array.prototype.find.call(interest.options, function (o) { return o.value === pkgParam; });
        if (opt) { interest.value = pkgParam; }
        else {
          var added = new Option(pretty, pkgParam, true, true);
          interest.add(added);
        }
        var msg = $("#message", form);
        if (msg && !msg.value) msg.value = "I'd like to know more about the " + pretty + " package.";
      }
    }

    var showError = function (field, text) {
      var wrap = field.closest(".field");
      if (!wrap) return;
      wrap.classList.add("is-invalid");
      var err = $(".error", wrap);
      if (err) err.textContent = text;
    };
    var clearError = function (field) {
      var wrap = field.closest(".field");
      if (wrap) wrap.classList.remove("is-invalid");
    };

    $$("input, select, textarea", form).forEach(function (f) {
      f.addEventListener("input", function () { clearError(f); });
      f.addEventListener("change", function () { clearError(f); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true, firstBad = null;

      var name = $("#name", form);
      if (name && name.value.trim().length < 2) {
        showError(name, "Please tell us your name."); ok = false; firstBad = firstBad || name;
      }
      var email = $("#email", form);
      if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim())) {
        showError(email, "Enter a valid email address."); ok = false; firstBad = firstBad || email;
      }
      var phone = $("#phone", form);
      if (phone && phone.value.replace(/\D/g, "").length < 10) {
        showError(phone, "Enter a 10-digit phone number."); ok = false; firstBad = firstBad || phone;
      }
      var consent = $("#consent", form);
      if (consent && !consent.checked) {
        showError(consent, "Please accept so we can reply to you."); ok = false; firstBad = firstBad || consent;
      }

      if (!ok) { if (firstBad) firstBad.focus(); return; }

      // No backend is wired up yet — see README "Connecting the forms".
      var success = $("#formSuccess");
      if (success) {
        success.classList.add("is-visible");
        success.setAttribute("tabindex", "-1");
        success.focus();
        success.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      form.reset();
    });
  }

  /* ------------------------------------------------------- newsletter --- */
  var news = $("#newsletterForm");
  if (news) {
    news.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("#newsletterEmail", news);
      var msg = $("#newsletterMsg");
      var valid = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(input.value.trim());
      if (!msg) return;
      msg.textContent = valid
        ? "Thanks — you're on the list. Deals land on the first of each month."
        : "Please enter a valid email address.";
      msg.style.color = valid ? "var(--sky)" : "#FFB4A2";
      if (valid) news.reset();
    });
  }
})();
