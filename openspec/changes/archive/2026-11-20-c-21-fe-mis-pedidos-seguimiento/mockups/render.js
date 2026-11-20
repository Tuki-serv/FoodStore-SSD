// Re-render: PWCORE=<ruta a playwright-core> node render.js "<ruta absoluta de mockups/>" [regex de nombres]  (Edge headless, file://)
const { chromium } = require(process.env.PWCORE);
const path = require('path');
const DIR = process.argv[2];
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
const SHOTS = [
  ['mis-pedidos-datos', 'mis-pedidos.html'],
  ['mis-pedidos-pagina', 'mis-pedidos.html?estado=pagina'],
  ['mis-pedidos-filtro', 'mis-pedidos.html?estado=filtro'],
  ['mis-pedidos-filtro-vacio', 'mis-pedidos.html?estado=filtro-vacio'],
  ['mis-pedidos-carga', 'mis-pedidos.html?estado=carga'],
  ['mis-pedidos-vacio', 'mis-pedidos.html?estado=vacio'],
  ['mis-pedidos-error', 'mis-pedidos.html?estado=error'],
  ['mis-pedidos-actualizando', 'mis-pedidos.html?estado=actualizando'],
  ['mis-pedidos-aviso', 'mis-pedidos.html?estado=aviso'],
  ['detalle-pendiente-efectivo', 'mi-pedido-detalle.html?estado=pendiente-efectivo'],
  ['detalle-pendiente-mp', 'mi-pedido-detalle.html?estado=pendiente-mp'],
  ['detalle-pendiente-mp-sin-pago', 'mi-pedido-detalle.html?estado=pendiente-mp-sin-pago'],
  ['detalle-confirmado-mp', 'mi-pedido-detalle.html?estado=confirmado-mp'],
  ['detalle-en-prep', 'mi-pedido-detalle.html?estado=en-prep'],
  ['detalle-en-camino', 'mi-pedido-detalle.html?estado=en-camino'],
  ['detalle-en-camino-retiro', 'mi-pedido-detalle.html?estado=en-camino-retiro'],
  ['detalle-entregado', 'mi-pedido-detalle.html?estado=entregado'],
  ['detalle-cancelado', 'mi-pedido-detalle.html?estado=cancelado'],
  ['detalle-carga', 'mi-pedido-detalle.html?estado=carga'],
  ['detalle-no-encontrado', 'mi-pedido-detalle.html?estado=no-encontrado'],
  ['detalle-error', 'mi-pedido-detalle.html?estado=error'],
  ['detalle-historial-error', 'mi-pedido-detalle.html?estado=historial-error'],
  ['detalle-actualizando', 'mi-pedido-detalle.html?estado=actualizando'],
  ['detalle-aviso', 'mi-pedido-detalle.html?estado=aviso'],
  ['dialogo-cancelar', 'dialogos.html?dialogo=cancelar'],
  ['dialogo-cancelar-sin-motivo', 'dialogos.html?dialogo=cancelar-sin-motivo'],
  ['dialogo-cancelar-enviando', 'dialogos.html?dialogo=cancelar-enviando'],
  ['dialogo-cancelar-mp', 'dialogos.html?dialogo=cancelar-mp'],
  ['dialogo-transicion', 'dialogos.html?dialogo=transicion'],
  ['dialogo-conexion', 'dialogos.html?dialogo=conexion'],
  ['dialogo-exito', 'dialogos.html?dialogo=exito'],
];
const FULL = /^(mis-pedidos-datos|detalle-(pendiente-efectivo|pendiente-mp|confirmado-mp|en-prep|cancelado))$/;
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const report = [];
  for (const [vp, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', isMobile: vp === 'mobile', hasTouch: vp === 'mobile', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
    for (const [name, url] of SHOTS) {
      if (only && !only.test(name)) continue;
      errs.length = 0;
      await page.goto('file:///' + DIR.replace(/\\/g, '/') + '/' + url);
      await page.waitForTimeout(150);
      const over = await page.evaluate(() => {
        const de = document.documentElement; const out = [];
        if (de.scrollWidth > de.clientWidth) out.push('hscroll ' + de.scrollWidth + '>' + de.clientWidth);
        document.querySelectorAll('.modal').forEach(m => { const r = m.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1) out.push('modal clipped ' + JSON.stringify([r.top, r.bottom, innerHeight])); if (m.scrollHeight > m.clientHeight + 1) out.push('modal scrolls ' + m.scrollHeight + '/' + m.clientHeight); });
        document.querySelectorAll('main *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed') out.push('overflow ' + el.tagName + '.' + el.className + ' ' + Math.round(r.right)); });
        return out.slice(0, 6);
      });
      await page.screenshot({ path: path.join(DIR, 'previews', `${name}-${vp}.png`) });
      if (FULL.test(name)) await page.screenshot({ path: path.join(DIR, 'previews', 'full', `${name}-${vp}.png`), fullPage: true });
      if (over.length || errs.length) report.push(`${name}-${vp}: ${over.concat(errs).join(' | ')}`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(report.length ? report.join('\n') : 'OK: sin errores de consola ni desbordes');
})();
