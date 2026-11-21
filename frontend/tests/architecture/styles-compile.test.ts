// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { claseEstado, ESTADOS_PEDIDO } from '../../src/entities/pedido/model/estados';

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
