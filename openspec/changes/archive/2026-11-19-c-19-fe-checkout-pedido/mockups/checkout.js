/* Mockups C-19 (base: carrito.js de C-18): datos de ejemplo (productos del seed de backend/app/db/seed.py), shell y helpers.
   Solo para los mockups. Debe cargarse ANTES de mockup.js (calcula window.MOCK_COUNT y arma el shell). */
(function () {
  var params = new URLSearchParams(location.search);
  var estado = params.get('estado');

  function precio(decimal) {
    var partes = decimal.split('.');
    var entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var cent = (partes[1] || '00').padEnd(2, '0');
    return '$ ' + entero + (cent === '00' ? '' : ',' + cent);
  }
  function aCent(d) { var p = d.split('.'); return parseInt(p[0], 10) * 100 + parseInt((p[1] || '0').padEnd(2, '0'), 10); }
  function deCent(c) { var e = Math.floor(c / 100), r = c % 100; return e + '.' + (r < 10 ? '0' + r : r); }
  function ico(id) { return '<svg class="ico" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  /* Lineas del carrito (cartStore v2). t: tono del marcador de foto; null = sin imagen. */
  var LINEAS = [
    { id: 'a', pid: 1, nombre: 'Hamburguesa Clásica', precio: '1500.00', cant: 2, t: '', excl: ['Cebolla', 'Tomate'] },
    { id: 'c', pid: 5, nombre: 'Coca-Cola 500ml', precio: '800.00', cant: 1, t: null, excl: [] }
  ];
  var lineas = LINEAS.slice();
  var vacio = params.get('carrito') === 'vacio' || cfgVacio();
  function cfgVacio() { return !!(window.CFG && window.CFG.vacio); }
  if (vacio) lineas = [];
  var unidades = lineas.reduce(function (n, l) { return n + l.cant; }, 0);
  var totalCent = lineas.reduce(function (n, l) { return n + aCent(l.precio) * l.cant; }, 0);

  /* Texto de personalizacion (design D4): «Sin cebolla, sin tomate»; migrada sin nombres: «Sin 2 ingredientes». */
  function textoPers(l) {
    if (l.sinNombres) return 'Sin ' + l.sinNombres + (l.sinNombres === 1 ? ' ingrediente' : ' ingredientes');
    if (!l.excl.length) return null;
    return 'Sin ' + l.excl.map(function (n) { return n.toLowerCase(); }).join(', sin ');
  }

  var cfg = window.CFG || {};
  var count = typeof cfg.count === 'number' ? cfg.count : unidades;
  window.MOCK_COUNT = count;

  function shell() {
    var label = count ? 'Carrito, ' + count + (count === 1 ? ' producto' : ' productos') : 'Carrito';
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="shell" id="shell">' +
      '<aside class="sidebar" id="sidebar"><div class="sidebar-head">' +
        '<img class="sidebar-logo" src="../../../../design-system/assets/logo.svg" alt="Food Store (logo provisional)">' +
        '<button class="icon-btn btn-collapse" id="btn-collapse" type="button" aria-controls="sidebar" aria-expanded="true" aria-label="Colapsar panel"><svg class="ico" aria-hidden="true"><use href="#i-panel"/></svg></button>' +
        '<button class="icon-btn btn-close" id="btn-close" type="button" aria-label="Cerrar menú"><svg class="ico" aria-hidden="true"><use href="#i-cerrar"/></svg></button></div>' +
      '<nav class="sidebar-nav" id="sidebar-nav" aria-label="Principal"></nav>' +
      '<div class="sidebar-foot"><span class="avatar" aria-hidden="true">LP</span><div class="user-meta"><strong>Lucía Pérez</strong><small>' + (document.body.getAttribute('data-roles') || 'CLIENT') + '</small></div>' +
        '<button class="icon-btn btn-logout" type="button" aria-label="Cerrar sesión"><svg class="ico" aria-hidden="true"><use href="#i-salir"/></svg></button></div></aside>' +
      '<div class="scrim" id="scrim"></div>' +
      '<div class="shell-main"><div class="banner" id="banner">' + (cfg.banner || '') + '</div>' +
        '<header class="topbar"><button class="icon-btn" id="btn-menu" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Abrir menú"><svg class="ico" aria-hidden="true"><use href="#i-menu"/></svg></button>' +
        '<img src="../../../../design-system/assets/logo.svg" alt="Food Store (logo provisional)">' +
        '<a class="icon-btn" href="carrito.html" aria-label="' + label + '"><svg class="ico" aria-hidden="true"><use href="#i-carrito"/></svg>' + (count ? '<span class="count" aria-hidden="true">' + count + '</span>' : '') + '</a></header>' +
        '<main class="page ' + (cfg.pageClass || '') + '" id="main"><div id="contenido"></div></main>' +
        (cfg.buyBar ? '<div class="buy-bar" id="buy-bar"></div>' : '') +
      '</div></div>');
  }
  if (cfg.shell !== false) shell();

  function dialogo(html) {
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-titulo">' + html + '</div></div>');
    var m = document.getElementById('main'); if (m) m.setAttribute('aria-hidden', 'true');
  }
  function toast(tipo, titulo, texto) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toasts" aria-live="polite"><div class="toast t-' + tipo + '" role="status"><div><strong>' + titulo + '</strong>' + texto + '</div>' +
      '<button class="icon-btn" type="button" aria-label="Cerrar notificación">' + ico('i-cerrar') + '</button></div></div>');
  }

  window.MOCK = {
    estado: estado, params: params, precio: precio, aCent: aCent, deCent: deCent, ico: ico, lineas: lineas, unidades: unidades, totalCent: totalCent,
    textoPers: textoPers, dialogo: dialogo, toast: toast,
    llenar: function (id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
  };
})();
