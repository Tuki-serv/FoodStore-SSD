// Re-render: PWCORE=<ruta a playwright-core> node render.js "<ruta absoluta de mockups/>" [regex de nombres]  (Edge headless, file://)
const { chromium } = require(process.env.PWCORE);
const path = require('path');
const DIR = process.argv[2];
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
const SHOTS = [
  ['gestion-pedidos-datos', 'gestion-pedidos.html'],
  ['gestion-pedidos-admin', 'gestion-pedidos.html?rol=admin'],
  ['gestion-pedidos-filtros', 'gestion-pedidos.html?estado=filtros'],
  ['gestion-pedidos-rango', 'gestion-pedidos.html?estado=rango'],
  ['gestion-pedidos-carga', 'gestion-pedidos.html?estado=carga'],
  ['gestion-pedidos-vacio', 'gestion-pedidos.html?estado=vacio'],
  ['gestion-pedidos-sin-resultados', 'gestion-pedidos.html?estado=sin-resultados'],
  ['gestion-pedidos-error', 'gestion-pedidos.html?estado=error'],
  ['gestion-pedidos-aviso', 'gestion-pedidos.html?estado=aviso'],
  ['gestion-pedidos-actualizando', 'gestion-pedidos.html?estado=actualizando'],
  ['gestion-pedidos-avance', 'gestion-pedidos.html?estado=avance'],
  ['gestion-pedidos-client', 'gestion-pedidos.html?rol=client'],
  ['detalle-pendiente-efectivo', 'gestion-pedido-detalle.html?estado=pendiente-efectivo'],
  ['detalle-pendiente-mp', 'gestion-pedido-detalle.html?estado=pendiente-mp&rol=admin'],
  ['detalle-confirmado', 'gestion-pedido-detalle.html?estado=confirmado'],
  ['detalle-en-prep', 'gestion-pedido-detalle.html?estado=en-prep'],
  ['detalle-en-camino', 'gestion-pedido-detalle.html?estado=en-camino&rol=admin'],
  ['detalle-entregado', 'gestion-pedido-detalle.html?estado=entregado'],
  ['detalle-cancelado', 'gestion-pedido-detalle.html?estado=cancelado'],
  ['detalle-carga', 'gestion-pedido-detalle.html?estado=carga'],
  ['detalle-no-encontrado', 'gestion-pedido-detalle.html?estado=no-encontrado'],
  ['detalle-historial-error', 'gestion-pedido-detalle.html?estado=historial-error'],
  ['detalle-client', 'gestion-pedido-detalle.html?rol=client'],
  ['dialogo-confirmar-pago', 'dialogos.html?dialogo=confirmar-pago'],
  ['dialogo-confirmar-pago-enviando', 'dialogos.html?dialogo=confirmar-pago-enviando'],
  ['dialogo-confirmar-pago-sin-stock', 'dialogos.html?dialogo=confirmar-pago-sin-stock'],
  ['dialogo-avance', 'dialogos.html?dialogo=avance'],
  ['dialogo-despachar', 'dialogos.html?dialogo=despachar'],
  ['dialogo-entregar', 'dialogos.html?dialogo=entregar'],
  ['dialogo-transicion', 'dialogos.html?dialogo=transicion'],
  ['dialogo-conexion', 'dialogos.html?dialogo=conexion'],
  ['dialogo-cancelar', 'dialogos.html?dialogo=cancelar'],
  ['dialogo-cancelar-sin-motivo', 'dialogos.html?dialogo=cancelar-sin-motivo'],
  ['dialogo-cancelar-sin-stock', 'dialogos.html?dialogo=cancelar-sin-stock'],
  ['dialogo-cancelar-confirmado', 'dialogos.html?dialogo=cancelar-confirmado'],
  ['dialogo-exito', 'dialogos.html?dialogo=exito'],
];
const FULL = /^(gestion-pedidos-(datos|filtros)|detalle-(pendiente-efectivo|en-camino|confirmado))$/;
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
        return out;
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
