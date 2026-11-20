/* Mockups C-22: arma el shell (igual al de C-17b) alrededor de <main id="main">, los datos de ejemplo y las piezas de la
   gestión de pedidos: fila del listado, detalle, línea de tiempo, diálogos y toast. Se carga ANTES de mockup.js.
   ?rol=pedidos (por defecto, «Carla Ruiz») | admin («Laura Méndez») | client («Ana López» → «Sin permiso»). No es código de la app. */
(function () {
  var DS = '../../../../design-system/';
  var params = new URLSearchParams(location.search);
  var rolParam = (params.get('rol') || 'pedidos').toLowerCase();
  var ROL = rolParam === 'admin' ? 'ADMIN' : rolParam === 'client' ? 'CLIENT' : 'PEDIDOS';
  document.body.setAttribute('data-roles', ROL);
  document.body.setAttribute('data-current', ROL === 'CLIENT' ? '' : 'gestion-pedidos');

  function ico(name) { return '<svg class="ico" aria-hidden="true"><use href="#' + name + '"/></svg>'; }

  /* ── Shell (panel lateral DD-25) ── */
  var main = document.getElementById('main');
  var USUARIOS = { PEDIDOS: ['CR', 'Carla Ruiz', 'PEDIDOS'], ADMIN: ['LM', 'Laura Méndez', 'ADMIN'], CLIENT: ['AL', 'Ana López', 'CLIENT'] };
  var usuario = USUARIOS[ROL];
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

  /* ── Formato ── */
  function precio(n) { return '$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  var ESTADOS = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', EN_PREP: 'En preparación', EN_CAMINO: 'En camino', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' };
  function clase(e) { return e.toLowerCase().replace(/_/g, '-'); }
  function badge(e) { return '<span class="badge b-' + clase(e) + '">' + ESTADOS[e] + '</span>'; }
  var FORMAS = { MERCADOPAGO: ['Tarjeta (Mercado Pago)', 'i-tarjeta'], EFECTIVO: ['Efectivo', 'i-efectivo'], TRANSFERENCIA: ['Transferencia bancaria', 'i-transferencia'] };
  function pago(f) { return '<span class="pay-lbl">' + ico(FORMAS[f][1]) + FORMAS[f][0] + '</span>'; }

  /* ── Espejo de la FSM para gestión (design D3) ── */
  function acciones(estado, forma) {
    var a = [];
    if (estado === 'PENDIENTE' && forma !== 'MERCADOPAGO') a.push({ destino: 'CONFIRMADO', etiqueta: 'Confirmar pago', tipo: 'confirmar-pago', icono: 'i-ok' });
    if (estado === 'CONFIRMADO') a.push({ destino: 'EN_PREP', etiqueta: 'Pasar a preparación', tipo: 'avance', icono: 'i-plato' });
    if (estado === 'EN_PREP') a.push({ destino: 'EN_CAMINO', etiqueta: 'Despachar', tipo: 'avance', icono: 'i-moto' });
    if (estado === 'EN_CAMINO') a.push({ destino: 'ENTREGADO', etiqueta: 'Marcar entregado', tipo: 'avance', icono: 'i-ok' });
    if (estado === 'PENDIENTE' || estado === 'CONFIRMADO' || estado === 'EN_PREP') a.push({ destino: 'CANCELADO', etiqueta: 'Cancelar pedido', tipo: 'cancelar' });
    return a;
  }
  function proximoAvance(estado, forma) { return acciones(estado, forma).filter(function (x) { return x.tipo !== 'cancelar'; })[0] || null; }

  /* ── Datos de ejemplo (productos del seed; envío fijo $ 50, DD-10) ── */
  var CASA_ANA = { alias: 'Casa', linea1: 'Av. Siempre Viva 742', linea2: 'Timbre 2', ciudad: 'Springfield', provincia: 'Buenos Aires', cp: '1636' };
  var PEDIDOS = {
    58: { id: 58, cliente: 'Ana López', forma: 'EFECTIVO', estado: 'PENDIENTE', fecha: '19/11/2026', hora: '12:40',
      items: [[2, 'Hamburguesa Clásica', 1500, 'Sin cebolla'], [1, 'Coca-Cola 500ml', 800]], dir: CASA_ANA,
      nota: 'Tocar timbre 2, el 1 no anda.',
      hist: [[null, 'PENDIENTE', 'Ana López', '19/11/2026 12:40', 'Pedido creado']] },
    57: { id: 57, cliente: 'Bruno Díaz', forma: 'MERCADOPAGO', estado: 'CONFIRMADO', fecha: '19/11/2026', hora: '12:31',
      items: [[1, 'Burger BBQ Bacon', 1900], [1, 'Burger Vegana', 1800, 'Sin queso vegano'], [2, 'Coca-Cola 500ml', 800]], dir: null,
      nota: 'Paso a buscarlo 13:15. Sin cubiertos, por favor.',
      hist: [[null, 'PENDIENTE', 'Bruno Díaz', '19/11/2026 12:31', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', null, '19/11/2026 12:33', 'Pago aprobado por Mercado Pago']] },
    56: { id: 56, cliente: 'Carmen Vega', forma: 'TRANSFERENCIA', estado: 'PENDIENTE', fecha: '19/11/2026', hora: '12:22', items: [[1, 'Burger Sin TACC', 1700], [1, 'Coca-Cola 500ml', 800]] },
    55: { id: 55, cliente: 'Diego Ramos', forma: 'MERCADOPAGO', estado: 'PENDIENTE', fecha: '19/11/2026', hora: '12:15',
      items: [[1, 'Hamburguesa Clásica', 1500], [1, 'Burger Vegana', 1800]], dir: { alias: 'Trabajo', linea1: 'Belgrano 455', linea2: 'Oficina 3', ciudad: 'Springfield', provincia: 'Buenos Aires', cp: '1636' },
      hist: [[null, 'PENDIENTE', 'Diego Ramos', '19/11/2026 12:15', 'Pedido creado']] },
    54: { id: 54, cliente: 'Elena Torres', forma: 'EFECTIVO', estado: 'EN_PREP', fecha: '19/11/2026', hora: '11:58',
      items: [[2, 'Burger BBQ Bacon', 1900, 'Sin salsa BBQ'], [1, 'Burger Sin TACC', 1700], [3, 'Coca-Cola 500ml', 800]],
      dir: { alias: 'Depto', linea1: 'Mitre 1280', linea2: 'Piso 4, depto. C', ciudad: 'Springfield', provincia: 'Buenos Aires', cp: '1636' },
      hist: [[null, 'PENDIENTE', 'Elena Torres', '19/11/2026 11:58', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', 'Carla Ruiz', '19/11/2026 12:02', 'Paga en efectivo al recibir'], ['CONFIRMADO', 'EN_PREP', 'Carla Ruiz', '19/11/2026 12:05', 'Sale en 20 min']] },
    53: { id: 53, cliente: 'Facundo Gil', forma: 'MERCADOPAGO', estado: 'EN_CAMINO', fecha: '19/11/2026', hora: '11:20',
      items: [[1, 'Hamburguesa Clásica', 1500], [1, 'Burger BBQ Bacon', 1900, 'Sin bacon crocante']],
      dir: { alias: 'Casa', linea1: 'San Martín 1234', linea2: '', ciudad: 'Springfield', provincia: 'Buenos Aires', cp: '1636' },
      hist: [[null, 'PENDIENTE', 'Facundo Gil', '19/11/2026 11:20', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', null, '19/11/2026 11:21', 'Pago aprobado por Mercado Pago'], ['CONFIRMADO', 'EN_PREP', 'Carla Ruiz', '19/11/2026 11:25', null], ['EN_PREP', 'EN_CAMINO', 'Laura Méndez', '19/11/2026 11:50', 'Sale con Joaquín (moto 2)']] },
    52: { id: 52, cliente: 'Gabriela Sosa', forma: 'TRANSFERENCIA', estado: 'ENTREGADO', fecha: '19/11/2026', hora: '10:42',
      items: [[2, 'Burger Vegana', 1800], [1, 'Coca-Cola 500ml', 800]],
      dir: { alias: 'Casa', linea1: 'Rivadavia 300', linea2: 'PB', ciudad: 'Springfield', provincia: 'Buenos Aires', cp: '1636' },
      hist: [[null, 'PENDIENTE', 'Gabriela Sosa', '19/11/2026 10:42', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', 'Carla Ruiz', '19/11/2026 10:50', 'Transferencia acreditada'], ['CONFIRMADO', 'EN_PREP', 'Carla Ruiz', '19/11/2026 10:51', null], ['EN_PREP', 'EN_CAMINO', 'Carla Ruiz', '19/11/2026 11:10', null], ['EN_CAMINO', 'ENTREGADO', 'Carla Ruiz', '19/11/2026 11:32', null]] },
    51: { id: 51, cliente: 'Hernán Paz', forma: 'EFECTIVO', estado: 'CANCELADO', fecha: '19/11/2026', hora: '10:05',
      items: [[1, 'Hamburguesa Clásica', 1500], [1, 'Limonada Natural', 700]], dir: CASA_ANA,
      hist: [[null, 'PENDIENTE', 'Hernán Paz', '19/11/2026 10:05', 'Pedido creado'], ['PENDIENTE', 'CANCELADO', 'Carla Ruiz', '19/11/2026 10:40', 'El cliente no responde']] }
  };
  function totales(p) { var s = p.items.reduce(function (a, i) { return a + i[0] * i[2]; }, 0); return { sub: s, envio: 50, desc: 0, total: s + 50 }; }
  function pedido(id, cambios) { var p = PEDIDOS[id], c = {}; for (var k in p) c[k] = p[k]; for (k in (cambios || {})) c[k] = cambios[k]; return c; }

  /* ── Marca de actualización (MarcaActualizacion, D6) ── */
  function marca(opts) {
    opts = opts || {};
    var btn = opts.girando
      ? '<button class="btn btn-secondary btn-sm" type="button" disabled aria-busy="true"><span class="spin" aria-hidden="true"></span>Actualizando…</button>'
      : '<button class="btn btn-secondary btn-sm" type="button">' + ico('i-reintentar') + 'Actualizar</button>';
    return '<div class="refresh"><span class="when" aria-live="polite">' + ico('i-reloj') + 'Actualizado a las ' + (opts.hora || '12:41') + '</span>' + btn + '</div>';
  }

  /* ── Listado ── */
  function fila(p, est) {
    est = est || {};
    var t = totales(p), acc = proximoAvance(p.estado, p.forma), accion;
    if (acc) accion = '<button class="btn ' + (acc.tipo === 'confirmar-pago' ? 'btn-primary' : 'btn-secondary') + ' btn-sm" type="button" aria-label="' + acc.etiqueta + ' el pedido #' + p.id + '">' + ico(acc.icono) + acc.etiqueta + '</button>';
    else if (p.estado === 'PENDIENTE' && p.forma === 'MERCADOPAGO') accion = '<span class="none">Espera el pago en Mercado Pago</span>';
    else accion = '<span class="none dash" aria-label="Sin acciones">—</span>';
    return '<li class="orow' + (est.nuevo ? ' is-new' : '') + '">' +
      '<div class="onum"><a href="gestion-pedido-detalle.html?id=' + p.id + '">#' + p.id + '</a><small>' + p.fecha.slice(0, 5) + ' · ' + p.hora + '</small></div>' +
      '<div class="ocli">' + p.cliente + '</div>' +
      '<div class="opay">' + pago(p.forma) + '</div>' +
      '<div class="ototal">' + precio(t.total) + '</div>' +
      '<div class="ostate">' + badge(p.estado) + '</div>' +
      '<div class="oact">' + accion + '</div></li>';
  }
  function lista(items, estados, stale) {
    estados = estados || {};
    return '<ul class="olist' + (stale ? ' is-stale' : '') + '" aria-label="Pedidos">' +
      '<li class="orow ohead" aria-hidden="true"><span>Pedido</span><span>Cliente</span><span>Forma de pago</span><span class="r">Total</span><span>Estado</span><span class="r">Próxima acción</span></li>' +
      items.map(function (p) { return fila(p, estados[p.id]); }).join('') + '</ul>';
  }
  function esqueletoLista(n) {
    var h = '<div class="olist" aria-busy="true" aria-label="Cargando pedidos">';
    for (var k = 0; k < n; k++) h += '<div class="skel-orow"><span class="skel" style="width:70%"></span><span class="skel" style="width:' + (50 + (k * 13) % 30) + '%"></span><span class="skel" style="width:60%"></span><span class="skel" style="width:80%"></span><span class="skel p"></span><span class="skel b"></span></div>';
    return h + '</div>';
  }
  function paginacion(page, pages) {
    return '<nav class="pager" aria-label="Paginación de pedidos">' +
      '<button class="btn btn-secondary btn-sm" type="button"' + (page <= 1 ? ' disabled' : '') + '>Anterior</button>' +
      '<span>Página ' + page + ' de ' + pages + '</span>' +
      '<button class="btn btn-secondary btn-sm" type="button"' + (page >= pages ? ' disabled' : '') + '>Siguiente</button></nav>';
  }

  /* ── Detalle ── */
  function entrega(p) {
    if (!p.dir) return '<span class="pay-lbl">' + ico('i-tienda') + 'Retiro en el local</span>';
    var d = p.dir;
    return '<div class="deliv"><strong>' + d.alias + '</strong><span>' + d.linea1 + (d.linea2 ? ', ' + d.linea2 : '') + '</span><span class="addr-sub">' + d.ciudad + ', ' + d.provincia + ' · CP ' + d.cp + '</span></div>';
  }
  function eventoHist(h) {
    var titulo = h[0] === null ? 'Pedido creado' : ESTADOS[h[1]];
    var autor = h[2] ? '<b>' + h[2] + '</b>' : '<span class="sys">Sistema</span>';
    var motivo = h[0] === null ? '' : (h[4] ? '<q>' + h[4] + '</q>' : '');
    return '<li' + (h[1] === 'CANCELADO' ? ' class="is-cancel"' : '') + '><span class="dot s-' + clase(h[1]) + '" aria-hidden="true"></span>' +
      '<div class="ev"><strong>' + titulo + '</strong><span class="meta">' + autor + ' · ' + h[3].replace(' ', ' a las ') + '</span>' + motivo + '</div></li>';
  }
  function historial(p, error) {
    if (error) return '<section class="ocard" aria-labelledby="hist-t"><h2 id="hist-t">Historial</h2><div class="hist-err" role="alert"><strong>' + ico('i-alerta') + 'No pudimos cargar el historial</strong><p>El resto del pedido está al día. Probá de nuevo en un momento.</p><button class="btn btn-secondary btn-sm" type="button">' + ico('i-reintentar') + 'Reintentar</button></div></section>';
    return '<section class="ocard" aria-labelledby="hist-t"><h2 id="hist-t">Historial</h2><ol class="tl">' + p.hist.map(eventoHist).join('') + '</ol></section>';
  }
  function accionesPedido(p) {
    var acc = acciones(p.estado, p.forma), h = '<section class="ocard" aria-labelledby="acc-t"><h2 id="acc-t">Acciones</h2>';
    if (!acc.length) return h + '<p class="acts-none">' + (p.estado === 'CANCELADO' ? 'El pedido está cancelado: no admite más cambios.' : 'El pedido ya se entregó: no admite más cambios.') + '</p></section>';
    h += '<div class="acts">';
    if (p.estado === 'PENDIENTE' && p.forma === 'MERCADOPAGO') h += '<div class="info-box" role="note">' + ico('i-tarjeta') + '<div><strong>Se confirma solo cuando Mercado Pago aprueba el pago</strong>No hace falta confirmarlo a mano. Si el cliente no paga, podés cancelarlo.</div></div>';
    acc.forEach(function (a) {
      h += a.tipo === 'cancelar'
        ? '<button class="btn btn-danger-outline" type="button">' + ico('i-cerrar') + a.etiqueta + '</button>'
        : '<button class="btn btn-primary" type="button">' + ico(a.icono) + a.etiqueta + '</button>';
    });
    return h + '</div></section>';
  }
  function detalle(p, opts) {
    opts = opts || {};
    var t = totales(p);
    var items = p.items.map(function (i) { return '<li><span class="q">' + i[0] + ' ×</span><span class="n">' + i[1] + (i[3] ? '<small>' + i[3] + '</small>' : '') + '</span><span class="p">' + precio(i[0] * i[2]) + '</span></li>'; }).join('');
    return '<a class="back-link" href="gestion-pedidos.html' + (opts.volver || '') + '">' + ico('i-volver') + 'Volver a pedidos</a>' +
      '<div class="od-head"><div class="od-title"><h1 id="titulo" tabindex="-1">Pedido #' + p.id + ' ' + badge(p.estado) + '</h1><p>Creado el ' + p.fecha + ' a las ' + p.hora + '</p></div>' + marca(opts.marca) + '</div>' +
      '<div class="od"><div class="od-main">' +
        '<section class="ocard" aria-labelledby="ent-t"><h2 id="ent-t">Cliente y entrega</h2><dl class="kv">' +
          '<dt>Cliente</dt><dd><strong>' + p.cliente + '</strong></dd>' +
          '<dt>Forma de pago</dt><dd>' + pago(p.forma) + '</dd>' +
          '<dt>Entrega</dt><dd>' + entrega(p) + '</dd></dl>' +
          (p.nota ? '<div class="cust-note">' + ico('i-nota') + '<div><strong>Nota del cliente</strong>' + p.nota + '</div></div>' : '') +
        '</section>' +
        '<section class="ocard" aria-labelledby="prod-t"><h2 id="prod-t">Productos</h2><ul class="sum-items" aria-label="Productos del pedido">' + items + '</ul>' +
          '<div class="totals"><div class="line"><span>Subtotal</span><span>' + precio(t.sub) + '</span></div><div class="line"><span>Costo de envío</span><span>' + precio(t.envio) + '</span></div><div class="line"><span>Descuento</span><span>' + precio(t.desc) + '</span></div><div class="total"><span>Total</span><span>' + precio(t.total) + '</span></div></div></section>' +
      '</div><div class="od-side">' + accionesPedido(p) + historial(p, opts.histError) + '</div></div>';
  }
  function esqueletoDetalle() {
    function card(n) { var h = '<div class="ocard skel-card">'; for (var k = 0; k < n; k++) h += '<span class="skel skel-line" style="width:' + (40 + (k * 17) % 50) + '%"></span>'; return h + '</div>'; }
    return '<a class="back-link" href="gestion-pedidos.html">' + ico('i-volver') + 'Volver a pedidos</a>' +
      '<div class="od-head" aria-busy="true" aria-label="Cargando pedido"><div class="od-title"><span class="skel" style="width:260px;height:32px"></span><span class="skel skel-line" style="width:200px"></span></div></div>' +
      '<div class="od"><div class="od-main">' + card(4) + card(5) + '</div><div class="od-side">' + card(2) + card(4) + '</div></div>';
  }

  /* ── Diálogos y avisos ── */
  function dialogo(html, extra) {
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-scrim"><div class="modal mw' + (extra ? ' ' + extra : '') + '" role="dialog" aria-modal="true" aria-labelledby="dlg-titulo">' + html + '</div></div>');
  }
  function toast(titulo, texto, tipo) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toasts" aria-live="polite"><div class="toast ' + (tipo === 'error' ? 't-error' : 't-success') + '" role="status"><div><strong>' + titulo + '</strong>' + texto + '</div>' +
      '<button class="icon-btn" type="button" aria-label="Cerrar notificación">' + ico('i-cerrar') + '</button></div></div>');
  }
  function estadoVista(tipo, icono, titulo, texto, accion) {
    return '<div class="state empty' + (tipo === 'error' ? ' is-error' : '') + '"' + (tipo === 'error' ? ' role="alert"' : '') + '>' +
      '<span class="badge-ico" aria-hidden="true">' + ico(icono) + '</span><h2>' + titulo + '</h2><p>' + texto + '</p>' + (accion || '') + '</div>';
  }
  function sinPermiso() {
    return '<div class="nf"><section class="state" aria-labelledby="fb-t"><span class="badge-ico" aria-hidden="true">' + ico('i-candado') + '</span>' +
      '<h1 id="fb-t">No tenés acceso a esta sección</h1><p>Tu cuenta no tiene permiso para ver esta página. Si creés que es un error, consultá con quien administra la tienda.</p>' +
      '<div class="actions"><a class="btn btn-primary" href="#/catalogo">Ir al catálogo</a></div></section></div>';
  }
  function llenar(id, html) { document.getElementById(id).innerHTML = html; }
  function banner(t) { document.getElementById('banner').textContent = t + ' · ' + ROL + ' · Revision 2 · pendiente de aprobación'; }
  function nota(t) { var el = document.getElementById('nota'); if (el) el.innerHTML = '<span class="note" title="Anotación del mockup: no se muestra en la app">Anotación · ' + t + '</span>'; }

  window.MOCK = {
    params: params, estado: params.get('estado'), rol: ROL, ico: ico, precio: precio, badge: badge, pago: pago, ESTADOS: ESTADOS,
    PEDIDOS: PEDIDOS, pedido: pedido, totales: totales, acciones: acciones, entrega: entrega,
    marca: marca, lista: lista, esqueletoLista: esqueletoLista, paginacion: paginacion,
    detalle: detalle, esqueletoDetalle: esqueletoDetalle, dialogo: dialogo, toast: toast, estadoVista: estadoVista, sinPermiso: sinPermiso,
    llenar: llenar, banner: banner, nota: nota
  };
})();
