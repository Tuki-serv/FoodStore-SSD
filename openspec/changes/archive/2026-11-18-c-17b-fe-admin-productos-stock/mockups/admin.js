/* Mockups C-17b: arma el shell (igual al de C-15/C-16b/C-17a) alrededor de <main id="main">, los datos de ejemplo
   (seed de backend/app/db/seed.py) y las piezas repetidas: filas de productos, filas de ingredientes, diálogo y toast.
   ?rol=stock muestra la vista del rol STOCK (sin ADMIN). Se carga ANTES de mockup.js. No es código de la app. */
(function () {
  var DS = '../../../../design-system/';
  var params = new URLSearchParams(location.search);
  var ROL = params.get('rol') === 'stock' ? 'STOCK' : 'ADMIN';
  document.body.setAttribute('data-roles', ROL);
  if (ROL === 'STOCK') document.body.classList.add('rol-stock');

  function ico(name) { return '<svg class="ico" aria-hidden="true"><use href="#' + name + '"/></svg>'; }

  /* ── Shell (panel lateral DD-25) ── */
  var main = document.getElementById('main');
  var usuario = ROL === 'STOCK' ? ['GS', 'Gestor Stock', 'STOCK'] : ['AG', 'Ana Gómez', 'ADMIN'];
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
        '<span class="avatar" aria-hidden="true">' + usuario[0] + '</span>' +
        '<div class="user-meta"><strong>' + usuario[1] + '</strong><small>' + usuario[2] + '</small></div>' +
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
    { id: 2, nombre: 'Bebidas', subcategorias: [{ id: 6, nombre: 'Gaseosas', subcategorias: [] }] },
    { id: 1, nombre: 'Hamburguesas', subcategorias: [{ id: 5, nombre: 'Sin TACC', subcategorias: [] }, { id: 4, nombre: 'Veganas', subcategorias: [] }] },
    { id: 3, nombre: 'Postres', subcategorias: [] }
  ];
  var PRODUCTOS = [
    { id: 1, nombre: 'Hamburguesa Clásica', cat: 'Hamburguesas', precio: '$ 1.500', stock: 50, disp: true, ings: 6, al: 3 },
    { id: 2, nombre: 'Burger BBQ Bacon', cat: 'Hamburguesas', precio: '$ 1.900', stock: 30, disp: true, ings: 6, al: 2 },
    { id: 3, nombre: 'Burger Vegana', cat: 'Hamburguesas', extra: 'Veganas', precio: '$ 1.800', stock: 25, disp: true, ings: 5, al: 1 },
    { id: 4, nombre: 'Burger Sin TACC', cat: 'Hamburguesas', extra: 'Sin TACC', precio: '$ 1.700', stock: 4, disp: true, ings: 5, al: 1 },
    { id: 5, nombre: 'Coca-Cola 500ml', cat: 'Bebidas', extra: 'Gaseosas', precio: '$ 800', stock: 100, disp: true, ings: 0, al: 0 },
    { id: 6, nombre: 'Limonada Natural', cat: 'Bebidas', precio: '$ 700', stock: 0, disp: false, ings: 0, al: 0 }
  ];
  var INGREDIENTES = [
    ['Pan Brioche', true, 'Unidad (u)'], ['Pan Sin TACC', false, 'Unidad (u)'], ['Carne Vacuna 250g', false, 'Unidad (u)'],
    ['Medallón Vegano', false, 'Unidad (u)'], ['Queso Cheddar', true, 'Unidad (u)'], ['Queso Vegano', false, 'Unidad (u)'],
    ['Lechuga', false, 'Unidad (u)'], ['Tomate', false, 'Unidad (u)'], ['Cebolla Caramelizada', false, 'Unidad (u)'],
    ['Bacon Crocante', false, 'Unidad (u)'], ['Salsa BBQ', false, 'Unidad (u)'], ['Mayonesa', true, 'Unidad (u)'], ['Maní', true, 'Gramo (g)']
  ];
  var UNIDADES = ['Kilogramo (kg)', 'Gramo (g)', 'Litro (L)', 'Mililitro (mL)', 'Unidad (u)', 'Docena (doc)', 'Metro cuadrado (m²)'];

  /* ── Piezas ── */
  function marcaStock(n) {
    if (n <= 0) return '<span class="badge b-cancelado">Agotado</span>';
    if (n <= 5) return '<span class="stock-low">Quedan ' + n + '</span>';
    return '';
  }
  /* estados de fila: { stock: 'editado'|'error'|'guardando', valor, disp: 'guardando' } */
  function filaProducto(p, est) {
    est = est || {};
    var sid = 'stock-' + p.id, valor = est.valor !== undefined ? est.valor : String(p.stock);
    var invalido = est.stock === 'error';
    var btnStock = est.stock === 'guardando'
      ? '<button class="btn btn-primary btn-sm" type="button" disabled aria-label="Guardando stock de ' + p.nombre + '">Guardando…</button>'
      : '<button class="btn ' + (est.stock ? 'btn-primary' : 'btn-secondary') + ' btn-sm" type="button"' + (est.stock ? '' : ' disabled') + ' aria-label="Guardar stock de ' + p.nombre + '">' + ico('i-guardar') + '<span class="lbl">Guardar</span></button>';
    var dispOcupado = est.disp === 'guardando';
    var dispOn = est.dispValor !== undefined ? est.dispValor : p.disp;
    return '<li class="prow' + (p.disp ? '' : ' is-off') + (est.nuevo ? ' is-new' : '') + '">' +
      '<div class="pname"><div class="iname-top"><strong>' + p.nombre + '</strong>' +
        (est.nuevo ? '<span class="badge b-principal">Nuevo</span>' : '') +
        (p.al ? '<span class="badge b-alergeno">' + ico('i-alergeno') + p.al + (p.al === 1 ? ' alérgeno' : ' alérgenos') + '</span>' : '') + '</div>' +
        '<small>' + p.cat + (p.extra ? ' · ' + p.extra : '') + ' · ' + (p.ings ? p.ings + ' ingredientes' : 'sin ingredientes') + '</small></div>' +
      '<div class="pprice">' + p.precio + '</div>' +
      '<div class="pstock"><label class="sr-only" for="' + sid + '">Stock de ' + p.nombre + '</label>' +
        '<span class="stock-tag" aria-hidden="true">Stock</span>' +
        '<div class="stock-edit"><input id="' + sid + '" class="input input-sm" type="number" inputmode="numeric" min="0" step="1" value="' + valor + '"' +
          (invalido ? ' aria-invalid="true" aria-describedby="' + sid + '-err"' : '') + (est.stock === 'guardando' ? ' disabled' : '') + '>' + btnStock + '</div>' +
        (invalido ? '<span class="err" id="' + sid + '-err">' + (est.msg || 'Ingresá un número entero desde 0.') + '</span>' : '<span class="pmark">' + marcaStock(p.stock) + '</span>') +
      '</div>' +
      '<div class="pdisp"><label class="switch' + (dispOcupado ? ' is-busy' : '') + '"><input type="checkbox" role="switch"' + (dispOn ? ' checked' : '') + (dispOcupado ? ' disabled' : '') +
        ' aria-label="Disponible: ' + p.nombre + '"><span>' + (dispOcupado ? 'Guardando…' : (dispOn ? 'Disponible' : 'No disponible')) + '</span></label></div>' +
      (ROL === 'ADMIN' ? '<div class="crow-actions">' +
        '<button class="btn btn-ghost btn-sm" type="button" aria-label="Editar ' + p.nombre + '">' + ico('i-editar') + '<span class="lbl">Editar</span></button>' +
        '<button class="btn btn-ghost btn-sm btn-del" type="button" aria-label="Eliminar ' + p.nombre + '">' + ico('i-basura') + '<span class="lbl">Eliminar</span></button>' +
      '</div>' : '') + '</li>';
  }
  function listaProductos(items, estados) {
    estados = estados || {};
    return '<ul class="plist" aria-label="Productos">' +
      '<li class="prow phead" aria-hidden="true"><span>Producto</span><span>Precio</span><span>Stock</span><span>Disponibilidad</span>' + (ROL === 'ADMIN' ? '<span></span>' : '') + '</li>' +
      items.map(function (p) { return filaProducto(p, estados[p.id]); }).join('') + '</ul>';
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
  function toast(titulo, texto, tipo) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toasts" aria-live="polite"><div class="toast ' + (tipo === 'error' ? 't-error' : 't-success') + '" role="status"><div><strong>' + titulo + '</strong>' + texto + '</div>' +
      '<button class="icon-btn" type="button" aria-label="Cerrar notificación">' + ico('i-cerrar') + '</button></div></div>');
  }
  function opcionesCategoria(elegida, primera) {
    var h = '<option value="">' + (primera || 'Todas las categorías') + '</option>';
    (function rec(nodos, nivel) {
      nodos.forEach(function (c) {
        h += '<option' + (c.nombre === elegida ? ' selected' : '') + '>' + new Array(nivel + 1).join('— ') + c.nombre + '</option>';
        rec(c.subcategorias, nivel + 1);
      });
    })(ARBOL, 0);
    return h;
  }
  /* Casillas de categorías en orden de árbol: marcadas = nombres */
  function casillasCategorias(marcadas) {
    var h = '<ul class="catpick">';
    (function rec(nodos, nivel) {
      nodos.forEach(function (c) {
        var on = marcadas.indexOf(c.nombre) !== -1;
        h += '<li style="--nivel:' + nivel + '"><label class="mini-check' + (on ? ' is-on' : '') + '"><input type="checkbox"' + (on ? ' checked' : '') + '><span>' + c.nombre + '</span></label></li>';
        rec(c.subcategorias, nivel + 1);
      });
    })(ARBOL, 0);
    return h + '</ul>';
  }
  function opcionesIngrediente(elegido) {
    return '<option value="">Elegí un ingrediente</option>' + INGREDIENTES.map(function (i) {
      return '<option' + (i[0] === elegido ? ' selected' : '') + '>' + i[0] + (i[1] ? ' (alérgeno)' : '') + '</option>';
    }).join('');
  }
  function opcionesUnidad(elegida) {
    return UNIDADES.map(function (u) { return '<option' + (u === elegida ? ' selected' : '') + '>' + u + '</option>'; }).join('');
  }
  function unidadDe(nombre) { for (var k = 0; k < INGREDIENTES.length; k++) if (INGREDIENTES[k][0] === nombre) return INGREDIENTES[k][2]; return 'Unidad (u)'; }
  function esAlergeno(nombre) { for (var k = 0; k < INGREDIENTES.length; k++) if (INGREDIENTES[k][0] === nombre) return INGREDIENTES[k][1]; return false; }
  /* Fila editable de ingrediente del producto: [nombre, cantidad, removible, error?] */
  function filaIngProducto(f, k) {
    var id = 'ing-' + k, al = esAlergeno(f[0]);
    return '<li class="pirow' + (f[3] ? ' has-err' : '') + '">' +
      '<div class="field pi-ing"><div class="label-row"><label for="' + id + '">Ingrediente ' + (k + 1) + '</label>' + (al ? '<span class="pi-al">' + ico('i-alergeno') + 'Alérgeno</span>' : '') + '</div>' +
        '<select id="' + id + '" class="input"' + (f[3] ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : '') + '>' + opcionesIngrediente(f[0]) + '</select>' +
        (f[3] ? '<span class="err" id="' + id + '-err">' + f[3] + '</span>' : '') + '</div>' +
      '<div class="field pi-cant"><label for="' + id + '-c">Cantidad</label><input id="' + id + '-c" class="input" inputmode="decimal" value="' + f[1] + '"></div>' +
      '<div class="field pi-uni"><label for="' + id + '-u">Unidad</label><select id="' + id + '-u" class="input">' + opcionesUnidad(unidadDe(f[0])) + '</select></div>' +
      '<label class="mini-check pi-rem' + (f[2] ? ' is-on' : '') + '"><input type="checkbox"' + (f[2] ? ' checked' : '') + '><span>Se puede quitar</span></label>' +
      '<button class="icon-btn pi-del" type="button" aria-label="Quitar ' + (f[0] || 'ingrediente ' + (k + 1)) + '">' + ico('i-basura') + '</button>' +
    '</li>';
  }
  function filasIngProducto(filas) {
    return '<ul class="pilist" aria-label="Ingredientes del producto">' + filas.map(filaIngProducto).join('') + '</ul>';
  }
  function llenar(id, html) { document.getElementById(id).innerHTML = html; }
  function banner(t) { document.getElementById('banner').textContent = t + ' · ' + ROL + ' · Revision 2 · pendiente de aprobación'; }
  function nota(t) { llenar('nota', '<span class="note" title="Anotación del mockup: no se muestra en la app">Anotación · ' + t + '</span>'); }

  window.MOCK = {
    estado: params.get('estado'), modo: params.get('modo'), rol: ROL, ico: ico,
    PRODUCTOS: PRODUCTOS, INGREDIENTES: INGREDIENTES, listaProductos: listaProductos, esqueleto: esqueleto, estadoVista: estado,
    dialogo: dialogo, toast: toast, opcionesCategoria: opcionesCategoria, casillasCategorias: casillasCategorias,
    filasIngProducto: filasIngProducto, opcionesUnidad: opcionesUnidad, llenar: llenar, banner: banner, nota: nota
  };
})();
