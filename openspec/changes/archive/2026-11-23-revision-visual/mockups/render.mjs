// Renderiza los mockups con playwright-core + Microsoft Edge instalado (viewport real, movimiento reducido). Uso: node render.mjs [regex] (playwright-core: un node_modules cercano o la variable PLAYWRIGHT_CORE).
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
// PLAYWRIGHT_CORE = ruta a la carpeta del paquete playwright-core si no esta en un node_modules cercano.
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href : 'playwright-core');
import fs from 'node:fs';
const DIR = path.dirname(fileURLToPath(import.meta.url)) + '/'; // carpeta mockups/
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html'));
const extra = [
  ['shell-admin.html?nav=collapsed', 'shell-admin-collapsed', 'd'], ['shell-admin.html?nav=drawer', 'shell-admin-drawer', 'm'],
  ['catalogo-vacio.html?estado=error', 'catalogo-vacio-error', 'dm'], ['producto-detalle.html?estado=agotado', 'producto-detalle-agotado', 'dm'],
  ['producto-personalizar.html?estado=agregado', 'producto-personalizar-agregado', 'dm'], ['carrito.html?estado=vaciar', 'carrito-vaciar', 'dm'],
  ['finalizar-compra.html?estado=efectivo', 'finalizar-compra-efectivo', 'd'], ['finalizar-compra.html?error=stock', 'finalizar-compra-error-stock', 'dm'],
  ['finalizar-compra.html?estado=enviando', 'finalizar-compra-enviando', 'd'], ['pedido-creado-pago.html?pago=rechazado', 'pedido-creado-pago-rechazado', 'dm'],
  ['pago-pedido.html?estado=pendiente', 'pago-pedido-pendiente', 'dm'], ['pago-pedido.html?estado=aprobado', 'pago-pedido-aprobado', 'd'],
  ['pago-pedido.html?estado=rechazado', 'pago-pedido-rechazado', 'd'], ['ingresar.html?estado=error', 'ingresar-error', 'd'],
  ['direcciones-lista.html?estado=eliminar', 'direcciones-eliminar', 'm']
];
const jobs = [];
for (const f of files) for (const v of 'dm') jobs.push([f, f.replace('.html', ''), v, true]);
for (const [u, n, vs] of extra) for (const v of vs) jobs.push([u, n, v, true]);
jobs.push(['catalogo.html', 'catalogo-motion', 'd', false]);
// Capturas «desplazadas»: viewport fijo, la lista ya se movio debajo del encabezado fijo (D9).
for (const [u, n, v, y] of [['catalogo.html', 'catalogo-scrolled', 'd', 640], ['gestion-pedidos.html', 'gestion-pedidos-scrolled', 'd', 360],
  ['catalogo.html', 'catalogo-scrolled', 'm', 900], ['gestion-pedidos.html', 'gestion-pedidos-scrolled', 'm', 700]]) jobs.push([u, n, v, true, y]);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
for (const [u, name, v, reduce, scrollY] of jobs) {
  if (only && !only.test(name)) continue;
  const mobile = v === 'm';
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1,
    isMobile: mobile, hasTouch: mobile, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) problems.push('EXTERNAL ' + r.url()); });
  page.on('requestfailed', (r) => problems.push('FAILED ' + r.url()));
  const [p, q] = u.split('?');
  await page.goto(pathToFileURL(DIR + p).href + (q ? '?' + q : ''));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(reduce ? 250 : 1200);
  const info = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, fonts: [...document.fonts].filter((f) => f.status === 'loaded').length }));
  const out = DIR + 'previews/' + name + (mobile ? '-mobile' : '-desktop') + '.png';
  const dialog = /producto-detalle|producto-personalizar|drawer|vaciar|eliminar|dialogos|desactivar|filtros|agregado/.test(name);
  if (scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(400);
    const band = await page.evaluate(() => { const b = document.querySelector('.page-band.is-sticky'); return b ? { stuck: b.classList.contains('is-stuck'), h: Math.round(b.getBoundingClientRect().bottom) } : null; });
    problems.push.apply(problems, band && band.stuck ? [] : ['band not stuck']);
    report.push('   band ' + name + ' bottom=' + (band && band.h));
    await page.screenshot({ path: out });
  } else if (!mobile) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (h > 900) { await page.setViewportSize({ width: 1440, height: h }); await page.waitForTimeout(150); }
    await page.screenshot({ path: out });
  } else {
    await page.screenshot({ path: out, fullPage: !dialog });
    if (/^producto-(detalle|personalizar)$/.test(name)) {
      await page.evaluate(() => document.querySelectorAll('.buybar').forEach((b) => { b.style.position = 'static'; }));
      await page.screenshot({ path: out.replace('-mobile.png', '-mobile-full.png'), fullPage: true });
    }
  }
  const bad = info.sw !== (mobile ? 390 : 1440) || info.fonts < 2 || problems.length;
  report.push(`${bad ? 'XX' : 'ok'} ${name}-${mobile ? 'm' : 'd'} sw=${info.sw} fonts=${info.fonts} ${problems.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(report.filter((r) => !r.startsWith('ok')).join(String.fromCharCode(10)) || 'all ok');
console.log(report.length + ' captures');
