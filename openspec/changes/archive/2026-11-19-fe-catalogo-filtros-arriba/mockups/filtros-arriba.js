/* fe-catalogo-filtros-arriba: arma la barra de escritorio (chips de raiz, subcategorias, «Precio», «Solo con stock").
   Usa MOCK de catalogo.js (copiado sin cambios de C-16b). Solo para los mockups. */
(function () {
  var M = window.MOCK;
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  /* o: {raiz, sub, min, max, stock, popover} — raiz/sub: ids elegidos o null */
  function barraEscritorio(o) {
    var pills = '<button class="pill" type="button" aria-pressed="' + (o.raiz === null) + '">Todas</button>' +
      M.ARBOL.map(function (n) { return '<button class="pill" type="button" aria-pressed="' + (o.raiz === n.id) + '">' + n.nombre + '</button>'; }).join('');

    var rango = o.min || o.max ? (o.min && o.max ? M.precio(o.min + '.00') + ' – ' + M.precio(o.max + '.00') : o.min ? 'Desde ' + M.precio(o.min + '.00') : 'Hasta ' + M.precio(o.max + '.00')) : '';
    var precio = '<div class="pop-wrap">' +
      '<button class="pill tool' + (rango ? ' is-active' : '') + '" type="button" aria-expanded="' + !!o.popover + '" aria-controls="pop-precio">' +
        (rango ? 'Precio: ' + rango : 'Precio') + CHEV + '</button>' +
      (o.popover ? '<div class="popover" id="pop-precio" role="dialog" aria-label="Precio">' +
        '<h3>Precio</h3>' +
        '<form class="range" onsubmit="return false">' +
          '<div class="field"><label for="p-min">Precio mínimo</label><div class="input-money"><span aria-hidden="true">$</span><input class="input" id="p-min" inputmode="numeric" placeholder="0" value="' + (o.min || '') + '"></div></div>' +
          '<div class="field"><label for="p-max">Precio máximo</label><div class="input-money"><span aria-hidden="true">$</span><input class="input" id="p-max" inputmode="numeric" placeholder="Sin tope" value="' + (o.max || '') + '"></div></div>' +
        '</form>' +
        '<div class="pop-actions"><span class="hint">Pesos enteros. Enter también aplica.</span><button class="btn btn-secondary btn-sm" type="submit">Aplicar</button></div>' +
      '</div>' : '') +
      '</div>';

    var stock = '<label class="switch compact"><span id="s-nom">Solo con stock</span><span class="sr" id="s-ayu">Oculta los productos agotados</span>' +
      '<input type="checkbox" role="switch" aria-labelledby="s-nom" aria-describedby="s-ayu"' + (o.stock ? ' checked' : '') + '></label>';

    var html = '<div class="desk-bar">' +
      '<div class="desk-row"><div class="cat-pills" role="group" aria-label="Categorías principales">' + pills + '</div>' +
      '<div class="desk-tools">' + precio + stock + '</div></div>';

    var raiz = M.ARBOL.filter(function (n) { return n.id === o.raiz; })[0];
    if (raiz && raiz.subcategorias.length) {
      html += '<div class="sub-row" role="group" aria-label="Subcategorías de ' + raiz.nombre + '"><span class="sub-label" aria-hidden="true">' + raiz.nombre + '</span>' +
        '<button class="pill sub" type="button" aria-pressed="' + (o.sub === null) + '">Todas</button>' +
        raiz.subcategorias.map(function (h) { return '<button class="pill sub" type="button" aria-pressed="' + (o.sub === h.id) + '">' + h.nombre + '</button>'; }).join('') +
        '</div>';
    }
    return html + '</div>';
  }

  M.barraEscritorio = barraEscritorio;
})();
