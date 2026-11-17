(function () {
  if (!('serviceWorker' in navigator)) return;
  var script = document.currentScript;
  var swUrl = script && script.dataset.sw;
  if (!swUrl) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swUrl).catch(function () {});
  });
})();
