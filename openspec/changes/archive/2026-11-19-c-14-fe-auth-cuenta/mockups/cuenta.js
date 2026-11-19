/* Mockups C-14 (base: checkout.js de C-19): shell de la app y helpers de formularios.
   Solo para los mockups. Debe cargarse ANTES de mockup.js (arma el shell; mockup.js arma la navegacion por rol).
   Sin sesion (body sin data-roles): panel sin pie y topbar sin carrito, igual que AppShell (C-13a). */
(function () {
  var params = new URLSearchParams(location.search);
  var cfg = window.CFG || {};
  var roles = (document.body.getAttribute('data-roles') || '').split(' ').filter(Boolean);
  var conSesion = roles.length > 0;
  window.MOCK_COUNT = conSesion ? 0 : undefined;

  function ico(id) { return '<svg class="ico" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function iniciales(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join(''); }

  /* Rol principal del pie (model/rol-principal.ts): ADMIN > PEDIDOS > STOCK > CLIENT. */
  var principal = ['ADMIN', 'PEDIDOS', 'STOCK', 'CLIENT'].filter(function (r) { return roles.indexOf(r) !== -1; })[0] || '';
  var usuario = cfg.usuario || 'Ana Gómez';

  var LOGO = '../../../../design-system/assets/logo.svg';
  document.body.insertAdjacentHTML('afterbegin',
    '<div class="shell" id="shell">' +
    '<aside class="sidebar" id="sidebar"><div class="sidebar-head">' +
      '<img class="sidebar-logo" src="' + LOGO + '" alt="Food Store (logo provisional)">' +
      '<button class="icon-btn btn-collapse" id="btn-collapse" type="button" aria-controls="sidebar" aria-expanded="true" aria-label="Colapsar panel">' + ico('i-panel') + '</button>' +
      '<button class="icon-btn btn-close" id="btn-close" type="button" aria-label="Cerrar menú">' + ico('i-cerrar') + '</button></div>' +
    '<nav class="sidebar-nav" id="sidebar-nav" aria-label="Principal"></nav>' +
    (conSesion
      ? '<div class="sidebar-foot"><span class="avatar" aria-hidden="true">' + iniciales(usuario) + '</span><div class="user-meta"><strong>' + usuario + '</strong><small>' + principal + '</small></div>' +
        '<button class="icon-btn btn-logout" type="button" aria-label="Cerrar sesión">' + ico('i-salir') + '</button></div>'
      : '') +
    '</aside>' +
    '<div class="scrim" id="scrim"></div>' +
    '<div class="shell-main"><div class="banner" id="banner">' + (cfg.banner || '') + '</div>' +
      '<header class="topbar"><button class="icon-btn" id="btn-menu" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Abrir menú">' + ico('i-menu') + '</button>' +
      '<img src="' + LOGO + '" alt="Food Store (logo provisional)">' +
      (conSesion ? '<a class="icon-btn" href="#/carrito" aria-label="Carrito">' + ico('i-carrito') + '</a>' : '') + '</header>' +
      '<main class="page ' + (cfg.pageClass || '') + '" id="main"><div id="contenido"></div></main>' +
    '</div></div>');

  /* Campo del design system (shared/ui/campo): etiqueta + control + ayuda + error con aria-invalid/aria-describedby. */
  function campo(o) {
    var id = 'f-' + o.id, desc = [];
    if (o.ayuda) desc.push(id + '-ayuda');
    if (o.error) desc.push(id + '-error');
    var attrs = ' id="' + id + '" name="' + o.id + '" type="' + (o.type || 'text') + '"' +
      (o.auto ? ' autocomplete="' + o.auto + '"' : '') + (o.valor !== undefined ? ' value="' + o.valor + '"' : '') +
      (o.placeholder ? ' placeholder="' + o.placeholder + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') +
      (o.error ? ' aria-invalid="true"' : '') + (desc.length ? ' aria-describedby="' + desc.join(' ') + '"' : '') +
      (o.disabled ? ' disabled' : '');
    return '<div class="field' + (o.cls ? ' ' + o.cls : '') + '"><label for="' + id + '">' + o.label + (o.opcional ? ' <small>(opcional)</small>' : '') + '</label>' +
      '<input class="input"' + attrs + '>' +
      (o.ayuda ? '<span class="hint" id="' + id + '-ayuda">' + o.ayuda + '</span>' : '') +
      (o.error ? '<span class="err" id="' + id + '-error">' + o.error + '</span>' : '') + '</div>';
  }
  function alerta(titulo, texto) {
    return '<div class="form-alert" role="alert">' + ico('i-alerta') + '<div>' + titulo + (texto ? '<p>' + texto + '</p>' : '') + '</div></div>';
  }
  function boton(texto, enviando, textoEnviando, extra) {
    return '<button class="btn btn-primary btn-block" type="submit"' + (enviando || extra ? ' disabled' : '') + '>' +
      (enviando ? '<span class="spinner spinner-sm" aria-hidden="true"></span>' + textoEnviando : texto) + '</button>';
  }
  function dialogo(html) {
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-scrim"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-titulo" aria-describedby="dlg-texto">' + html + '</div></div>');
    var m = document.getElementById('main'); if (m) m.setAttribute('aria-hidden', 'true');
  }
  function toast(tipo, titulo, texto) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toasts" aria-live="polite"><div class="toast t-' + tipo + '" role="status"><div><strong>' + titulo + '</strong>' + (texto || '') + '</div>' +
      '<button class="icon-btn" type="button" aria-label="Cerrar notificación">' + ico('i-cerrar') + '</button></div></div>');
  }

  window.MOCK = {
    estado: params.get('estado'), params: params, ico: ico, campo: campo, alerta: alerta, boton: boton, dialogo: dialogo, toast: toast,
    llenar: function (id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
  };
})();
