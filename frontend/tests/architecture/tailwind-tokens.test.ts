// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokensDeclarados, valoresInvalidos } from './tokens';

const TOKENS_CSS = new URL('../../../design-system/tokens.css', import.meta.url);

describe('tokensDeclarados', () => {
  it('lista los nombres de las custom properties declaradas, sin los usos con var()', () => {
    const css = ':root { --color-a: #fff; --space-1: 4px; --space-2: 8px; --x: var(--color-a); }';

    expect([...tokensDeclarados(css)].sort()).toEqual(['--color-a', '--space-1', '--space-2', '--x']);
  });
});

describe('valoresInvalidos', () => {
  const declarados = new Set(['--color-primary', '--space-1']);

  it('devuelve los hex literales y las variables inexistentes, recorriendo el tema anidado', () => {
    const tema = {
      colors: { primary: 'var(--color-primary)', marca: '#B8400F' },
      spacing: { 1: 'var(--space-1)', roto: 'var(--no-existe)' },
      fontFamily: { sans: ['var(--color-primary)', 'var(--tampoco)'] },
    };

    expect(valoresInvalidos(tema, declarados)).toEqual(['#B8400F', 'var(--no-existe)', 'var(--tampoco)']);
  });

  it('acepta un tema donde todo es var() declarada', () => {
    expect(valoresInvalidos({ colors: { primary: 'var(--color-primary)' }, spacing: ['var(--space-1)'] }, declarados)).toEqual([]);
  });

  it('rechaza valores literales de cualquier tipo, no solo hex', () => {
    expect(valoresInvalidos({ spacing: { a: '4px' }, zIndex: { b: 40 } }, declarados)).toEqual(['4px', '40']);
  });
});

describe('tema real de Tailwind', () => {
  it('referencia solo variables declaradas en design-system/tokens.css', async () => {
    const declarados = tokensDeclarados(readFileSync(TOKENS_CSS, 'utf8'));
    const { default: config } = await import('../../tailwind.config');

    expect(declarados.size).toBeGreaterThan(50);
    expect(valoresInvalidos(config.theme?.extend ?? {}, declarados)).toEqual([]);
  });
});
