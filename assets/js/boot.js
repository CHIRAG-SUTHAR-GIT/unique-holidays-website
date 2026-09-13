/* Runs before first paint: restores the saved night palette so the page never
   flashes light, and locks scrolling while the intro curtain is on screen. */
(function () {
  var d = document.documentElement;
  try {
    if (localStorage.getItem("uh-theme") === "night") d.setAttribute("data-theme", "night");
  } catch (e) {}
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    d.className += " uh-loading";
  }
})();

/* Cache guard.

   The stylesheets and scripts carry a ?v= build stamp, so a new build always
   gets fresh files — but only once the browser has a fresh index.html to read
   the new stamp from. The page itself is served with an ordinary cache
   lifetime, and a phone that is holding yesterday's copy keeps asking for
   yesterday's ?v= too, so plain refreshes show the old site with the old CSS.

   version.json is fetched past every cache and says what is actually
   published. If this document is behind, pull a fresh copy of it bypassing the
   HTTP cache and reload. sessionStorage records the stale id first, so if the
   reload somehow lands on the same old copy again the guard stands down rather
   than looping. */
(function () {
  var BUILD = "20260913e";        /* keep in step with the ?v= stamps in the pages */
  var KEY = "uh-stale-build";

  if (location.protocol === "file:" || !window.fetch) return;

  var seen;
  try {
    seen = sessionStorage.getItem(KEY);
  } catch (e) {
    return;                       /* no storage means no loop guard, so do nothing */
  }
  if (seen === BUILD) return;     /* already tried to refresh out of this build */

  fetch("version.json", { cache: "no-store" }).then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (v) {
    if (!v || !v.build || v.build === BUILD) return;
    try {
      sessionStorage.setItem(KEY, BUILD);
    } catch (e) {
      return;
    }
    return fetch(location.href, { cache: "reload", credentials: "same-origin" })
      .then(function () { location.reload(); });
  }).catch(function () {});
})();
