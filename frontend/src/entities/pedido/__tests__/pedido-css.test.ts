// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(resolve(process.cwd(), 'src/entities/pedido/ui/pedido.css'), 'utf8');

describe('pedido.css', () => {
  it('no contiene caracteres de control (un escape CSS mal escrito dejó un NUL en las comillas del motivo)', () => {
    // eslint-disable-next-line no-control-regex
    expect(CSS).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
  });

  it('las comillas del motivo del historial son « y » escritas como escapes CSS', () => {
    expect(CSS).toContain(String.raw`quotes:"\00AB" "\00BB"`);
  });
});
