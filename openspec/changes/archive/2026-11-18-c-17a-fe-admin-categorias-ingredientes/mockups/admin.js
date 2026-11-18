/* Mockups C-17a: arma el shell (igual al de C-15/C-16b) alrededor de <main id="main">, los datos de ejemplo
   (seed de backend/app/db/seed.py) y las piezas repetidas: filas del árbol, filas de ingredientes, diálogo y toast.
   Se carga ANTES de mockup.js (que necesita #shell, #sidebar, etc.). No es código de la app. */
(function () {
  var DS = '../../../../design-system/';
  var params = new URLSearchParams(location.search);

  function ico(name) { return '<svg class="ico" aria-hidden="true"><use href="#' + name + '"/></svg>'; }

  /* ── Shell (panel lateral DD-25, usuaria ADMIN de ejemplo) ── */
  var main = document.getElementById('main');
  document.body.insertAdjacentHTML('afterbegin',
    '<div class="shell" id="shell">' +
    '<aside class="sidebar" id="sidebar">' +
      '<div class="sidebar-head">' +
        '<img class="sidebar-logo" src="' + DS + 'assets/logo.svg" alt="Food Store (logo provisional)">' +
        '<button class="icon-btn btn-collapse" id="btn-collapse" type="button" aria-controls="sidebar" aria-expanded="true" aria-label="Colapsar panel">' + ico('i-panel') + '</button>' +
        '<button class="icon-btn btn-close" id="btn-close" type="button" aria-label="Cerrar menú">' + ico('i-cerrar') + '</button>' +
      '</div>' +
      '<nav class="sidebar-nav" id="sidebar-nav" aria-label="Principal"></nav>' +
      '<div class="sidebar-foot">' +
        '<span class="avatar" aria-hidden="true">AG</span>' +
        '<div class="user-meta"><strong>Ana Gómez</strong><small>ADMIN</small></div>' +
        '<button class="icon-btn btn-logout" type="button" aria-label="Cerrar sesión">' + ico('i-salir') + '</button>' +
      '</div>' +
    '</aside>' +
    '<div class="scrim" id="scrim"></div>' +
    '<div class="shell-main" id="shell-main">' +
      '<div class="banner" id="banner"></div>' +
      '<header class="topbar">' +
        '<button class="icon-btn" id="btn-menu" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Abrir menú">' + ico('i-menu') + '</button>' +
        '<img src="' + DS + 'assets/logo.svg" alt="Food Store (logo provisional)">' +
        '<a class="icon-btn" href="#/carrito" aria-label="Carrito">' + ico('i-carrito') + '</a>' +
      '</header>' +
    '</div></div>');
  document.getElementById('shell-main').appendChild(main);

  /* ── Datos (seed) ── */
  var ARBOL = [
    { id: 2, nombre: 'Bebidas', descripcion: 'Frías y calientes', subcategorias: [
      { id: 6, nombre: 'Gaseosas', descripcion: 'Bebidas con gas', subcategorias: [] }] },
    { id: 1, nombre: 'Hamburguesas', descripcion: 'Nuestras burgers artesanales', subcategorias: [
      { id: 5, nombre: 'Sin TACC', descripcion: 'Libres de gluten', subcategorias: [] },
      { id: 4, nombre: 'Veganas', descripcion: '100% plant-based', subcategorias: [] }] },
    { id: 3, nombre: 'Postres', descripcion: 'Para cerrar con dulzura', subcategorias: [] }
  ];
  var CLASICA = 'Hamburguesa Clásica', BBQ = 'Burger BBQ Bacon', VEG = 'Burger Vegana', TACC = 'Burger Sin TACC';
  var ING = [
    { nombre: 'Pan Brioche', desc: 'Pan suave y esponjoso', al: true, u: 'Unidad (u)', prods: [CLASICA, BBQ, VEG] },
    { nombre: 'Pan Sin TACC', desc: 'Pan libre de gluten', al: false, u: 'Unidad (u)', prods: [TACC] },
    { nombre: 'Carne Vacuna 250g', desc: 'Medallón de res premium', al: false, u: 'Unidad (u)', prods: [CLASICA, BBQ, TACC] },
    { nombre: 'Medallón Vegano', desc: 'Base de legumbres y avena', al: false, u: 'Unidad (u)', prods: [VEG] },
    { nombre: 'Queso Cheddar', desc: 'Cheddar fundido americano', al: true, u: 'Unidad (u)', prods: [CLASICA, BBQ, TACC] },
    { nombre: 'Queso Vegano', desc: 'Alternativa plant-based', al: false, u: 'Unidad (u)', prods: [VEG] },
    { nombre: 'Lechuga', desc: 'Lechuga fresca', al: false, u: 'Unidad (u)', prods: [CLASICA, VEG, TACC] },
    { nombre: 'Tomate', desc: 'Tomate perita en rodajas', al: false, u: 'Unidad (u)', prods: [CLASICA, VEG, TACC] },
    { nombre: 'Cebolla Caramelizada', desc: 'Cebolla dulce', al: false, u: 'Unidad (u)', prods: [BBQ] },
    { nombre: 'Bacon Crocante', desc: 'Panceta ahumada', al: false, u: 'Unidad (u)', prods: [BBQ] },
    { nombre: 'Salsa BBQ', desc: 'Salsa ahumada casera', al: false, u: 'Unidad (u)', prods: [BBQ] },
    { nombre: 'Mayonesa', desc: 'Mayo artesanal', al: true, u: 'Unidad (u)', prods: [CLASICA] }
  ];
  var UNIDADES = ['Kilogramo (kg)', 'Gramo (g)', 'Litro (L)', 'Mililitro (mL)', 'Unidad (u)', 'Docena (doc)', 'Metro cuadrado (m²)'];

  /* ── Piezas ── */
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  function filaCategoria(c, nuevoId) {
    var n = c.subcategorias.length;
    return '<div class="crow' + (c.id === nuevoId ? ' is-new' : '') + '">' +
      '<span class="crow-ico" aria-hidden="true">' + ico('i-categorias') + '</span>' +
      '<div class="crow-body"><div class="crow-title"><strong>' + c.nombre + '</strong>' +
        (n ? '<span class="badge b-neutral">' + plural(n, 'subcategoría', 'subcategorías') + '</span>' : '') +
        (c.id === nuevoId ? '<span class="badge b-principal">Nueva</span>' : '') + '</div>' +
        '<span class="crow-desc">' + c.descripcion + '</span></div>' +
      '<div class="crow-actions">' +
        '<button class="btn btn-ghost btn-sm" type="button" aria-label="Agregar subcategoría a ' + c.nombre + '">' + ico('i-subcategoria') + '<span class="lbl">Subcategoría</span></button>' +
        '<button class="btn btn-ghost btn-sm" type="button" aria-label="Editar ' + c.nombre + '">' + ico('i-editar') + '<span class="lbl">Editar</span></button>' +
        '<button class="btn btn-ghost btn-sm btn-del" type="button" aria-label="Eliminar ' + c.nombre + '">' + ico('i-basura') + '<span class="lbl">Eliminar</span></button>' +
      '</div></div>';
  }
  function arbol(nodos, nuevoId, raiz) {
    return '<ul' + (raiz ? ' class="ctree" aria-label="Árbol de categorías"' : '') + '>' + nodos.map(function (c) {
      return '<li>' + filaCategoria(c, nuevoId) + (c.subcategorias.length ? arbol(c.subcategorias, nuevoId, false) : '') + '</li>';
    }).join('') + '</ul>';
  }
  function contar(nodos) { return nodos.reduce(function (a, c) { return a + 1 + contar(c.subcategorias); }, 0); }

  function filaIngrediente(i) {
    var uso = i.prods.length ? 'Usado en <strong>' + i.prods.length + '</strong> ' + (i.prods.length === 1 ? 'producto' : 'productos') : 'Sin productos';
    return '<li class="irow' + (i.nuevo ? ' is-new' : '') + '">' +
      '<div class="iname"><div class="iname-top"><strong>' + i.nombre + '</strong>' +
        (i.al ? '<span class="badge b-alergeno">' + ico('i-alergeno') + 'Alérgeno</span>' : '') +
        (i.nuevo ? '<span class="badge b-principal">Nuevo</span>' : '') + '</div>' +
        '<small>' + i.desc + '</small></div>' +
      '<div class="imeta"><span class="iunit">' + i.u + '</span><span class="iuse">' + uso + '</span></div>' +
      '<div class="crow-actions">' +
        '<button class="btn btn-ghost btn-sm" type="button" aria-label="Editar ' + i.nombre + '">' + ico('i-editar') + '<span class="lbl">Editar</span></button>' +
        '<button class="btn btn-ghost btn-sm btn-del" type="button" aria-label="Eliminar ' + i.nombre + '">' + ico('i-basura') + '<span class="lbl">Eliminar</span></button>' +
      '</div></li>';
  }
  function listaIngredientes(items) {
    return '<ul class="ilist" aria-label="Ingredientes">' +
      '<li class="irow ihead" aria-hidden="true"><span>Ingrediente</span><span>Unidad</span><span>Uso</span><span></span></li>' +
      items.map(filaIngrediente).join('') + '</ul>';
  }
  function esqueleto(n) {
    var h = '<div class="skel-rows" aria-busy="true" aria-label="Cargando">';
    for (var k = 0; k < n; k++) h += '<div class="skel-row"><span class="skel sq"></span><span class="ln"><span class="skel skel-line" style="width:' + (30 + (k * 13) % 30) + '%"></span><span class="skel skel-line" style="width:' + (45 + (k * 7) % 25) + '%"></span></span></div>';
    return h + '</div>';
  }
  function estado(tipo, icono, titulo, texto, accion) {
    return '<div class="state empty' + (tipo === 'error' ? ' is-error' : '') + '"' + (tipo === 'error' ? ' role="alert"' : '') + '>' +
      '<span class="badge-ico" aria-hidden="true">' + ico(icono) + '</span><h2>' + titulo + '</h2><p>' + texto + '</p>' + (accion || '') + '</div>';
  }
  function dialogo(html) {
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-titulo">' + html + '</div></div>');
  }
  function toast(titulo, texto) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toasts" aria-live="polite"><div class="toast t-success" role="status"><div><strong>' + titulo + '</strong>' + texto + '</div>' +
      '<button class="icon-btn" type="button" aria-label="Cerrar notificación">' + ico('i-cerrar') + '</button></div></div>');
  }
  function opcionesPadre(excluir, elegido) {
    var h = '<option value="">Sin padre (categoría raíz)</option>';
    (function rec(nodos, nivel) {
      nodos.forEach(function (c) {
        if (excluir.indexOf(c.id) !== -1) return;
        h += '<option value="' + c.id + '"' + (c.id === elegido ? ' selected' : '') + '>' + new Array(nivel + 1).join('— ') + c.nombre + '</option>';
        rec(c.subcategorias, nivel + 1);
      });
    })(ARBOL, 0);
    return h;
  }
  function opcionesUnidad(elegida) {
    return UNIDADES.map(function (u) { return '<option' + (u === elegida ? ' selected' : '') + '>' + u + '</option>'; }).join('');
  }
  function llenar(id, html) { document.getElementById(id).innerHTML = html; }
  function banner(t) { document.getElementById('banner').textContent = t; }

  window.MOCK = {
    estado: params.get('estado'), modo: params.get('modo'), ico: ico,
    ARBOL: ARBOL, ING: ING, arbol: function (nuevoId) { return arbol(ARBOL, nuevoId, true); }, contar: contar,
    listaIngredientes: listaIngredientes, esqueleto: esqueleto, estadoVista: estado, dialogo: dialogo, toast: toast,
    opcionesPadre: opcionesPadre, opcionesUnidad: opcionesUnidad, llenar: llenar, banner: banner
  };
})();
