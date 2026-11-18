/* Mockups C-15 (copiado de C-13b + i-editar, i-basura, i-estrella, i-mas, i-tienda): sprite de iconos (el de design-system/components.html + extras),
   navegacion por rol (misma configuracion que design D5) y comportamiento del panel (design D7).
   Parametros de captura: ?nav=collapsed | ?nav=expanded | ?nav=drawer */
(function () {
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
    '<symbol id="i-catalogo" viewBox="0 0 24 24"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></symbol>' +
    '<symbol id="i-carrito" viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 11.4a1.5 1.5 0 0 0 1.5 1.1h8.3a1.5 1.5 0 0 0 1.5-1.2L20.5 7H6"/></symbol>' +
    '<symbol id="i-pedidos" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></symbol>' +
    '<symbol id="i-direcciones" viewBox="0 0 24 24"><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></symbol>' +
    '<symbol id="i-cuenta" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>' +
    '<symbol id="i-gestion" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></symbol>' +
    '<symbol id="i-categorias" viewBox="0 0 24 24"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/></symbol>' +
    '<symbol id="i-ingredientes" viewBox="0 0 24 24"><path d="M6 18C6 9 11 5 20 4c0 9-4 14-13 14"/><path d="M4 21c2-5 5-8 10-11"/></symbol>' +
    '<symbol id="i-productos" viewBox="0 0 24 24"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></symbol>' +
    '<symbol id="i-usuarios" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.6A7 7 0 0 1 22 20"/></symbol>' +
    '<symbol id="i-dashboard" viewBox="0 0 24 24"><path d="M5 20V11M11 20V4M17 20v-6M2 20h20"/></symbol>' +
    '<symbol id="i-ingresar" viewBox="0 0 24 24"><path d="M14 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/><path d="M4 12h11M11 8l4 4-4 4"/></symbol>' +
    '<symbol id="i-registrarse" viewBox="0 0 24 24"><circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 13-6.2"/><path d="M19 14v6M16 17h6"/></symbol>' +
    '<symbol id="i-salir" viewBox="0 0 24 24"><path d="M10 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5"/><path d="M9 12h11M16 8l4 4-4 4"/></symbol>' +
    '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>' +
    '<symbol id="i-cerrar" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>' +
    '<symbol id="i-panel" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></symbol>' +
    '<symbol id="i-candado" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/></symbol>' +
    /* Nuevos para 404 / error / placeholder (mismo estilo de trazo). (TBD) se agregan al sprite del design system al aprobar. */
    '<symbol id="i-brujula" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></symbol>' +
    '<symbol id="i-alerta" viewBox="0 0 24 24"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></symbol>' +
    '<symbol id="i-obra" viewBox="0 0 24 24"><path d="M3 20h18M5 20l3-12h8l3 12"/><path d="M7 14h10M9.5 8V5h5v3"/></symbol>' +
    /* Nuevos C-15 (mismo trazo). (TBD) requieren revision para sumarse al sprite del design system. */
    '<symbol id="i-editar" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></symbol>' +
    '<symbol id="i-basura" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></symbol>' +
    '<symbol id="i-estrella" viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></symbol>' +
    '<symbol id="i-mas" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>' +
    '<symbol id="i-tienda" viewBox="0 0 24 24"><path d="M4 10v10h16V10M3 10l2-6h14l2 6z"/><path d="M10 20v-5h4v5"/></symbol>' +
    '</svg>';
  document.body.insertAdjacentHTML('afterbegin', SPRITE);

  var shell = document.getElementById('shell');
  if (!shell) return; /* pagina de error: fuera del shell, ?nav no aplica */

  /* Configuracion de navegacion (design D5). visibleFor: 'anon' o roles. */
  var ALL = ['CLIENT', 'PEDIDOS', 'STOCK', 'ADMIN'];
  var NAV = [
    { list: [
      { id: 'catalogo', label: 'Catálogo', icon: 'i-catalogo', to: '/catalogo', vis: ['anon'].concat(ALL) },
      { id: 'carrito', label: 'Carrito', icon: 'i-carrito', to: '/carrito', vis: ALL, count: 3 },
      { id: 'mis-pedidos', label: 'Mis pedidos', icon: 'i-pedidos', to: '/mis-pedidos', vis: ALL },
      { id: 'direcciones', label: 'Direcciones', icon: 'i-direcciones', to: '/direcciones', vis: ALL },
      { id: 'mi-cuenta', label: 'Mi cuenta', icon: 'i-cuenta', to: '/mi-cuenta', vis: ALL }
    ] },
    { list: [
      { id: 'ingresar', label: 'Ingresar', icon: 'i-ingresar', to: '/ingresar', vis: ['anon'] },
      { id: 'registrarse', label: 'Registrarse', icon: 'i-registrarse', to: '/registrarse', vis: ['anon'] }
    ] },
    { list: [
      { id: 'gestion-pedidos', label: 'Gestión de pedidos', icon: 'i-gestion', to: '/gestion-pedidos', vis: ['PEDIDOS', 'ADMIN'] }
    ] },
    { title: 'Administración', list: [
      { id: 'categorias', label: 'Categorías', icon: 'i-categorias', to: '/admin/categorias', vis: ['ADMIN'] },
      { id: 'ingredientes', label: 'Ingredientes', icon: 'i-ingredientes', to: '/admin/ingredientes', vis: ['ADMIN'] },
      { id: 'productos', label: 'Productos y stock', icon: 'i-productos', to: '/admin/productos', vis: ['ADMIN', 'STOCK'] },
      { id: 'usuarios', label: 'Usuarios', icon: 'i-usuarios', to: '/admin/usuarios', vis: ['ADMIN'] },
      { id: 'dashboard', label: 'Dashboard', icon: 'i-dashboard', to: '/admin/dashboard', vis: ['ADMIN'] }
    ] }
  ];

  var roles = (document.body.getAttribute('data-roles') || '').split(' ').filter(Boolean);
  var keys = roles.length ? roles : ['anon'];
  var current = document.body.getAttribute('data-current');
  var nav = document.getElementById('sidebar-nav');
  var html = '', first = true;
  NAV.forEach(function (group) {
    var items = group.list.filter(function (it) { return it.vis.some(function (v) { return keys.indexOf(v) !== -1; }); });
    if (!items.length) return;
    if (group.title) html += '<p class="nav-group-title"><span>' + group.title + '</span></p>';
    else if (!first) html += '<hr class="nav-sep">';
    html += '<ul class="nav-list"' + (group.title ? ' aria-label="' + group.title + '"' : '') + '>';
    items.forEach(function (it) {
      html += '<li><a class="nav-item" href="#' + it.to + '"' + (it.id === current ? ' aria-current="page"' : '') + '>' +
        '<svg class="ico" aria-hidden="true"><use href="#' + it.icon + '"/></svg><span class="nav-label">' + it.label + '</span>' +
        (it.count && roles.length ? '<span class="count" aria-label="' + it.count + ' productos">' + it.count + '</span>' : '') + '</a></li>';
    });
    html += '</ul>';
    first = false;
  });
  nav.innerHTML = html;

  /* Comportamiento (design D7): colapso persistido en desktop, drawer no persistido en mobile. */
  var sidebar = document.getElementById('sidebar');
  var btnCollapse = document.getElementById('btn-collapse'), btnMenu = document.getElementById('btn-menu');
  var btnClose = document.getElementById('btn-close'), scrim = document.getElementById('scrim');
  var desktop = window.matchMedia('(min-width: 1024px)');
  var KEY = 'foodstore.mockup.sidebarCollapsed';
  var param = new URLSearchParams(location.search).get('nav');
  var collapsed = false;
  try { collapsed = localStorage.getItem(KEY) === '1'; } catch (e) {}
  if (param === 'collapsed') collapsed = true;
  if (param === 'expanded' || param === 'drawer') collapsed = false;

  function applyCollapsed() {
    var on = collapsed && desktop.matches;
    sidebar.classList.toggle('is-collapsed', on);
    btnCollapse.setAttribute('aria-expanded', String(!on));
    btnCollapse.setAttribute('aria-label', on ? 'Expandir panel' : 'Colapsar panel');
    sidebar.querySelectorAll('.nav-item').forEach(function (a) {
      if (on) a.title = a.querySelector('.nav-label').textContent; else a.removeAttribute('title');
    });
  }
  function setDrawer(open, keepFocus) {
    shell.classList.toggle('drawer-open', open);
    btnMenu.setAttribute('aria-expanded', String(open));
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (keepFocus) return;
    if (open) btnClose.focus(); else if (sidebar.contains(document.activeElement)) btnMenu.focus();
  }
  btnCollapse.addEventListener('click', function () {
    collapsed = !collapsed;
    try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch (e) {}
    applyCollapsed();
  });
  btnMenu.addEventListener('click', function () { setDrawer(true); });
  btnClose.addEventListener('click', function () { setDrawer(false); });
  scrim.addEventListener('click', function () { setDrawer(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('.nav-item') && !desktop.matches) setDrawer(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shell.classList.contains('drawer-open')) setDrawer(false); });
  desktop.addEventListener('change', function () { if (desktop.matches) setDrawer(false, true); applyCollapsed(); });

  applyCollapsed();
  /* En captura se abre sin mover el foco (evita el anillo de foco en la imagen). */
  if (param === 'drawer' && !desktop.matches) setDrawer(true, true);
  /* Transiciones solo despues del primer render: el estado inicial no se anima. */
  requestAnimationFrame(function () { requestAnimationFrame(function () { shell.classList.add('is-ready'); }); });
})();
