// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { claseEstado, ESTADOS_PEDIDO } from '../../src/entities/pedido/model/estados';
import { declaracionesFontFace, primeraFamiliaDeToken, urlsRemotas } from './fuentes';

const RAIZ = process.cwd();
const ENTRADA = resolve(RAIZ, 'src/app/styles/index.css');

/** Compila `index.css` como lo hace Vite (imports con alias + Tailwind) sin levantar Vite ni hacer build. */
async function compilar(contenido?: string): Promise<string> {
  const configuracion = contenido === undefined ? config : { ...config, content: [{ raw: contenido, extension: 'html' }] };
  const resultado = await postcss([
    postcssImport({
      resolve: (id: string, base: string) =>
        id.startsWith('@design-system/') ? resolve(RAIZ, '../design-system', id.slice('@design-system/'.length)) : resolve(base, id),
    }),
    tailwindcss(configuracion),
  ]).process(readFileSync(ENTRADA, 'utf8'), { from: ENTRADA });
  return resultado.css;
}

describe('hoja de estilos de la app', () => {
  it('compila con Tailwind e incluye tokens, reglas del shell y utilidades usadas', async () => {
    const css = await compilar();

    expect(css).toContain('--color-primary:');
    expect(css).toContain('.sidebar.is-collapsed');
    expect(css).toContain('.shell.drawer-open>.scrim');
    expect(css).toContain('svg.ico');
    expect(css).toMatch(/\.flex-1\s*\{/);
    expect(css).toMatch(/\.min-h-tap\s*\{[^}]*min-height:\s*var\(--tap-min\)/);
  });

  it('todos los @import van antes de cualquier otra regla (el navegador ignora los tardíos; verify C-16b)', () => {
    const lineas = readFileSync(ENTRADA, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('/*') && !l.startsWith('*'));
    const primeraNoImport = lineas.findIndex((l) => !l.startsWith('@import'));
    const importsTardios = lineas.slice(primeraNoImport).filter((l) => l.startsWith('@import'));

    expect(importsTardios).toEqual([]);
  });

  it('incluye las reglas del detalle de producto', async () => {
    const css = await compilar();

    expect(css).toMatch(/\.pd\s*\{[^}]*grid-template-columns/);
  });

  it('los títulos conservan el peso del design system aunque el preflight de Tailwind lo reinicie (verify V-1)', async () => {
    const css = await compilar();

    expect(css).toMatch(/h1,\s*h2,\s*h3\s*\{[^}]*font-weight:\s*700/);
  });

  it('el tamaño base del ícono no le gana a las utilidades de tamaño (verify V-2)', async () => {
    const css = await compilar('<svg class="ico h-10 w-10"></svg>');

    // :where() deja la regla base con especificidad 0, así `.h-10` (capa utilities) puede redimensionar el ícono.
    expect(css).toMatch(/:where\(svg\.ico\)\s*\{[^}]*width:\s*22px/);
    expect(css).not.toMatch(/(^|[\s,}])svg\.ico\s*\{/);
    expect(css).toMatch(/\.h-10\s*\{[^}]*height:\s*2\.5rem/);
  });

  it('las utilidades del tema salen como variables del design system, sin literales', async () => {
    const css = await compilar('<div class="bg-primary p-4 rounded-md text-text-muted"></div>');

    expect(css).toMatch(/\.bg-primary\s*\{[^}]*background-color:\s*var\(--color-primary\)/);
    expect(css).toMatch(/\.p-4\s*\{[^}]*padding:\s*var\(--space-4\)/);
    expect(css).toMatch(/\.rounded-md\s*\{[^}]*border-radius:\s*var\(--radius-md\)/);
    expect(css).toMatch(/\.text-text-muted\s*\{[^}]*color:\s*var\(--color-text-muted\)/);
  });

  it.each(ESTADOS_PEDIDO)('el distintivo de %s conserva su color: la clase dinámica no se purga (verify C-21)', async (estado) => {
    const css = await compilar();

    expect(css).toContain(`.${claseEstado(estado)}{`);
  });
});

describe('título del 404 (C-25b1, mockup aprobado de C-13a)', () => {
  it('Tailwind genera la utilidad text-[2rem] con font-size 2rem', async () => {
    const css = await compilar('<h1 class="text-[2rem]">x</h1>');

    expect(css.replace(/\s+/g, '')).toContain('.text-\\[2rem\\]{font-size:2rem;}');
  });
});

describe('fuentes autoalojadas (revision-visual 3.1, spec frontend-visual-language)', () => {
  const DESIGN_SYSTEM = resolve(RAIZ, '../design-system');

  it('detecta @font-face, familias y urls en un CSS de ejemplo', () => {
    const css = '@font-face{font-family:"Foo Sans";font-display:swap;src:url("a/foo.woff2") format("woff2"),url(b/foo.woff) format("woff")}:root{--font-x:"Foo Sans", system-ui, sans-serif}';

    expect(declaracionesFontFace(css)).toEqual([{ familia: 'Foo Sans', urls: ['a/foo.woff2', 'b/foo.woff'], fontDisplay: 'swap' }]);
    expect(primeraFamiliaDeToken(css, '--font-x')).toBe('Foo Sans');
    expect(urlsRemotas(['a/foo.woff2', 'https://fonts.gstatic.com/x.woff2', '//cdn.x/y.woff2', 'http://h/z'])).toEqual([
      'https://fonts.gstatic.com/x.woff2',
      '//cdn.x/y.woff2',
      'http://h/z',
    ]);
  });

  it('cada @font-face compilado apunta a un archivo local existente, sin urls remotas y con font-display: swap', async () => {
    const faces = declaracionesFontFace(await compilar());
    const urls = faces.flatMap((f) => f.urls);

    expect(faces.length).toBeGreaterThanOrEqual(2);
    expect(urlsRemotas(urls)).toEqual([]);
    for (const url of urls) expect(existsSync(resolve(DESIGN_SYSTEM, url)), url).toBe(true);
    for (const face of faces) expect(face.fontDisplay, face.familia).toBe('swap');
  });

  it('las familias de --font-display y --font-sans tienen su @font-face compilado', async () => {
    const css = await compilar();
    const familias = declaracionesFontFace(css).map((f) => f.familia);

    expect(primeraFamiliaDeToken(css, '--font-display')).toBe('Bricolage Grotesque');
    expect(primeraFamiliaDeToken(css, '--font-sans')).toBe('Geist');
    expect(familias).toEqual(expect.arrayContaining([primeraFamiliaDeToken(css, '--font-display'), primeraFamiliaDeToken(css, '--font-sans')]));
  });

  it('el HTML de entrada no pide hojas de estilo ni fuentes a hosts externos', () => {
    const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');

    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(html).not.toMatch(/<link[^>]+href="https?:\/\//);
  });
});

describe('utilidades de Revision 4 (revision-visual 3.2)', () => {
  it('las superficies, la presión y el z-index del encabezado salen como variables del design system', async () => {
    const css = await compilar('<div class="bg-surface-section bg-surface-raised active:scale-press z-page-header ease-drawer"></div>');

    expect(css).toMatch(/\.bg-surface-section\s*\{[^}]*background-color:\s*var\(--surface-section\)/);
    expect(css).toMatch(/\.bg-surface-raised\s*\{[^}]*background-color:\s*var\(--surface-raised\)/);
    expect(css).toMatch(/\.active\\:scale-press:active\s*\{[^}]*--tw-scale-x:\s*var\(--press-scale\)/);
    expect(css).toMatch(/\.z-page-header\s*\{[^}]*z-index:\s*var\(--z-page-header\)/);
    expect(css).toMatch(/\.ease-drawer\s*\{[^}]*var\(--ease-drawer\)/);
  });

  it('num-tabular aplica --numeric-tabular sin literales', async () => {
    const css = await compilar('<span class="num-tabular"></span>');

    expect(css).toMatch(/\.num-tabular\s*\{[^}]*font-variant-numeric:\s*var\(--numeric-tabular\)/);
  });
});

describe('entrada escalonada (revision-visual 3.5)', () => {
  it('la clase de entrada anima los hijos con retardo = min(--i, 8) × --stagger-step y existe su @keyframes', async () => {
    const css = (await compilar()).replace(/\s+/g, '');

    expect(css).toContain('@keyframesentrada');
    expect(css).toMatch(/\.stagger>:not\(\.ohead\)\{animation:entradavar\(--motion-slow\)var\(--ease-out\)both;animation-delay:calc\(min\(var\(--i,0\),8\)\*var\(--stagger-step\)\)/);
  });

  it('con movimiento reducido la entrada se anula', async () => {
    const css = (await compilar()).replace(/\s+/g, '');

    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.stagger>:not\(\.ohead\)\{animation:none/);
  });
});
