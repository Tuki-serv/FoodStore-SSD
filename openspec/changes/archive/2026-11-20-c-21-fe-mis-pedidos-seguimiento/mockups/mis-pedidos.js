/* Mockups C-21: arma el shell del CLIENTE («Ana López», panel Catálogo · Carrito · Mis pedidos · Direcciones · Mi cuenta)
   alrededor de <main id="main">, los datos de ejemplo y las piezas de «Mis pedidos»: fila del listado, detalle con progreso,
   pago, historial «Vos / El local / Automático», diálogo de cancelación y toast. Se carga ANTES de mockup.js (C-22).
   No es código de la app. */
(function () {
  var DS = '../../../../design-system/';
  var params = new URLSearchParams(location.search);
  document.body.setAttribute('data-roles', 'CLIENT');
  document.body.setAttribute('data-current', 'mis-pedidos');

  function ico(name) { return '<svg class="ico" aria-hidden="true"><use href="#' + name + '"/></svg>'; }

  /* ── Shell (panel lateral DD-25, igual al de C-22) ── */
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
        '<span class="avatar" aria-hidden="true">AL</span>' +
        '<div class="user-meta"><strong>Ana López</strong><small>CLIENT</small></div>' +
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
  function terminado(e) { return e === 'ENTREGADO' || e === 'CANCELADO'; }
  function cancelable(e) { return e === 'PENDIENTE' || e === 'CONFIRMADO'; }

  /* ── Datos de ejemplo de «Ana López» (productos del seed; envío fijo $ 50 como hoy devuelve el backend) ── */
  var CASA = { alias: 'Casa', linea1: 'Av. Siempre Viva 742', linea2: 'Timbre 2', ciudad: 'Springfield', provincia: 'Buenos Aires', cp: '1636' };
  var TRABAJO = { alias: 'Trabajo', linea1: 'Belgrano 455', linea2: 'Oficina 3', ciudad: 'Springfield', provincia: 'Buenos Aires', cp: '1636' };
  var V = 'Vos', L = 'El local', A = null; /* autor del evento visto por el cliente (D8): null = «Automático» */
  var PEDIDOS = {
    63: { id: 63, forma: 'MERCADOPAGO', estado: 'PENDIENTE', fecha: '19/11/2026', hora: '12:50', dir: CASA, pago: 'rechazado',
      items: [[1, 'Burger BBQ Bacon', 1900], [1, 'Limonada Natural', 700]],
      hist: [[null, 'PENDIENTE', V, '19/11/2026 12:50', 'Pedido creado']] },
    58: { id: 58, forma: 'EFECTIVO', estado: 'PENDIENTE', fecha: '19/11/2026', hora: '12:40', dir: CASA,
      items: [[2, 'Hamburguesa Clásica', 1500, 'Sin cebolla'], [1, 'Coca-Cola 500ml', 800]], nota: 'Tocar timbre 2, el 1 no anda.',
      hist: [[null, 'PENDIENTE', V, '19/11/2026 12:40', 'Pedido creado']] },
    57: { id: 57, forma: 'MERCADOPAGO', estado: 'CONFIRMADO', fecha: '19/11/2026', hora: '12:31', dir: null, pago: 'aprobado',
      items: [[1, 'Burger BBQ Bacon', 1900], [1, 'Burger Vegana', 1800, 'Sin queso vegano'], [2, 'Coca-Cola 500ml', 800]], nota: 'Paso a buscarlo 13:15. Sin cubiertos, por favor.',
      hist: [[null, 'PENDIENTE', V, '19/11/2026 12:31', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', A, '19/11/2026 12:33', 'Pago aprobado por Mercado Pago']] },
    54: { id: 54, forma: 'EFECTIVO', estado: 'EN_PREP', fecha: '19/11/2026', hora: '11:58', dir: TRABAJO,
      items: [[2, 'Burger BBQ Bacon', 1900, 'Sin salsa BBQ'], [1, 'Burger Sin TACC', 1700], [3, 'Coca-Cola 500ml', 800]],
      hist: [[null, 'PENDIENTE', V, '19/11/2026 11:58', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', L, '19/11/2026 12:02', 'Paga en efectivo al recibir'], ['CONFIRMADO', 'EN_PREP', L, '19/11/2026 12:05', 'Sale en 20 min']] },
    53: { id: 53, forma: 'MERCADOPAGO', estado: 'EN_CAMINO', fecha: '19/11/2026', hora: '11:20', dir: CASA, pago: 'aprobado',
      items: [[1, 'Hamburguesa Clásica', 1500], [1, 'Burger BBQ Bacon', 1900, 'Sin bacon crocante']],
      hist: [[null, 'PENDIENTE', V, '19/11/2026 11:20', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', A, '19/11/2026 11:21', 'Pago aprobado por Mercado Pago'], ['CONFIRMADO', 'EN_PREP', L, '19/11/2026 11:25', null], ['EN_PREP', 'EN_CAMINO', L, '19/11/2026 11:50', 'Sale con la moto 2']] },
    50: { id: 50, forma: 'TRANSFERENCIA', estado: 'EN_CAMINO', fecha: '19/11/2026', hora: '10:58', dir: null,
      items: [[2, 'Burger Vegana', 1800]],
      hist: [[null, 'PENDIENTE', V, '19/11/2026 10:58', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', L, '19/11/2026 11:04', 'Transferencia acreditada'], ['CONFIRMADO', 'EN_PREP', L, '19/11/2026 11:05', null], ['EN_PREP', 'EN_CAMINO', L, '19/11/2026 11:24', 'Listo en el mostrador']] },
    46: { id: 46, forma: 'TRANSFERENCIA', estado: 'ENTREGADO', fecha: '18/11/2026', hora: '21:10', dir: CASA, items: [[1, 'Burger Sin TACC', 1700], [1, 'Coca-Cola 500ml', 800]] },
    44: { id: 44, forma: 'EFECTIVO', estado: 'CANCELADO', fecha: '18/11/2026', hora: '20:02', dir: CASA,
      items: [[1, 'Hamburguesa Clásica', 1500], [1, 'Limonada Natural', 700]],
      hist: [[null, 'PENDIENTE', V, '18/11/2026 20:02', 'Pedido creado'], ['PENDIENTE', 'CANCELADO', V, '18/11/2026 20:09', 'Me equivoqué de dirección']] },
    41: { id: 41, forma: 'MERCADOPAGO', estado: 'ENTREGADO', fecha: '17/11/2026', hora: '13:15', dir: TRABAJO, pago: 'aprobado',
      items: [[2, 'Burger Vegana', 1800, 'Sin cebolla morada'], [2, 'Limonada Natural', 700]],
      hist: [[null, 'PENDIENTE', V, '17/11/2026 13:15', 'Pedido creado'], ['PENDIENTE', 'CONFIRMADO', A, '17/11/2026 13:16', 'Pago aprobado por Mercado Pago'], ['CONFIRMADO', 'EN_PREP', L, '17/11/2026 13:20', null], ['EN_PREP', 'EN_CAMINO', L, '17/11/2026 13:41', null], ['EN_CAMINO', 'ENTREGADO', L, '17/11/2026 14:02', null]] },
    39: { id: 39, forma: 'EFECTIVO', estado: 'ENTREGADO', fecha: '16/11/2026', hora: '20:47', dir: CASA, items: [[1, 'Hamburguesa Clásica', 1500]] }
  };
  function totales(p) { var s = p.items.reduce(function (a, i) { return a + i[0] * i[2]; }, 0); return { sub: s, envio: 50, desc: 0, total: s + 50 }; }
  function pedido(id, cambios) { var p = PEDIDOS[id], c = {}; for (var k in p) c[k] = p[k]; for (k in (cambios || {})) c[k] = cambios[k]; return c; }

  /* ── Marca de actualización (MarcaActualizacion movida a shared/ui, D1) ── */
  function marca(opts) {
    opts = opts || {};
    var btn = opts.girando
      ? '<button class="btn btn-secondary btn-sm" type="button" disabled aria-busy="true"><span class="spin" aria-hidden="true"></span>Actualizando…</button>'
      : '<button class="btn btn-secondary btn-sm" type="button">' + ico('i-reintentar') + 'Actualizar</button>';
    return '<div class="refresh"><span class="when" aria-live="polite">' + ico('i-reloj') + 'Actualizado a las ' + (opts.hora || '12:52') + '</span>' + btn + '</div>';
  }
  function avisoFallo(hora) {
    return '<div class="refresh-fail" role="status">' + ico('i-alerta') + 'No pudimos actualizar<span>Mostramos lo de las ' + hora + '. Se vuelve a intentar solo en 30 segundos.</span><button class="link-btn" type="button">Reintentar ahora</button></div>';
  }

  /* ── Listado (D4): Pedido · Forma de pago · Total · Estado · Ver detalle ── */
  function fila(p) {
    var t = totales(p);
    return '<li class="orow mrow">' +
      '<div class="onum"><a href="mi-pedido-detalle.html?id=' + p.id + '">#' + p.id + '</a><small>' + p.fecha.slice(0, 5) + ' · ' + p.hora +
        (terminado(p.estado) ? '' : '<span class="live">En curso</span>') + '</small></div>' +
      '<div class="opay">' + pago(p.forma) + '</div>' +
      '<div class="ototal">' + precio(t.total) + '</div>' +
      '<div class="ostate">' + badge(p.estado) + '</div>' +
      '<div class="oact"><a class="btn btn-ghost btn-sm" href="mi-pedido-detalle.html?id=' + p.id + '" aria-label="Ver el detalle del pedido #' + p.id + '">Ver detalle' + ico('i-flecha') + '</a></div></li>';
  }
  function lista(items, stale) {
    return '<ul class="olist' + (stale ? ' is-stale' : '') + '" aria-label="Mis pedidos">' +
      '<li class="orow mrow ohead" aria-hidden="true"><span>Pedido</span><span>Forma de pago</span><span class="r">Total</span><span>Estado</span><span></span></li>' +
      items.map(fila).join('') + '</ul>';
  }
  function esqueletoLista(n) {
    var h = '<div class="olist" aria-busy="true" aria-label="Cargando tus pedidos">';
    for (var k = 0; k < n; k++) h += '<div class="skel-orow mrow"><span class="skel" style="width:70%"></span><span class="skel" style="width:' + (50 + (k * 13) % 30) + '%"></span><span class="skel" style="width:80%"></span><span class="skel p"></span><span class="skel b"></span></div>';
    return h + '</div>';
  }
  function paginacion(page, pages) {
    return '<nav class="pager" aria-label="Paginación de mis pedidos">' +
      '<button class="btn btn-secondary btn-sm" type="button"' + (page <= 1 ? ' disabled' : '') + '>Anterior</button>' +
      '<span>Página ' + page + ' de ' + pages + '</span>' +
      '<button class="btn btn-secondary btn-sm" type="button"' + (page >= pages ? ' disabled' : '') + '>Siguiente</button></nav>';
  }

  /* ── Progreso (D6) ── */
  var PASOS = ['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'EN_CAMINO', 'ENTREGADO'];
  function queSigue(p) {
    if (p.estado === 'PENDIENTE') return p.forma === 'MERCADOPAGO' ? 'Se confirma cuando Mercado Pago aprueba el pago.' : 'El local confirma tu pedido cuando recibe el pago' + (p.forma === 'EFECTIVO' ? ' en efectivo.' : ' por transferencia.');
    if (p.estado === 'CONFIRMADO') return 'El local va a empezar a prepararlo.';
    if (p.estado === 'EN_PREP') return 'Tu pedido se está preparando.';
    if (p.estado === 'EN_CAMINO') return p.dir ? 'Tu pedido va en camino.' : 'Tu pedido está listo: podés pasar a retirarlo.';
    var ult = p.hist ? p.hist[p.hist.length - 1][3] : p.fecha + ' 14:02';
    return 'Entregado el ' + ult.slice(0, 5) + ' a las ' + ult.slice(11) + '. ¡Que lo disfrutes!';
  }
  function progreso(p) {
    if (p.estado === 'CANCELADO') {
      var ev = p.hist[p.hist.length - 1];
      return '<div class="cancel-band">' + ico('i-cerrar') + '<div><strong>Pedido cancelado</strong><span>' + (ev[2] === 'Vos' ? 'Lo cancelaste' : 'Lo canceló el local') + ' el ' + ev[3].slice(0, 5) + ' a las ' + ev[3].slice(11) + '.</span>' +
        (ev[4] ? '<q>' + ev[4] + '</q>' : '') + '</div></div>';
    }
    var actual = PASOS.indexOf(p.estado);
    var h = '<ol class="steps" aria-label="Progreso del pedido">';
    PASOS.forEach(function (s, i) {
      var label = s === 'EN_CAMINO' && !p.dir ? 'Listo para retirar' : ESTADOS[s];
      var cls = i < actual || p.estado === 'ENTREGADO' ? 'is-done' : i === actual ? 'is-current' : '';
      var sr = cls === 'is-done' ? ' (cumplido)' : cls === 'is-current' ? '' : ' (pendiente)';
      h += '<li class="' + cls + '"' + (cls === 'is-current' ? ' aria-current="step"' : '') + '><span class="sd" aria-hidden="true">' + (cls === 'is-done' ? ico('i-guardar') : '') + '</span>' +
        '<span class="sl">' + label + '<span class="sr-only">' + sr + '</span></span></li>';
    });
    h += '</ol>';
    var cur = p.estado === 'ENTREGADO' ? 'Entregado' : (p.estado === 'EN_CAMINO' && !p.dir ? 'Listo para retirar' : ESTADOS[p.estado]);
    return h + '<p class="next" role="status"><span class="sr-only">Paso actual: ' + cur + '. </span>' + ico(p.estado === 'ENTREGADO' ? 'i-ok' : 'i-reloj') + queSigue(p) + '</p>';
  }

  /* ── Pago con Mercado Pago (D7, componentes movidos a entities/payment/ui) ── */
  var LINEA_PAGO = { pendiente: 'Pago en confirmación', aprobado: 'Pago aprobado', rechazado: 'Último intento de pago: rechazado', a_devolver: 'Pago aprobado, a devolver' };
  function filaPago(p) {
    if (p.forma !== 'MERCADOPAGO') return '';
    var e = p.pago;
    if (!e) return '<dt>Pago</dt><dd><span class="sec-note">Todavía no pagaste este pedido.</span></dd>';
    return '<dt>Pago</dt><dd><div class="pay-line"><strong>' + LINEA_PAGO[e] + '</strong>' +
      (e === 'rechazado' ? '<span class="reason-inline">' + ico('i-alerta') + 'La tarjeta no tiene fondos suficientes.</span>' : '') +
      (e === 'pendiente' ? '<span class="sec-note">Mercado Pago todavía no confirmó el pago.</span>' : '') + '</div></dd>';
  }
  function bloquePago(p) {
    if (p.forma !== 'MERCADOPAGO' || p.estado !== 'PENDIENTE') return '';
    var t = totales(p);
    if (p.pago === 'pendiente') return '<div class="pcard-in"><strong>Pago en confirmación</strong><p>No lo pagues de nuevo: si Mercado Pago aprueba el pago, el pedido se confirma solo.</p><a class="btn btn-secondary" href="#/finalizar-compra/pedido/' + p.id + '/pago">' + ico('i-reloj') + 'Ver el estado del pago</a></div>';
    var re = p.pago === 'rechazado';
    return '<div class="pcard-in handoff"><strong>' + (re ? 'Intentá de nuevo' : 'Falta el pago') + '</strong><p>' + (re ? 'El último intento no se cobró. El pedido sigue <b>pendiente</b>: podés pagarlo con otra tarjeta.' : 'El pedido queda pendiente hasta que Mercado Pago apruebe el pago.') + '</p>' +
      '<a class="btn btn-primary" href="#/finalizar-compra/pedido/' + p.id + '/pago">' + ico('i-tarjeta') + (re ? 'Reintentar el pago de ' : 'Pagar ') + precio(t.total) + (re ? '' : ' con tarjeta') + '</a></div>';
  }

  /* ── Detalle (D5) ── */
  function entrega(p) {
    if (!p.dir) return '<span class="pay-lbl">' + ico('i-tienda') + 'Retiro en el local</span>';
    var d = p.dir;
    return '<div class="deliv"><strong>' + d.alias + '</strong><span>' + d.linea1 + (d.linea2 ? ', ' + d.linea2 : '') + '</span><span class="addr-sub">' + d.ciudad + ', ' + d.provincia + ' · CP ' + d.cp + '</span></div>';
  }
  function eventoHist(h) {
    var titulo = h[0] === null ? 'Pedido creado' : ESTADOS[h[1]];
    var autor = h[2] ? '<b>' + h[2] + '</b>' : '<span class="sys">Automático</span>';
    var motivo = h[0] === null ? '' : (h[4] ? '<q>' + h[4] + '</q>' : '');
    return '<li' + (h[1] === 'CANCELADO' ? ' class="is-cancel"' : '') + '><span class="dot s-' + clase(h[1]) + '" aria-hidden="true"></span>' +
      '<div class="ev"><strong>' + titulo + '</strong><span class="meta">' + autor + ' · ' + h[3].replace(' ', ' a las ') + '</span>' + motivo + '</div></li>';
  }
  function historial(p, error) {
    if (error) return '<section class="ocard c-hist" aria-labelledby="hist-t"><h2 id="hist-t">Historial</h2><div class="hist-err" role="alert"><strong>' + ico('i-alerta') + 'No pudimos cargar el historial</strong><p>El resto del pedido está al día. Probá de nuevo en un momento.</p><button class="btn btn-secondary btn-sm" type="button">' + ico('i-reintentar') + 'Reintentar</button></div></section>';
    return '<section class="ocard c-hist" aria-labelledby="hist-t"><h2 id="hist-t">Historial</h2><ol class="tl" aria-label="Historial del pedido">' + p.hist.map(eventoHist).join('') + '</ol></section>';
  }
  function acciones(p) {
    var h = '<section class="ocard c-acc" aria-labelledby="acc-t"><h2 id="acc-t">¿Cambiaste de idea?</h2>';
    if (cancelable(p.estado)) {
      return h + '<p class="acts-none">Podés cancelarlo mientras el local no empiece a prepararlo.</p><div class="acts"><button class="btn btn-danger-outline" type="button" id="btn-cancelar">' + ico('i-cerrar') + 'Cancelar pedido</button></div></section>';
    }
    if (p.estado === 'EN_PREP' || p.estado === 'EN_CAMINO') {
      return h + '<p class="acts-none">' + ico('i-candado') + (p.estado === 'EN_PREP' ? 'Tu pedido ya se está preparando: no se puede cancelar.' : 'Tu pedido ya salió del local: no se puede cancelar.') + ' Si hay un problema, comunicate con el local.</p></section>';
    }
    return '';
  }
  function detalle(p, opts) {
    opts = opts || {};
    var t = totales(p);
    var items = p.items.map(function (i) { return '<li><span class="q">' + i[0] + ' ×</span><span class="n">' + i[1] + (i[3] ? '<small>' + i[3] + '</small>' : '') + '</span><span class="p">' + precio(i[0] * i[2]) + '</span></li>'; }).join('');
    if (!p.hist) p.hist = [[null, 'PENDIENTE', 'Vos', p.fecha + ' ' + p.hora, 'Pedido creado']];
    return '<a class="back-link" href="mis-pedidos.html">' + ico('i-volver') + 'Volver a mis pedidos</a>' +
      '<div class="od-head"><div class="od-title"><h1 id="titulo" tabindex="-1">Pedido #' + p.id + ' ' + badge(p.estado) + '</h1><p>Hecho el ' + p.fecha + ' a las ' + p.hora + '</p></div>' + (terminado(p.estado) ? '' : marca(opts.marca)) + '</div>' +
      (opts.aviso ? avisoFallo(opts.aviso) : '') +
      '<div class="od"><div class="od-main">' +
        '<section class="ocard c-seg" aria-labelledby="seg-t"><h2 id="seg-t">Seguimiento</h2>' + progreso(p) + bloquePago(p) + '</section>' +
        '<section class="ocard c-ent" aria-labelledby="ent-t"><h2 id="ent-t">Entrega y pago</h2><dl class="kv">' +
          '<dt>Entrega</dt><dd>' + entrega(p) + '</dd>' +
          '<dt>Forma de pago</dt><dd>' + pago(p.forma) + '</dd>' + filaPago(p) + '</dl>' +
          (p.nota ? '<div class="cust-note">' + ico('i-nota') + '<div><strong>Tu nota</strong>' + p.nota + '</div></div>' : '') +
        '</section>' +
        '<section class="ocard c-prod" aria-labelledby="prod-t"><h2 id="prod-t">Productos</h2><ul class="sum-items" aria-label="Productos del pedido">' + items + '</ul>' +
          '<div class="totals"><div class="line"><span>Subtotal</span><span>' + precio(t.sub) + '</span></div><div class="line"><span>Costo de envío</span><span>' + precio(t.envio) + '</span></div><div class="line"><span>Descuento</span><span>' + precio(t.desc) + '</span></div><div class="total"><span>Total</span><span>' + precio(t.total) + '</span></div></div></section>' +
      '</div><div class="od-side">' + acciones(p) + historial(p, opts.histError) + '</div></div>';
  }
  function esqueletoDetalle() {
    function card(n, c) { var h = '<div class="ocard skel-card ' + (c || '') + '">'; for (var k = 0; k < n; k++) h += '<span class="skel skel-line" style="width:' + (40 + (k * 17) % 50) + '%"></span>'; return h + '</div>'; }
    return '<a class="back-link" href="mis-pedidos.html">' + ico('i-volver') + 'Volver a mis pedidos</a>' +
      '<div class="od-head" role="status" aria-busy="true" aria-label="Cargando el pedido"><div class="od-title"><span class="skel" style="width:240px;height:32px"></span><span class="skel skel-line" style="width:200px"></span></div></div>' +
      '<div class="od"><div class="od-main">' + card(3, 'c-seg') + card(4, 'c-ent') + card(5, 'c-prod') + '</div><div class="od-side">' + card(2, 'c-acc') + card(4, 'c-hist') + '</div></div>';
  }

  /* ── Diálogos y avisos ── */
  function dialogo(html) {
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-scrim"><div class="modal mw" role="dialog" aria-modal="true" aria-labelledby="dlg-titulo">' + html + '</div></div>');
  }
  function toast(titulo, texto) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toasts" aria-live="polite"><div class="toast t-success" role="status"><div><strong>' + titulo + '</strong>' + texto + '</div>' +
      '<button class="icon-btn" type="button" aria-label="Cerrar notificación">' + ico('i-cerrar') + '</button></div></div>');
  }
  function estadoVista(tipo, icono, titulo, texto, accion) {
    return '<div class="state empty' + (tipo === 'error' ? ' is-error' : '') + '"' + (tipo === 'error' ? ' role="alert"' : '') + '>' +
      '<span class="badge-ico" aria-hidden="true">' + ico(icono) + '</span><h2>' + titulo + '</h2><p>' + texto + '</p>' + (accion || '') + '</div>';
  }
  function llenar(id, html) { document.getElementById(id).innerHTML = html; }
  function banner(t) { document.getElementById('banner').textContent = t + ' · CLIENT · Revision 2 · pendiente de aprobación'; }
  function nota(t) { var el = document.getElementById('nota'); if (el) el.innerHTML = '<span class="note" title="Anotación del mockup: no se muestra en la app">Anotación · ' + t + '</span>'; }

  window.MOCK = {
    params: params, estado: params.get('estado'), ico: ico, precio: precio, badge: badge, pago: pago, ESTADOS: ESTADOS,
    PEDIDOS: PEDIDOS, pedido: pedido, totales: totales, terminado: terminado,
    marca: marca, avisoFallo: avisoFallo, lista: lista, esqueletoLista: esqueletoLista, paginacion: paginacion,
    detalle: detalle, esqueletoDetalle: esqueletoDetalle, dialogo: dialogo, toast: toast, estadoVista: estadoVista,
    llenar: llenar, banner: banner, nota: nota
  };
})();
