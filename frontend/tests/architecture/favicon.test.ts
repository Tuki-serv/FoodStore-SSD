// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = process.cwd();
const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');
const main = readFileSync(resolve(RAIZ, 'src/main.tsx'), 'utf8');

describe('favicon de la app (C-25b1)', () => {
  it('index.html declara un <link rel="icon"> con id y sin apuntar fuera de la raíz de Vite', () => {
    const enlace = /<link[^>]*rel="icon"[^>]*>/.exec(html)?.[0] ?? '';

    expect(enlace).toContain('id="favicon"');
    // Vite reescribe `../design-system/...` a `/design-system/...` y el servidor de desarrollo responde index.html (caída a la SPA): sin ícono.
    expect(enlace).not.toMatch(/href="\.\.?\//);
    expect(enlace).not.toContain('design-system');
  });

  it('la URL del ícono sale de un import del asset por el alias, igual que logo.svg, y se aplica al arrancar', () => {
    expect(main).toMatch(/import\s+\w+\s+from\s+'@design-system\/assets\/favicon\.svg'/);
    expect(main).toMatch(/aplicarFavicon\(/);
  });

  it('el asset del ícono no lleva marcas de provisorio («PROVISIONAL» ni «TBD»), spec frontend-foundation', () => {
    const svg = readFileSync(resolve(RAIZ, '../design-system/assets/favicon.svg'), 'utf8');

    expect(svg).not.toMatch(/PROVISIONAL|TBD/i);
  });
});

describe('index.html sin marcas de provisorio (revision-visual 5.1)', () => {
  it('ningún comentario ni texto de index.html dice «provisional» ni «TBD»', () => {
    expect(html).not.toMatch(/provisional|TBD/i);
  });
});
