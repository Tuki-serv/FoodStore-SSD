/* Mockups revision-visual (C-25b0), Revision 4 del design system.
   Arma el shell (panel lateral DD-25) alrededor del <main> de cada pagina, los datos de ejemplo del seed
   y las piezas repetidas (tarjeta de producto, respaldo tipografico, precio). Solo para los mockups:
   la app usa sus propios componentes (design D2-D6).
   Parametros: ?nav=collapsed | ?nav=expanded | ?nav=drawer (mobile). */
(function () {
  var DS = '../../../../design-system/';
  var params = new URLSearchParams(location.search);

  /* ---------- Datos de ejemplo (seed de backend/app/db/seed.py; los marcados con * son ilustrativos) ---------- */
  var P = {
    clasica:  { id: 1,  nombre: 'Hamburguesa Clásica', desc: 'La de siempre, perfecta de siempre.', precio: '1500.00', stock: 50, cat: 'Hamburguesas', alergenos: 3 },
    bbq:      { id: 2,  nombre: 'Burger BBQ Bacon', desc: 'Ahumada, crocante y con todo.', precio: '1900.00', stock: 30, cat: 'Hamburguesas', alergenos: 2 },
    vegana:   { id: 3,  nombre: 'Burger Vegana', desc: 'Plant-based, con medallón de legumbres.', precio: '1800.00', stock: 4, cat: 'Veganas', alergenos: 1 },
    sintacc:  { id: 4,  nombre: 'Burger Sin TACC', desc: 'Para celíacos, sin resignar sabor.', precio: '1700.00', stock: 20, cat: 'Sin TACC', alergenos: 1 },
    coca:     { id: 5,  nombre: 'Coca-Cola 500ml', desc: 'La clásica, bien fría.', precio: '800.00', stock: 100, cat: 'Gaseosas', alergenos: 0 },
    limonada: { id: 6,  nombre: 'Limonada Natural', desc: 'Exprimida al momento.', precio: '700.00', stock: 60, cat: 'Bebidas', alergenos: 0 },
    doble:    { id: 7,  nombre: 'Burger Doble Cheddar*', desc: 'Doble medallón y doble cheddar fundido.', precio: '2300.00', stock: 12, cat: 'Hamburguesas', alergenos: 2 },
    flan:     { id: 8,  nombre: 'Flan Casero*', desc: 'Con dulce de leche y crema.', precio: '900.00', stock: 2, cat: 'Postres', alergenos: 2 },
    brownie:  { id: 9,  nombre: 'Brownie con Helado*', desc: 'Tibio, con una bocha de americana.', precio: '1100.00', stock: 0, cat: 'Postres', alergenos: 2 },
    volcan:   { id: 10, nombre: 'Volcán de Chocolate*', desc: 'Centro fundido, recién horneado.', precio: '1250.50', stock: 8, cat: 'Postres', alergenos: 1 },
    agua:     { id: 11, nombre: 'Agua Mineral 500ml*', desc: 'Con o sin gas.', precio: '500.00', stock: 80, cat: 'Bebidas', alergenos: 0 },
    sprite:   { id: 12, nombre: 'Sprite 500ml*', desc: 'Lima limón, bien fría.', precio: '800.00', stock: 40, cat: 'Gaseosas', alergenos: 0 },
    noquis:   { id: 13, nombre: 'Ñoquis de Papa*', desc: 'Caseros, con salsa fileto.', precio: '1600.00', stock: 15, cat: 'Pastas', alergenos: 1 },
    empanada: { id: 14, nombre: 'Empanada de Carne*', desc: 'Cortada a cuchillo, al horno.', precio: '600.00', stock: 3, cat: 'Empanadas', alergenos: 1 }
  };

  /* Formato: miles con «.», centavos solo si no son ,00 */
  function precio(decimal, conSigno) {
    var partes = String(decimal).split('.');
    var entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var cent = (partes[1] || '00').padEnd(2, '0');
    return (conSigno === false ? '' : '$ ') + entero + (cent === '00' ? '' : ',' + cent);
  }
  /* Precio en display: el signo chico, el numero grande y tabular */
  function precioDisplay(decimal) {
    return '<span class="price"><small>$</small>' + precio(decimal, false) + '</span>';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function limpio(nombre) { return nombre.replace(/\*$/, ''); }

  /* Respaldo tipografico (design D5, OQ-1): inicial Unicode del nombre en mayuscula sobre un unico color de marca.
     Sin caracter alfanumerico -> icono plato. Mismo nombre accesible en todos los tamaños. */
  function respaldo(nombre, clase) {
    var n = limpio(nombre);
    var m = n.match(/[\p{L}\p{N}]/u);
    var cuerpo = m ? '<span class="ph-initial" aria-hidden="true">' + m[0].toLocaleUpperCase('es') + '</span>'
                   : '<svg class="ico" aria-hidden="true"><use href="#i-plato"/></svg>';
    return '<div class="ph ' + (clase || '') + '" role="img" aria-label="Sin imagen de ' + esc(n) + '">' + cuerpo + '</div>';
  }
  function stockChip(stock) {
    if (stock === 0) return '<span class="stock out">Agotado</span>';
    if (stock <= 5) return '<span class="stock low">Quedan ' + stock + '</span>';
    return '';
  }
  function alergeno(n) {
    return n > 0 ? '<span class="allergen" title="Contiene alérgenos"><svg class="ico" role="img" aria-label="Contiene alérgenos"><use href="#i-alergeno"/></svg></span>' : '';
  }

  /* Tarjeta de producto (D5): respaldo -> nombre -> precio display -> accion. Categoria como texto, omitida si
     coincide con el filtro activo. Un solo distintivo (stock) sobre la imagen. */
  function tarjeta(p, i, opts) {
    opts = opts || {};
    var agotado = p.stock === 0;
    var cat = opts.filtro === p.cat ? '' : '<span class="cat">' + p.cat + '</span>';
    return '<li class="card is-link' + (agotado ? ' unavailable' : '') + '" style="--i:' + i + '">' +
      '<div class="img">' + respaldo(p.nombre) + stockChip(p.stock) + '</div>' +
      '<div class="body">' + cat +
        '<h3><a class="card-link" href="producto-detalle.html">' + esc(limpio(p.nombre)) + '</a>' + alergeno(p.alergenos) + '</h3>' +
        '<p class="desc">' + p.desc + '</p>' +
        '<div class="foot">' + precioDisplay(p.precio) +
          (agotado ? '<button class="btn btn-secondary btn-sm" type="button" disabled>Agotado</button>'
                   : '<button class="btn btn-primary btn-sm btn-add" type="button" aria-label="Agregar ' + esc(limpio(p.nombre)) + ' al carrito"><svg class="ico" aria-hidden="true"><use href="#i-mas"/></svg><span class="lbl">Agregar</span></button>') +
        '</div></div></li>';
  }
  function grilla(id, lista, opts) {
    var el = document.getElementById(id);
    el.innerHTML = lista.map(function (p, i) { return tarjeta(p, Math.min(i, 8), opts); }).join('');
  }

  /* Estado de pedido: el unico chip con tinte, siempre con texto */
  var ESTADOS = { PENDIENTE: ['pendiente', 'Pendiente'], CONFIRMADO: ['confirmado', 'Confirmado'], EN_PREP: ['en-prep', 'En preparación'],
                  EN_CAMINO: ['en-camino', 'En camino'], ENTREGADO: ['entregado', 'Entregado'], CANCELADO: ['cancelado', 'Cancelado'] };
  function estado(e) { var x = ESTADOS[e]; return '<span class="badge b-' + x[0] + '">' + x[1] + '</span>'; }

  /* ---------- Shell ---------- */
  var USERS = {
    admin:   { ini: 'AG', nombre: 'Ana Gómez', rol: 'Administrador' },
    client:  { ini: 'LP', nombre: 'Lucía Pérez', rol: 'Cliente' },
    pedidos: { ini: 'SB', nombre: 'Sofía Benítez', rol: 'Gestor de pedidos' },
    stock:   { ini: 'DF', nombre: 'Diego Fernández', rol: 'Gestor de stock' }
  };
  var NAV = [
    { id: 'catalogo', label: 'Catálogo', icon: 'catalogo', href: 'catalogo.html', roles: 'anon client pedidos stock admin' },
    { id: 'carrito', label: 'Carrito', icon: 'carrito', href: 'carrito.html', roles: 'client pedidos stock admin', count: true },
    { id: 'mis-pedidos', label: 'Mis pedidos', icon: 'pedidos', href: 'mis-pedidos.html', roles: 'client pedidos stock admin' },
    { id: 'direcciones', label: 'Direcciones', icon: 'direcciones', href: 'direcciones-lista.html', roles: 'client pedidos stock admin' },
    { id: 'cuenta', label: 'Mi cuenta', icon: 'cuenta', href: 'mi-cuenta.html', roles: 'client pedidos stock admin' },
    { sep: true, roles: 'anon' },
    { id: 'ingresar', label: 'Ingresar', icon: 'ingresar', href: 'ingresar.html', roles: 'anon' },
    { id: 'registrarse', label: 'Registrarse', icon: 'registrarse', href: 'registrarse.html', roles: 'anon' },
    { sep: true, roles: 'pedidos admin' },
    { id: 'gestion', label: 'Gestión de pedidos', icon: 'gestion', href: 'gestion-pedidos.html', roles: 'pedidos admin' },
    { group: 'Administración', roles: 'stock admin' },
    { id: 'categorias', label: 'Categorías', icon: 'categorias', href: 'categorias.html', roles: 'admin' },
    { id: 'ingredientes', label: 'Ingredientes', icon: 'ingredientes', href: 'ingredientes.html', roles: 'admin' },
    { id: 'productos', label: 'Productos y stock', icon: 'productos', href: 'productos.html', roles: 'stock admin' },
    { id: 'usuarios', label: 'Usuarios', icon: 'usuarios', href: 'usuarios.html', roles: 'admin' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: 'dashboard.html', roles: 'admin' }
  ];
  function ico(n) { return '<svg class="ico" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }

  function buildNav(role, current, cart) {
    var html = '', open = false;
    function close() { if (open) { html += '</ul>'; open = false; } }
    NAV.forEach(function (it) {
      if (it.roles.split(' ').indexOf(role) === -1) return;
      if (it.sep) { close(); html += '<hr class="nav-sep">'; return; }
      if (it.group) { close(); html += '<p class="nav-group-title"><span>' + it.group + '</span></p>'; return; }
      if (!open) { html += '<ul class="nav-list">'; open = true; }
      var count = it.count && cart > 0 ? '<span class="count" aria-label="' + cart + ' productos">' + cart + '</span>' : '';
      html += '<li><a class="nav-item" href="' + it.href + '"' + (it.id === current ? ' aria-current="page"' : '') + '>' +
        ico(it.icon) + '<span class="nav-label">' + it.label + '</span>' + count + '</a></li>';
    });
    close();
    return html;
  }

  function buildShell() {
    var body = document.body;
    var role = body.getAttribute('data-shell');
    if (!role) return;
    var current = body.getAttribute('data-current') || '';
    var cart = body.hasAttribute('data-cart') ? Number(body.getAttribute('data-cart')) : (role === 'anon' ? 0 : 3);
    var main = document.querySelector('main');
    var u = USERS[role];
    var foot = u ? '<div class="sidebar-foot"><span class="avatar" aria-hidden="true">' + u.ini + '</span>' +
      '<div class="user-meta"><strong>' + u.nombre + '</strong><small>' + u.rol + '</small></div>' +
      '<button class="icon-btn btn-logout" type="button" aria-label="Cerrar sesión">' + ico('salir') + '</button></div>' : '';
    var cartBtn = role === 'anon' ? '<a class="btn btn-ghost btn-sm topbar-link" href="ingresar.html">Ingresar</a>'
      : '<a class="icon-btn" href="carrito.html" aria-label="Carrito' + (cart ? ', ' + cart + ' productos' : '') + '">' + ico('carrito') +
        (cart ? '<span class="count" aria-hidden="true">' + cart + '</span>' : '') + '</a>';

    var shell = document.createElement('div');
    shell.className = 'shell';
    shell.id = 'shell';
    shell.innerHTML =
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-head">' +
          '<a href="catalogo.html" class="sidebar-brand"><img class="sidebar-logo" src="' + DS + 'assets/logo.svg" alt="Food Store">' +
          '<img class="sidebar-mark" src="' + DS + 'assets/favicon.svg" alt="Food Store"></a>' +
          '<button class="icon-btn btn-collapse" id="btn-collapse" type="button" aria-controls="sidebar" aria-expanded="true" aria-label="Colapsar panel">' + ico('panel') + '</button>' +
          '<button class="icon-btn btn-close" id="btn-close" type="button" aria-label="Cerrar menú">' + ico('cerrar') + '</button>' +
        '</div>' +
        '<nav class="sidebar-nav" aria-label="Principal">' + buildNav(role, current, cart) + '</nav>' + foot +
      '</aside><div class="scrim" id="scrim"></div>' +
      '<div class="shell-main">' +
        '<header class="topbar">' +
          '<button class="icon-btn" id="btn-menu" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Abrir menú">' + ico('menu') + '</button>' +
          '<img src="' + DS + 'assets/logo.svg" alt="Food Store">' + cartBtn +
        '</header>' +
      '</div>';
    main.parentNode.insertBefore(shell, main);
    shell.querySelector('.shell-main').appendChild(main);
    document.querySelectorAll('body > [data-after-main]').forEach(function (n) { shell.querySelector('.shell-main').appendChild(n); });

    var sidebar = shell.querySelector('#sidebar');
    var desktop = window.matchMedia('(min-width: 1024px)');
    var collapsed = params.get('nav') === 'collapsed';
    function applyCollapsed() {
      var on = collapsed && desktop.matches;
      sidebar.classList.toggle('is-collapsed', on);
      var b = shell.querySelector('#btn-collapse');
      b.setAttribute('aria-expanded', String(!on));
      b.setAttribute('aria-label', on ? 'Expandir panel' : 'Colapsar panel');
      sidebar.querySelectorAll('.nav-item').forEach(function (a) {
        if (on) a.title = a.querySelector('.nav-label').textContent; else a.removeAttribute('title');
      });
    }
    function setDrawer(open) {
      shell.classList.toggle('drawer-open', open);
      shell.querySelector('#btn-menu').setAttribute('aria-expanded', String(open));
      document.documentElement.style.overflow = open ? 'hidden' : '';
    }
    shell.querySelector('#btn-collapse').addEventListener('click', function () { collapsed = !collapsed; applyCollapsed(); });
    shell.querySelector('#btn-menu').addEventListener('click', function () { setDrawer(true); });
    shell.querySelector('#btn-close').addEventListener('click', function () { setDrawer(false); });
    shell.querySelector('#scrim').addEventListener('click', function () { setDrawer(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });
    applyCollapsed();
    if (params.get('nav') === 'drawer' && !desktop.matches) setDrawer(true);
    requestAnimationFrame(function () { requestAnimationFrame(function () { shell.classList.add('is-ready'); }); });
  }

  /* Encabezado de pagina fijo (D9): un centinela de alto 0 justo antes de la banda indica si ya quedo pegada
     (no depende del alto de la banda, asi el estado compacto no oscila). --band-h = borde inferior de la banda,
     para que las cabeceras de tabla queden fijas debajo. */
  function initBand() {
    var band = document.querySelector('.page-band.is-sticky');
    if (!band) return;
    var s = document.createElement('div');
    s.setAttribute('aria-hidden', 'true');
    band.parentNode.insertBefore(s, band);
    function update() {
      var top = parseFloat(getComputedStyle(band).top) || 0;
      band.classList.toggle('is-stuck', s.getBoundingClientRect().top < top - 1);
      document.documentElement.style.setProperty('--band-h', (top + band.offsetHeight) + 'px');
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    if (window.ResizeObserver) new ResizeObserver(update).observe(band);
    update();
  }

  window.MOCK = { P: P, precio: precio, precioDisplay: precioDisplay, respaldo: respaldo, stockChip: stockChip, tarjeta: tarjeta,
                  grilla: grilla, estado: estado, ico: ico, params: params, DS: DS };

  document.body.insertAdjacentHTML('afterbegin', window.MOCK_SPRITE || '');
  buildShell();
  initBand();
  /* Logo de paginas sin shell */
  document.querySelectorAll('img[data-logo]').forEach(function (img) { img.src = DS + 'assets/' + img.getAttribute('data-logo'); });
})();
