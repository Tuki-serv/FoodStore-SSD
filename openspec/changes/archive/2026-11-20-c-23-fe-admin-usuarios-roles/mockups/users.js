/* Mockups C-23: shell (igual al de C-17a/C-22), datos de usuarios y piezas repetidas. Se carga ANTES de mockup.js. No es código de la app. */
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


  /* ── Datos de ejemplo (nombres visibles = NOMBRE_ROL de frontend/src/shared/config/roles.ts) ── */
  var NOMBRE_ROL = { ADMIN: 'Administrador', STOCK: 'Gestor de stock', PEDIDOS: 'Gestor de pedidos', CLIENT: 'Cliente' };
  var ORDEN = ['ADMIN', 'STOCK', 'PEDIDOS', 'CLIENT'];
  var DESC_ROL = {
    ADMIN: 'Usuarios, catálogo, pedidos y métricas.',
    STOCK: 'Productos y stock.',
    PEDIDOS: 'Gestión y avance de los pedidos.',
    CLIENT: 'Compra en la tienda.'
  };
  var U = {
    ana: { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana.gomez@foodstore.com', celular: '+54 9 11 5555-0101', roles: ['ADMIN', 'CLIENT'], yo: true },
    carla: { id: 2, nombre: 'Carla', apellido: 'Gómez', email: 'carla@example.com', celular: '', roles: ['PEDIDOS', 'STOCK'] },
    diego: { id: 3, nombre: 'Diego', apellido: 'Fernández', email: 'diego.fernandez@example.com', celular: '+54 9 351 555-0142', roles: ['STOCK'] },
    lucia: { id: 4, nombre: 'Lucía', apellido: 'Martínez', email: 'lucia.martinez@example.com', celular: '+54 9 261 555-0177', roles: ['CLIENT'] },
    marcos: { id: 5, nombre: 'Marcos', apellido: 'Peralta', email: 'marcos.peralta@example.com', celular: '', roles: ['ADMIN', 'PEDIDOS'] },
    sofia: { id: 6, nombre: 'Sofía', apellido: 'Benítez', email: 'sofia.benitez@example.com', celular: '+54 9 11 5555-0188', roles: ['CLIENT', 'PEDIDOS'] },
    tomas: { id: 7, nombre: 'Tomás', apellido: 'Ruiz', email: 'tomas.ruiz@example.com', celular: '', roles: ['CLIENT'] },
    valentina: { id: 8, nombre: 'Valentina', apellido: 'Núñez de la Fuente', email: 'valentina.nunez.delafuente@example.com', celular: '+54 9 341 555-0120', roles: ['CLIENT'] }
  };
  var LISTA = [U.ana, U.carla, U.diego, U.lucia, U.marcos, U.sofia, U.tomas, U.valentina];

  /* ── Piezas ── */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function nombreCompleto(u) { return u.nombre + ' ' + u.apellido; }
  function etiquetasRol(roles) {
    return ORDEN.filter(function (r) { return roles.indexOf(r) !== -1; }).map(function (r) {
      return '<li class="badge b-rol b-rol-' + r.toLowerCase() + '">' + NOMBRE_ROL[r] + '</li>';
    }).join('');
  }

  function filaUsuario(u, opts) {
    opts = opts || {};
    var n = nombreCompleto(u);
    return '<li class="urow' + (opts.nuevo || opts.cambio ? ' is-new' : '') + '">' +
      '<div class="iname"><div class="iname-top"><strong>' + n + '</strong>' +
        (u.yo ? '<span class="badge b-vos">Vos</span>' : '') +
        (opts.nuevo ? '<span class="badge b-principal">Nuevo</span>' : '') +
        (opts.cambio ? '<span class="badge b-principal">Actualizado</span>' : '') + '</div>' +
        '<small>' + u.email + '</small></div>' +
      '<ul class="uroles" aria-label="Roles de ' + n + '">' + etiquetasRol(u.roles) + '</ul>' +
      '<span class="ucel">' + (u.celular ? u.celular : '<span aria-label="Sin celular">—</span>') + '</span>' +
      '<div class="crow-actions">' +
        '<button class="btn btn-ghost btn-sm" type="button" aria-label="Editar ' + n + '">' + ico('i-editar') + '<span class="lbl">Editar</span></button>' +
        (u.yo ? '' : '<button class="btn btn-ghost btn-sm btn-del" type="button" aria-label="Desactivar ' + n + '">' + ico('i-basura') + '<span class="lbl">Desactivar</span></button>') +
      '</div></li>';
  }
  function listaUsuarios(items, opts) {
    opts = opts || {};
    return '<ul class="ilist ulist" aria-label="Usuarios">' +
      '<li class="urow uhead" aria-hidden="true"><span>Usuario</span><span>Roles</span><span>Celular</span><span></span></li>' +
      items.map(function (u) { return filaUsuario(u, { nuevo: u.id === opts.nuevoId, cambio: u.id === opts.cambioId }); }).join('') + '</ul>';
  }
  function filtroRol(activo) {
    var opciones = [['', 'Todos']].concat(ORDEN.map(function (r) { return [r, NOMBRE_ROL[r]]; }));
    return '<div class="seg seg-wrap" role="group" aria-label="Filtrar por rol">' + opciones.map(function (o) {
      return '<button type="button" aria-pressed="' + ((activo || '') === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function esqueleto(n) {
    var h = '<div class="skel-rows" aria-busy="true" aria-label="Cargando">';
    for (var k = 0; k < n; k++) h += '<div class="skel-row"><span class="skel sq"></span><span class="ln"><span class="skel skel-line" style="width:' + (30 + (k * 13) % 30) + '%"></span><span class="skel skel-line" style="width:' + (45 + (k * 7) % 25) + '%"></span></span></div>';
    return h + '</div>';
  }
  function estadoVista(tipo, icono, titulo, texto, accion) {
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
  function pager(pagina, total) {
    return '<nav class="pager" aria-label="Paginación de usuarios">' +
      '<button class="btn btn-secondary btn-sm" type="button"' + (pagina === 1 ? ' disabled' : '') + '>Anterior</button>' +
      '<span>Página ' + pagina + ' de ' + total + '</span>' +
      '<button class="btn btn-secondary btn-sm" type="button"' + (pagina === total ? ' disabled' : '') + '>Siguiente</button></nav>';
  }
  function alerta(titulo, texto) {
    return '<div class="form-alert" role="alert">' + ico('i-alerta') + '<div>' + titulo + '<p>' + texto + '</p></div></div>';
  }
  function llenar(id, html) { document.getElementById(id).innerHTML = html; }
  function banner(t) { document.getElementById('banner').textContent = t; }
  function nota(t) { llenar('nota', '<span class="note" title="Anotación del mockup: no se muestra en la app">Anotación · ' + t + '</span>'); }

  window.MOCK = {
    estado: params.get('estado'), modo: params.get('modo'), error: params.get('error'), ico: ico, U: U, LISTA: LISTA,
    NOMBRE_ROL: NOMBRE_ROL, ORDEN: ORDEN, DESC_ROL: DESC_ROL, nombreCompleto: nombreCompleto, esc: esc,
    listaUsuarios: listaUsuarios, filtroRol: filtroRol, esqueleto: esqueleto, estadoVista: estadoVista, dialogo: dialogo,
    toast: toast, pager: pager, alerta: alerta, llenar: llenar, banner: banner, nota: nota
  };
})();
