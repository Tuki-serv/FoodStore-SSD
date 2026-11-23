// @vitest-environment node
import { readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { archivosCss } from './css-src';
import { selectoresHoverSueltos } from './hover';

const RAIZ = process.cwd();

describe('selectoresHoverSueltos', () => {
  it('marca :hover fuera de @media (hover: hover), incluso dentro de @layer o de otros media', () => {
    const css = `
      @layer components { .a:hover{x:1} }
      @media (prefers-reduced-motion:reduce){ .b:hover{x:1} }
      @media (max-width:700px){ .c:hover{x:1} }
    `;

    expect(selectoresHoverSueltos(css)).toEqual(['.a:hover', '.b:hover', '.c:hover']);
  });

  it('acepta :hover dentro de @media (hover: hover), con o sin otras condiciones y anidado en @layer', () => {
    const css = `
      @media (hover:hover){ .a:hover{x:1} }
      @layer components { @media (hover: hover) and (pointer: fine){ .b:hover{x:1} .c .d:hover{x:1} } }
      @media (hover:hover){ @media (min-width:10px){ .e:hover{x:1} } }
      .f:focus-visible{x:1}
    `;

    expect(selectoresHoverSueltos(css)).toEqual([]);
  });
});

describe('hover solo con puntero (spec frontend-visual-language, «Pantalla táctil»)', () => {
  it.each(archivosCss(resolve(RAIZ, 'src')).map((ruta) => [relative(RAIZ, ruta).split(sep).join('/'), ruta]))(
    '%s no tiene :hover fuera de @media (hover: hover)',
    (_nombre, ruta) => {
      expect(selectoresHoverSueltos(readFileSync(ruta as string, 'utf8'))).toEqual([]);
    },
  );

  it('las utilidades hover: de Tailwind también salen dentro de @media (hover: hover)', async () => {
    const entrada = '@tailwind utilities;';
    const resultado = await postcss([
      postcssImport(),
      tailwindcss({ ...config, content: [{ raw: '<a class="hover:bg-primary-hover hover:text-text"></a>', extension: 'html' }] }),
    ]).process(entrada, { from: undefined });

    expect(resultado.css).toContain(':hover');
    expect(selectoresHoverSueltos(resultado.css)).toEqual([]);
  });
});
