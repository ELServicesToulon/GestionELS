// JS léger et non intrusif pour l'accueil ELS
(function () {
  function onReady(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn, { once: true }); }

  onReady(function () {
    // Supprime d'éventuels sélecteurs de thème hérités
    document.querySelectorAll('.theme-selector, #btn-theme, #menu-theme').forEach(function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); });

    // Ancre vers le calendrier depuis le héros
    var link = document.getElementById('btn-resa-link');
    if (link) {
      link.addEventListener('click', function (e) {
        if (location.hash === '#vue-calendrier') return;
        var target = document.getElementById('vue-calendrier');
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    // Ajuste la variable --vh pour mobiles (évite dépassements)
    function setVh() { document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); }
    setVh();
    window.addEventListener('resize', setVh);
  });
})();

