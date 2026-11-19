/* Mockups C-16: datos de ejemplo (seed de backend/app/db/seed.py + productos ilustrativos marcados) y render compartido
   de tarjetas, arbol de categorias y chips. Solo para los mockups: la app usa los componentes de design D1. */
(function () {
  /* Arbol del seed (GET /categorias/arbol: ordenado por nombre en cada nivel). */
  var ARBOL = [
    { id: 2, nombre: 'Bebidas', subcategorias: [{ id: 6, nombre: 'Gaseosas', subcategorias: [] }] },
    { id: 1, nombre: 'Hamburguesas', subcategorias: [
      { id: 5, nombre: 'Sin TACC', subcategorias: [] },
      { id: 4, nombre: 'Veganas', subcategorias: [] }
    ] },
    { id: 3, nombre: 'Postres', subcategorias: [] }
  ];

  /* t: tono del marcador de foto (TBD fotografia); null = sin imagen (respaldo). Los marcados con * son ilustrativos (no estan en el seed). */
  var PRODUCTOS = {
    clasica:  { id: 1,  nombre: 'Hamburguesa Clásica', desc: 'La de siempre, perfecta de siempre.', precio: '1500.00', stock: 50, cat: 'Hamburguesas', t: '' },
    bbq:      { id: 2,  nombre: 'Burger BBQ Bacon', desc: 'Ahumada, crocante y con todo.', precio: '1900.00', stock: 30, cat: 'Hamburguesas', t: 't3' },
    vegana:   { id: 3,  nombre: 'Burger Vegana', desc: 'Plant-based sin culpa.', precio: '1800.00', stock: 4, cat: 'Hamburguesas', t: 't2' },
    sintacc:  { id: 4,  nombre: 'Burger Sin TACC', desc: 'Para celíacos, sin sacrificar sabor.', precio: '1700.00', stock: 20, cat: 'Hamburguesas', t: 't4' },
    coca:     { id: 5,  nombre: 'Coca-Cola 500ml', desc: 'La clásica bien fría.', precio: '800.00', stock: 100, cat: 'Bebidas', t: null },
    limonada: { id: 6,  nombre: 'Limonada Natural', desc: 'Exprimida al momento.', precio: '700.00', stock: 60, cat: 'Bebidas', t: 't2' },
    doble:    { id: 7,  nombre: 'Burger Doble Cheddar*', desc: 'Doble medallón y doble cheddar fundido.', precio: '2300.00', stock: 12, cat: 'Hamburguesas', t: '' },
    flan:     { id: 8,  nombre: 'Flan Casero*', desc: 'Con dulce de leche y crema.', precio: '900.00', stock: 2, cat: 'Postres', t: 't3' },
    brownie:  { id: 9,  nombre: 'Brownie con Helado*', desc: 'Tibio, con una bocha de americana.', precio: '1100.00', stock: 0, cat: 'Postres', t: '' },
    volcan:   { id: 10, nombre: 'Volcán de Chocolate*', desc: 'Centro fundido, recién horneado.', precio: '1250.50', stock: 8, cat: 'Postres', t: 't4' },
    agua:     { id: 11, nombre: 'Agua Mineral 500ml*', desc: 'Con o sin gas.', precio: '500.00', stock: 80, cat: 'Bebidas', t: 't4' },
    sprite:   { id: 12, nombre: 'Sprite 500ml*', desc: 'Lima limón, bien fría.', precio: '800.00', stock: 40, cat: 'Gaseosas', t: 't2' }
  };

  /* Formato de design D5: miles con «.», sin decimales si son ,00. */
  function precio(decimal) {
    var partes = decimal.split('.');
    var entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var cent = (partes[1] || '00').padEnd(2, '0');
    return '$ ' + entero + (cent === '00' ? '' : ',' + cent);
  }

  function ico(id) { return '<svg class="ico" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  function tarjeta(p) {
    var agotado = p.stock === 0, pocas = p.stock > 0 && p.stock <= 5;
    var nombre = p.nombre.replace('*', '');
    var media = p.t === null
      ? '<div class="ph none" role="img" aria-label="Sin imagen de ' + nombre + '">' + ico('i-plato') + '</div>'
      : '<div class="ph ' + p.t + '" role="img" aria-label="' + nombre + ' (foto TBD)">' + ico('i-plato') + '</div>';
    var marca = agotado ? '<span class="badge b-cancelado tag">Agotado</span>' : pocas ? '<span class="badge b-pendiente tag">Quedan ' + p.stock + '</span>' : '';
    var boton = agotado
      ? '<button class="btn btn-primary btn-sm" type="button" disabled>Agotado</button>'
      : '<button class="btn btn-primary btn-sm" type="button" aria-label="Agregar ' + nombre + ' al carrito">' + ico('i-mas') + 'Agregar</button>';
    return '<li><article class="card prod' + (agotado ? ' unavailable' : '') + '">' +
      '<div class="img">' + media + marca + '</div>' +
      '<div class="body"><span class="cat">' + p.cat + '</span>' +
      '<h3><a href="producto-detalle.html">' + nombre + '</a></h3>' +
      '<p class="desc">' + p.desc + '</p>' +
      '<div class="foot"><span class="price">' + precio(p.precio) + '</span>' + boton + '</div></div></article></li>';
  }

  function nodo(n, actual, ancestros) {
    var esActual = n.id === actual;
    var html = '<li><button class="tree-item' + (ancestros.indexOf(n.id) !== -1 ? ' is-ancestor' : '') + '" type="button"' + (esActual ? ' aria-current="true"' : '') + '>' + n.nombre + '</button>';
    if (n.subcategorias.length) {
      html += '<ul>' + n.subcategorias.map(function (h) { return nodo(h, actual, ancestros); }).join('') + '</ul>';
    }
    return html + '</li>';
  }

  /* actual: id elegido o null (= «Todas»); ancestros: ids padres de la actual (tono de acento). */
  function arbol(actual, ancestros) {
    return '<nav aria-label="Categorías"><ul class="tree">' +
      '<li><button class="tree-item" type="button"' + (actual === null ? ' aria-current="true"' : '') + '>Todas</button></li>' +
      ARBOL.map(function (n) { return nodo(n, actual, ancestros || []); }).join('') + '</ul></nav>';
  }

  function chip(texto) {
    return '<span class="chip">' + texto + '<button type="button" aria-label="Quitar filtro ' + texto.replace(/[«»"]/g, '') + '">' + ico('i-cerrar') + '</button></span>';
  }


  /* Contenido de filtros (columna desktop y hoja mobile). o: {actual, ancestros, min, max, errMax, stock, idp} */
  function filtros(o) {
    var idp = o.idp || 'd';
    var err = o.errMax ? ' aria-invalid="true" aria-describedby="' + idp + '-err"' : '';
    return '<section class="f-sec" aria-labelledby="' + idp + '-cat"><h2 class="f-title" id="' + idp + '-cat">Categorías</h2>' + arbol(o.actual, o.ancestros) + '</section>' +
      '<section class="f-sec" aria-labelledby="' + idp + '-pre"><h2 class="f-title" id="' + idp + '-pre">Precio</h2>' +
        '<form class="range" onsubmit="return false">' +
          '<div class="field"><label for="' + idp + '-min">Mínimo</label><div class="input-money"><span aria-hidden="true">$</span><input class="input" id="' + idp + '-min" inputmode="numeric" placeholder="0" value="' + (o.min || '') + '"></div></div>' +
          '<div class="field"><label for="' + idp + '-max">Máximo</label><div class="input-money"><span aria-hidden="true">$</span><input class="input" id="' + idp + '-max" inputmode="numeric" placeholder="Sin tope" value="' + (o.max || '') + '"' + err + '></div></div>' +
          (o.errMax ? '<span class="err" id="' + idp + '-err" style="grid-column:1 / -1">' + o.errMax + '</span>' : '') +
          '<button class="btn btn-secondary btn-sm" type="submit" style="grid-column:1 / -1">Aplicar</button>' +
        '</form></section>' +
      '<section class="f-sec" aria-labelledby="' + idp + '-dis"><h2 class="f-title" id="' + idp + '-dis">Disponibilidad</h2>' +
        '<label class="switch"><span>Solo con stock<small>Oculta los productos agotados</small></span><input type="checkbox" role="switch"' + (o.stock ? ' checked' : '') + '></label></section>';
  }

  /* Buscador + (mobile) chips de categorias raiz y boton Filtros. o: {q, actual, nFiltros} */
  function barra(o) {
    var raiz = [null].concat(ARBOL.map(function (n) { return n.id; }));
    var nombres = { null: 'Todas' }; ARBOL.forEach(function (n) { nombres[n.id] = n.nombre; });
    var pills = raiz.map(function (id) {
      var on = id === o.actualRaiz;
      return '<button class="pill" type="button" aria-pressed="' + on + '">' + nombres[id] + '</button>';
    }).join('');
    return '<div class="search" role="search">' + ico('i-buscar') +
        '<label class="sr" for="q">Buscar productos</label><input class="input" id="q" type="search" placeholder="Buscar productos" value="' + (o.q || '') + '">' +
        (o.q ? '<button class="icon-btn" type="button" aria-label="Borrar búsqueda">' + ico('i-cerrar') + '</button>' : '') +
      '</div>' +
      '<div class="mob-bar"><div class="mob-row"><div class="cat-scroll" role="group" aria-label="Categorías principales">' + pills + '</div>' +
        '<button class="btn btn-secondary btn-filtros" type="button" aria-haspopup="dialog">' + ico('i-filtros') + 'Filtros' +
        (o.nFiltros ? '<span class="count" aria-label="' + o.nFiltros + ' aplicados">' + o.nFiltros + '</span>' : '') + '</button></div></div>';
  }

  window.MOCK = {
    ARBOL: ARBOL, P: PRODUCTOS, precio: precio, tarjeta: tarjeta, arbol: arbol, chip: chip, ico: ico, filtros: filtros, barra: barra,
    estado: new URLSearchParams(location.search).get('estado'),
    llenar: function (id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
  };
})();
