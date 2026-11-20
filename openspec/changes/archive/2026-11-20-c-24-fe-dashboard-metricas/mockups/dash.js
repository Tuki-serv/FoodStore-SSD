/* Mockups C-24: shell (igual al de C-22/C-23), datos de ejemplo y graficos SVG del Dashboard. Se carga ANTES de mockup.js. No es código de la app:
   los graficos imitan lo que dibujará recharts (design D8) y las tablas son la alternativa accesible. */
(function () {
  var DS = '../../../../design-system/';
  var params = new URLSearchParams(location.search);
  var HOY = '2026-11-20'; /* «hoy» fijo para que las capturas sean reproducibles */

  function ico(n) { return '<svg class="ico" aria-hidden="true"><use href="#' + n + '"/></svg>'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /* Iconos nuevos (mismo trazo). (TBD) se suman al sprite del design system al aprobar. */
  document.body.insertAdjacentHTML('afterbegin',
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
    '<symbol id="i-reloj" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>' +
    '<symbol id="i-tarjeta" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></symbol>' +
    '<symbol id="i-efectivo" viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01M18 14.5v.01"/></symbol>' +
    '<symbol id="i-transferencia" viewBox="0 0 24 24"><path d="M4 8h14M14 4l4 4-4 4"/><path d="M20 16H6M10 12l-4 4 4 4"/></symbol>' +
    '<symbol id="i-calendario" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>' +
    '<symbol id="i-ticket" viewBox="0 0 24 24"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z"/><path d="M14 5v14" stroke-dasharray="2 3"/></symbol>' +
    '<symbol id="i-flecha" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>' +
    '<symbol id="i-tabla" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/></symbol>' +
    '<symbol id="i-grafico" viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="M8 15l4-5 3 3 5-7"/></symbol>' +
    '<symbol id="i-vacio" viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="M8 15h12" stroke-dasharray="2 3"/></symbol>' +
    '</svg>');

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

  /* ── Fechas (todo en UTC, design D9) ── */
  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function parse(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function dd(n) { return (n < 10 ? '0' : '') + n; }
  function ddmm(s) { return s.slice(8, 10) + '/' + s.slice(5, 7); }
  function ddmmaaaa(s) { return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); }
  function addDias(s, n) { return iso(parse(s) + n * 86400000); }
  function trunc(s, g) {
    var t = parse(s), d = new Date(t);
    if (g === 'week') return iso(t - ((d.getUTCDay() + 6) % 7) * 86400000);
    if (g === 'month') return s.slice(0, 8) + '01';
    return s;
  }
  function siguiente(s, g) {
    if (g === 'week') return addDias(s, 7);
    if (g === 'month') { var d = new Date(parse(s)); return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
    return addDias(s, 1);
  }
  function rotulo(s, g) {
    if (g === 'week') return 'Sem. ' + ddmm(s);
    if (g === 'month') return MESES[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);
    return ddmm(s);
  }
  function rotuloLargo(s, g) {
    if (g === 'day') return DIAS[new Date(parse(s)).getUTCDay()] + ' ' + ddmm(s);
    return rotulo(s, g);
  }

  /* ── Formato de dinero (formatearPrecio: miles con punto, centavos solo si no son cero) ── */
  function miles(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function precio(n) { return '$ ' + miles(n); }
  function corto(n) { /* eje Y */
    if (n === 0) return '$ 0';
    if (n >= 1000000) return '$ ' + (n / 1000000).toString().replace('.', ',') + ' M';
    if (n >= 1000) return '$ ' + (n / 1000) + ' mil';
    return '$ ' + n;
  }

  /* ── Datos de ejemplo deterministas (pedidos «vendidos» = CONFIRMADO..ENTREGADO) ── */
  function hash(s) { var x = 7; for (var i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995) >>> 0; return x ^ (x >>> 15); }
  function diaDatos(s) {
    var dow = new Date(parse(s)).getUTCDay(), h = hash(s) >>> 0, h2 = hash(s + 'x') >>> 0;
    var n = 1 + (h % 4) + (dow === 5 || dow === 6 ? 3 : 0) + (dow === 0 ? 1 : 0);
    var ticket = 4200 + (h2 % 3800);
    return { n: n, total: Math.round(n * ticket / 50) * 50 };
  }
  function datos(desde, hasta, g) {
    var porGrupo = {}, orden = [], k, t, ventas = 0, ingresos = 0;
    for (k = trunc(desde, g); parse(k) <= parse(hasta); k = siguiente(k, g)) { porGrupo[k] = { fecha: k, total: 0, n: 0 }; orden.push(k); }
    for (t = parse(desde); t <= parse(hasta); t += 86400000) {
      var d = iso(t), v = diaDatos(d), gk = trunc(d, g);
      porGrupo[gk].total += v.total; porGrupo[gk].n += v.n; ventas += v.n; ingresos += v.total;
    }
    var serie = orden.map(function (o) { return porGrupo[o]; });
    return { serie: serie, ventas: ventas, ingresos: ingresos, ticket: ventas ? Math.round(ingresos / ventas) : 0 };
  }
  function productos(ventas) {
    var base = [['Empanada de carne', 1.35, 1800], ['Pizza muzzarella', 0.62, 8500], ['Milanesa napolitana con papas', 0.5, 9800], ['Hamburguesa completa', 0.44, 7900], ['Papas fritas con cheddar', 0.33, 4600]];
    return base.map(function (b, i) { var q = Math.round(ventas * b[1]); return { id: 10 + i, nombre: b[0], cantidad: q, ingresos: q * b[2] }; })
      .sort(function (a, b) { return b.cantidad - a.cantidad || b.ingresos - a.ingresos; });
  }
  var ESTADOS = [['PENDIENTE', 'Pendiente', 'pendiente'], ['CONFIRMADO', 'Confirmado', 'confirmado'], ['EN_PREP', 'En preparación', 'en-prep'], ['EN_CAMINO', 'En camino', 'en-camino'], ['ENTREGADO', 'Entregado', 'entregado'], ['CANCELADO', 'Cancelado', 'cancelado']];
  function estados(ventas) {
    var c = Math.floor(ventas * 0.04), p = Math.floor(ventas * 0.05), cam = Math.floor(ventas * 0.03);
    var n = [Math.ceil(ventas * 0.05), c, p, cam, ventas - c - p - cam, Math.ceil(ventas * 0.07)];
    return ESTADOS.map(function (e, i) { return { codigo: e[0], nombre: e[1], clase: e[2], cantidad: ventas ? n[i] : 0 }; });
  }
  var FORMAS = [['MERCADOPAGO', 'Tarjeta (Mercado Pago)', 'i-tarjeta', 'var(--color-primary)', 0.47], ['EFECTIVO', 'Efectivo', 'i-efectivo', 'var(--color-accent)', 0.42], ['TRANSFERENCIA', 'Transferencia bancaria', 'i-transferencia', 'var(--color-info)', 0.11]];
  function formas(ingresos) {
    var items = FORMAS.map(function (f) { return { codigo: f[0], nombre: f[1], icono: f[2], color: f[3], total: Math.round(ingresos * f[4] / 50) * 50 }; });
    var suma = items[1].total + items[2].total; items[0].total = ingresos - suma;
    /* Porcentajes con suma 100 (resto mayor) */
    var raw = items.map(function (i) { return ingresos ? i.total * 100 / ingresos : 0; }), base = raw.map(Math.floor), falta = 100 - base.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return [r - base[i], i]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, ingresos ? falta : 0).forEach(function (x) { base[x[1]]++; });
    items.forEach(function (i, k) { i.pct = base[k]; });
    return items.sort(function (a, b) { return b.total - a.total; });
  }

  /* ── Período según ?periodo= (más el rango personalizado) ── */
  var PERIODOS = {
    '30d': { desde: '2026-10-22', hasta: HOY, g: 'day', atajo: '30d' },
    '7d': { desde: '2026-11-14', hasta: HOY, g: 'day', atajo: '7d' },
    'hoy': { desde: HOY, hasta: HOY, g: 'day', atajo: 'hoy' },
    'mes-actual': { desde: '2026-11-01', hasta: HOY, g: 'day', atajo: 'mes' },
    'semana': { desde: '2026-11-01', hasta: '2026-11-15', g: 'week', atajo: '' },
    'mes': { desde: '2026-06-01', hasta: HOY, g: 'month', atajo: '' },
    'vacio': { desde: '2026-08-01', hasta: '2026-08-15', g: 'day', atajo: '' }
  };

  /* ── Piezas de UI ── */
  function selectorPeriodo(p, error) {
    var ATAJOS = [['hoy', 'Hoy'], ['7d', 'Últimos 7 días'], ['30d', 'Últimos 30 días'], ['mes', 'Este mes']];
    var GRUPOS = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']];
    var inv = error ? ' aria-invalid="true" aria-describedby="err-rango"' : '';
    var desde = error === 'invertido' ? '2026-11-19' : error === 'largo' ? '2025-01-01' : p.desde;
    var hasta = error === 'invertido' ? '2026-11-18' : HOY === p.hasta || error ? (error === 'invertido' ? '2026-11-18' : HOY) : p.hasta;
    if (!error) hasta = p.hasta;
    var msg = error === 'invertido' ? 'La fecha "Desde" no puede ser posterior a "Hasta"' : 'El período no puede superar un año';
    return '<section class="periodo" aria-label="Período">' +
      '<div class="periodo-fila">' +
        '<div class="grupo"><span class="grupo-lbl" id="l-atajos">Período</span>' +
          '<div class="seg seg-atajos" role="group" aria-labelledby="l-atajos">' + ATAJOS.map(function (a) {
            return '<button type="button" aria-pressed="' + (!error && p.atajo === a[0]) + '">' + a[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="grupo"><span class="grupo-lbl" id="l-agr">Agrupar por</span>' +
          '<div class="seg" role="group" aria-labelledby="l-agr">' + GRUPOS.map(function (a) {
            return '<button type="button" aria-pressed="' + (p.g === a[0]) + '">' + a[1] + '</button>'; }).join('') + '</div></div>' +
      '</div>' +
      '<div class="periodo-fila periodo-fechas">' +
        '<div class="field"><label for="f-desde">Desde</label><div class="fecha">' + ico('i-calendario') + '<input class="input" id="f-desde" type="text" value="' + ddmmaaaa(desde) + '"' + inv + ' readonly></div></div>' +
        '<div class="field"><label for="f-hasta">Hasta</label><div class="fecha">' + ico('i-calendario') + '<input class="input" id="f-hasta" type="text" value="' + ddmmaaaa(hasta) + '"' + inv + ' readonly></div></div>' +
        '<p class="utc">' + ico('i-reloj') + 'Fechas en UTC</p>' +
      '</div>' +
      (error ? '<p class="err-rango" id="err-rango" role="alert">' + ico('i-alerta') + msg + '</p>' +
        '<p class="stale-note">Se sigue mostrando el último período válido: ' + ddmmaaaa(p.desde) + ' al ' + ddmmaaaa(p.hasta) + '.</p>' : '') +
      '</section>';
  }
  function marca(girando, hora) {
    var btn = girando
      ? '<button class="btn btn-secondary btn-sm" type="button" disabled aria-busy="true"><span class="spin" aria-hidden="true"></span>Actualizando…</button>'
      : '<button class="btn btn-secondary btn-sm" type="button">' + ico('i-reintentar') + 'Actualizar</button>';
    return '<div class="refresh"><span class="when" aria-live="polite">' + ico('i-reloj') + 'Actualizado a las ' + (hora || '12:41') + '</span>' + btn + '</div>';
  }
  function kpi(clase, icono, titulo, valor, nota, href) {
    var cuerpo = '<span class="kpi-ico" aria-hidden="true">' + ico(icono) + '</span><span class="kpi-tit">' + titulo + '</span>' +
      '<span class="kpi-val">' + valor + '</span><span class="kpi-nota">' + nota + '</span>' +
      (href ? '<span class="kpi-go">Ver pedidos' + ico('i-flecha') + '</span>' : '');
    return href ? '<a class="kpi kpi-link ' + clase + '" href="#' + href + '">' + cuerpo + '</a>' : '<div class="kpi ' + clase + '">' + cuerpo + '</div>';
  }
  function kpis(d, activos, estado) {
    if (estado === 'cargando') {
      var s = '';
      for (var i = 0; i < 4; i++) s += '<div class="kpi" aria-busy="true"><span class="skel sk-ico"></span><span class="skel skel-line" style="width:50%"></span><span class="skel sk-val"></span><span class="skel skel-line" style="width:70%"></span></div>';
      return '<div class="kpis" aria-label="Cargando indicadores">' + s + '</div>';
    }
    return '<div class="kpis" role="group" aria-label="Indicadores del período">' +
      kpi('', 'i-pedidos', 'Ventas', miles(d.ventas), 'pedidos vendidos en el período') +
      kpi('', 'i-efectivo', 'Ingresos', precio(d.ingresos), 'facturado en el período') +
      kpi('', 'i-ticket', 'Ticket promedio', precio(d.ticket), 'por pedido vendido') +
      kpi('kpi-activos', 'i-gestion', 'Pedidos activos', String(activos), 'ahora, sin importar el período', '/gestion-pedidos') + '</div>';
  }
  function bloque(id, titulo, sub, cuerpo, opts) {
    opts = opts || {};
    var tabla = opts.tabla;
    return '<section class="bloque' + (opts.clase ? ' ' + opts.clase : '') + '" id="b-' + id + '" aria-labelledby="t-' + id + '">' +
      '<header class="bloque-head"><div><h2 id="t-' + id + '">' + titulo + '</h2><p class="bloque-sub">' + sub + '</p></div>' +
      (opts.sinToggle ? '' : '<button class="btn btn-ghost btn-sm toggle" type="button" data-bloque="' + id + '" aria-pressed="' + !!tabla + '">' + ico(tabla ? 'i-grafico' : 'i-tabla') + '<span class="lbl">' + (tabla ? 'Ver gráfico' : 'Ver como tabla') + '</span></button>') +
      '</header>' + cuerpo + '</section>';
  }
  function skelGrafico() { return '<div class="skel-chart" aria-busy="true" aria-label="Cargando"><span class="skel"></span><span class="skel"></span><span class="skel"></span><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>'; }
  function vacio(titulo, texto) {
    return '<div class="state vacio-bloque"><span class="badge-ico" aria-hidden="true">' + ico('i-vacio') + '</span><h3>' + titulo + '</h3><p>' + texto + '</p></div>';
  }
  function errorBloque(texto) {
    return '<div class="state is-error vacio-bloque" role="alert"><span class="badge-ico" aria-hidden="true">' + ico('i-alerta') + '</span><h3>No pudimos cargar este gráfico</h3><p>' + texto + '</p>' +
      '<button class="btn btn-secondary btn-sm" type="button">' + ico('i-reintentar') + 'Reintentar</button></div>';
  }
  function tabla(cap, cols, filas, clase) {
    return '<div class="dtabla-wrap" role="region" tabindex="0" aria-label="Tabla: ' + cap + '"><table class="dtabla ' + (clase || '') + '"><caption class="sr">' + cap + '</caption><thead><tr>' +
      cols.map(function (c, i) { return '<th scope="col"' + (i ? ' class="r"' : '') + '>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
      filas.map(function (f) { return '<tr>' + f.map(function (c, i) { return (i ? '<td class="r">' : '<th scope="row">') + c + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ── Gráficos SVG (aria-hidden: lo accesible es la tabla) ── */
  function nice(max) {
    if (max <= 0) return { max: 1, step: 1 };
    var pasos = [1, 2, 2.5, 5, 10], mag = Math.pow(10, Math.floor(Math.log10(max / 4))), s = 10 * mag;
    for (var i = 0; i < pasos.length; i++) { if (max / (pasos[i] * mag) <= 5) { s = pasos[i] * mag; break; } }
    return { max: Math.ceil(max / s) * s, step: s };
  }
  function svgVentas(serie, g, w, pin) {
    var h = w < 460 ? 230 : 264, m = { l: w < 460 ? 54 : 62, r: 14, t: 14, b: 30 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
    var max = Math.max.apply(null, serie.map(function (p) { return p.total; })), sc = nice(max), n = serie.length;
    function X(i) { return m.l + (n === 1 ? iw / 2 : iw * i / (n - 1)); }
    function Y(v) { return m.t + ih - ih * v / sc.max; }
    var o = '<svg class="chart" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" focusable="false">';
    for (var v = 0; v <= sc.max + 1; v += sc.step) {
      o += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--color-border)" stroke-width="1"' + (v ? ' stroke-dasharray="3 4"' : '') + '/>' +
        '<text x="' + (m.l - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ax">' + corto(v) + '</text>';
    }
    var paso = Math.max(1, Math.ceil(50 / (n === 1 ? 50 : iw / (n - 1))));
    serie.forEach(function (p, i) {
      if (i % paso === 0) o += '<text x="' + X(i) + '" y="' + (h - 8) + '" text-anchor="' + (n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle') + '" class="ax">' + rotulo(p.fecha, g) + '</text>';
    });
    if (n > 1) {
      var linea = serie.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.total).toFixed(1); }).join(' ');
      o += '<path d="' + linea + ' L' + X(n - 1).toFixed(1) + ' ' + Y(0) + ' L' + X(0).toFixed(1) + ' ' + Y(0) + ' Z" fill="var(--color-primary)" fill-opacity=".12"/>' +
        '<path d="' + linea + '" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    serie.forEach(function (p, i) {
      if (n <= 16 || i === pin) o += '<circle cx="' + X(i) + '" cy="' + Y(p.total) + '" r="' + (i === pin ? 5 : 3.5) + '" fill="' + (i === pin ? 'var(--color-primary)' : 'var(--color-surface)') + '" stroke="var(--color-primary)" stroke-width="2"/>';
    });
    if (pin != null && pin >= 0) o += '<line x1="' + X(pin) + '" x2="' + X(pin) + '" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="var(--color-text-muted)" stroke-width="1" stroke-dasharray="2 3"/>';
    o += '</svg>';
    return { svg: o, X: X, Y: Y, w: w, h: h };
  }
  function tooltipVentas(g, p, x, y, w) {
    var left = x < w / 2 ? x + 14 : x - 164;
    return '<div class="tip" role="presentation" style="left:' + Math.max(left, 4) + 'px;top:' + Math.max(y - 20, 0) + 'px"><strong>' + rotuloLargo(p.fecha, g) + '</strong><span>Ingresos: ' + precio(p.total) + '</span><span>' + p.n + ' ' + (p.n === 1 ? 'pedido' : 'pedidos') + '</span></div>';
  }
  function svgBarrasH(items, w, clave) {
    var fila = 52, h = items.length * fila + 4, max = Math.max.apply(null, items.map(function (i) { return i.cantidad; })) || 1, tw = 54;
    var o = '<svg class="chart" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" focusable="false">';
    items.forEach(function (it, i) {
      var y = i * fila + 4, bw = Math.max(4, (w - tw) * it.cantidad / max);
      o += '<text x="0" y="' + (y + 13) + '" class="lb">' + esc(it.nombre) + '</text>' +
        '<text x="' + w + '" y="' + (y + 13) + '" text-anchor="end" class="lb-m">' + precio(it.ingresos) + '</text>' +
        '<rect x="0" y="' + (y + 22) + '" width="' + bw.toFixed(1) + '" height="16" rx="4" fill="var(--color-primary)"/>' +
        '<text x="' + (bw + 6).toFixed(1) + '" y="' + (y + 35) + '" class="val">' + it.cantidad + '</text>';
    });
    return o + '</svg>';
  }
  function svgEstados(items, w) {
    var max = Math.max.apply(null, items.map(function (i) { return i.cantidad; })) || 1, o;
    function col(c) { return 'var(--state-' + c + '-fg)'; }
    if (w < 460) { /* barras horizontales en pantallas angostas */
      var fila = 38, lw = 112, h = items.length * fila + 4;
      o = '<svg class="chart" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" focusable="false">';
      items.forEach(function (it, i) {
        var y = i * fila + 4, bw = Math.max(4, (w - lw - 44) * it.cantidad / max);
        o += '<text x="0" y="' + (y + 20) + '" class="lb">' + it.nombre + '</text><rect x="' + lw + '" y="' + (y + 6) + '" width="' + bw.toFixed(1) + '" height="20" rx="4" fill="' + col(it.clase) + '"/>' +
          '<text x="' + (lw + bw + 6).toFixed(1) + '" y="' + (y + 21) + '" class="val">' + it.cantidad + '</text>';
      });
      return o + '</svg>';
    }
    var h2 = 250, m = { t: 22, b: 44 }, ih = h2 - m.t - m.b, cw = w / items.length;
    o = '<svg class="chart" width="' + w + '" height="' + h2 + '" viewBox="0 0 ' + w + ' ' + h2 + '" aria-hidden="true" focusable="false"><line x1="0" x2="' + w + '" y1="' + (m.t + ih) + '" y2="' + (m.t + ih) + '" stroke="var(--color-border)"/>';
    items.forEach(function (it, i) {
      var bh = Math.max(3, ih * it.cantidad / max), x = i * cw + cw * 0.2, bwid = cw * 0.6, y = m.t + ih - bh;
      var partes = it.nombre === 'En preparación' ? ['En', 'preparación'] : [it.nombre];
      o += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bwid.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + col(it.clase) + '"/>' +
        '<text x="' + (x + bwid / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle" class="val">' + it.cantidad + '</text>' +
        partes.map(function (t, k) { return '<text x="' + (x + bwid / 2).toFixed(1) + '" y="' + (h2 - 26 + k * 15) + '" text-anchor="middle" class="ax">' + t + '</text>'; }).join('');
    });
    return o + '</svg>';
  }
  function donaFormas(items, total) {
    var r = 66, c = 2 * Math.PI * r, off = 0, gap = items.length > 1 ? 3 : 0, o = '<svg class="dona" width="176" height="176" viewBox="0 0 176 176" aria-hidden="true" focusable="false"><g transform="rotate(-90 88 88)">';
    items.forEach(function (it) {
      var len = c * it.total / total;
      if (len > 0) o += '<circle cx="88" cy="88" r="' + r + '" fill="none" stroke="' + it.color + '" stroke-width="26" stroke-dasharray="' + Math.max(0, len - gap).toFixed(2) + ' ' + (c - Math.max(0, len - gap)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += len;
    });
    return o + '</g><text x="88" y="84" text-anchor="middle" class="ax">Total</text><text x="88" y="106" text-anchor="middle" class="dona-t">' + precio(total) + '</text></svg>';
  }

  /* ── Armado de bloques (gráfico o tabla) ── */
  function bloques(d, opts) {
    opts = opts || {};
    var p = opts.p, g = p.g, tops = productos(d.ventas), est = estados(d.ventas), fp = formas(d.ingresos);
    var sinVentas = d.ventas === 0, abierta = opts.tabla || '';
    var subPeriodo = ddmm(p.desde) + ' – ' + ddmm(p.hasta) + ' · por ' + (g === 'day' ? 'día' : g === 'week' ? 'semana' : 'mes');
    var out = {};

    /* Ventas */
    var cuerpo;
    if (opts.estado === 'cargando') cuerpo = skelGrafico();
    else if (sinVentas) cuerpo = vacio('Sin ventas en este período', 'Probá con otro rango de fechas.');
    else if (abierta === 'ventas') cuerpo = tabla('Ventas por período', ['Período', 'Ingresos', 'Pedidos'], d.serie.map(function (s) { return [rotuloLargo(s.fecha, g), precio(s.total), String(s.n)]; }));
    else cuerpo = '<div class="chart-box" data-chart="ventas"></div>';
    out.ventas = bloque('ventas', 'Ventas por período', 'Ingresos ' + subPeriodo, cuerpo, { tabla: abierta === 'ventas', sinToggle: opts.estado === 'cargando' || sinVentas });

    /* Productos */
    if (opts.estado === 'cargando') cuerpo = skelGrafico();
    else if (opts.estado === 'error-bloque') cuerpo = errorBloque('Hubo un problema al pedir los productos más vendidos. Los demás gráficos siguen funcionando.');
    else if (sinVentas) cuerpo = vacio('Sin ventas en este período', 'Cuando haya pedidos vendidos van a aparecer acá.');
    else if (abierta === 'productos') cuerpo = tabla('Productos más vendidos', ['Producto', 'Cantidad', 'Ingresos'], tops.map(function (t) { return [esc(t.nombre), String(t.cantidad), precio(t.ingresos)]; }));
    else cuerpo = '<div class="chart-box" data-chart="productos"></div>';
    out.productos = bloque('productos', 'Productos más vendidos', 'Top 5 por cantidad · ingresos = facturado en el producto', cuerpo, { tabla: abierta === 'productos', sinToggle: opts.estado === 'cargando' || opts.estado === 'error-bloque' || sinVentas });

    /* Estados */
    var vacioEstados = est.every(function (e) { return !e.cantidad; });
    if (opts.estado === 'cargando') cuerpo = skelGrafico();
    else if (vacioEstados) cuerpo = vacio('Sin pedidos en este período', 'No se creó ningún pedido en estas fechas.');
    else if (abierta === 'estados') cuerpo = tabla('Pedidos por estado', ['Estado', 'Pedidos'], est.map(function (e) { return ['<a class="tlink" href="#/gestion-pedidos?estado=' + e.codigo + '"><span class="badge b-' + e.clase + '">' + e.nombre + '</span></a>', String(e.cantidad)]; }));
    else cuerpo = '<div class="chart-box" data-chart="estados"></div>';
    out.estados = bloque('estados', 'Pedidos por estado', 'Pedidos creados en el período · ' + ddmm(p.desde) + ' – ' + ddmm(p.hasta), cuerpo, { tabla: abierta === 'estados', sinToggle: opts.estado === 'cargando' || vacioEstados });

    /* Formas de pago */
    if (opts.estado === 'cargando') cuerpo = skelGrafico();
    else if (sinVentas) cuerpo = vacio('Sin ventas en este período', 'Cuando haya ingresos vas a ver cómo se reparten.');
    else if (abierta === 'pagos') cuerpo = tabla('Ingresos por forma de pago', ['Forma de pago', 'Ingresos', 'Porcentaje'], fp.map(function (f) { return [f.nombre, precio(f.total), f.pct + ' %']; }));
    else cuerpo = '<div class="pagos"><div class="dona-box">' + donaFormas(fp, d.ingresos) + '</div><ul class="leyenda" aria-hidden="true">' + fp.map(function (f) {
      return '<li><span class="sw" style="background:' + f.color + '"></span><span class="ln"><strong>' + f.nombre + '</strong><small>' + precio(f.total) + '</small></span><span class="pct">' + f.pct + ' %</span></li>'; }).join('') + '</ul></div>';
    out.pagos = bloque('pagos', 'Ingresos por forma de pago', 'Participación sobre los ingresos del período', cuerpo, { tabla: abierta === 'pagos', sinToggle: opts.estado === 'cargando' || sinVentas });

    out.tops = tops; out.est = est; out.fp = fp;
    return out;
  }

  /* Dibuja los gráficos según el ancho real del contenedor (como ResponsiveContainer) */
  function dibujar(d, p, pinSerie) {
    var cajas = document.querySelectorAll('[data-chart]');
    Array.prototype.forEach.call(cajas, function (caja) {
      var w = Math.floor(caja.clientWidth), tipo = caja.getAttribute('data-chart');
      if (!w) return;
      if (tipo === 'ventas') {
        var pin = pinSerie != null ? pinSerie : -1, r = svgVentas(d.serie, p.g, w, pin);
        caja.innerHTML = r.svg + (pin >= 0 ? tooltipVentas(p.g, d.serie[pin], r.X(pin), r.Y(d.serie[pin].total), w) : '');
        caja.onmousemove = function (e) {
          var rect = caja.getBoundingClientRect(), x = e.clientX - rect.left, best = 0, dist = 1e9;
          d.serie.forEach(function (s, i) { var dx = Math.abs(r.X(i) - x); if (dx < dist) { dist = dx; best = i; } });
          var rr = svgVentas(d.serie, p.g, w, best);
          caja.innerHTML = rr.svg + tooltipVentas(p.g, d.serie[best], rr.X(best), rr.Y(d.serie[best].total), w);
        };
      } else if (tipo === 'productos') caja.innerHTML = svgBarrasH(productos(d.ventas), w);
      else if (tipo === 'estados') caja.innerHTML = svgEstados(estados(d.ventas), w);
    });
  }

  function llenar(id, html) { document.getElementById(id).innerHTML = html; }
  function banner(t) { document.getElementById('banner').textContent = t; }
  function nota(t) { llenar('nota', '<span class="note" title="Anotación del mockup: no se muestra en la app">Anotación · ' + t + '</span>'); }

  /* Alternar gráfico/tabla con los botones «Ver como tabla» (interacción de ejemplo) */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.toggle');
    if (!b) return;
    var q = new URLSearchParams(location.search);
    q.set('estado', 'tabla'); q.set('bloque', b.getAttribute('data-bloque'));
    if (b.getAttribute('aria-pressed') === 'true') { q.delete('estado'); q.delete('bloque'); }
    location.search = q.toString();
  });

  window.DASH = {
    HOY: HOY, params: params, PERIODOS: PERIODOS, ico: ico, datos: datos, kpis: kpis, selectorPeriodo: selectorPeriodo, marca: marca,
    bloques: bloques, dibujar: dibujar, llenar: llenar, banner: banner, nota: nota, ddmmaaaa: ddmmaaaa, precio: precio
  };
})();
