/* Single source for the displayed product name. Replace BRAND_NAME to rename all previews/mockups. */
(function () {
  var BRAND_NAME = "Food Store"; // (TBD) final name not confirmed
  window.BRAND_NAME = BRAND_NAME;
  function bind() {
    var nodes = document.querySelectorAll("[data-brand-name]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = BRAND_NAME;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
