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
