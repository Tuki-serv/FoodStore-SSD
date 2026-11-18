import { describe, expect, it } from 'vitest';
import { claseBoton } from '../button-styles';

const clases = (valor: string): string[] => valor.split(' ').filter(Boolean);

describe('claseBoton', () => {
  it('el tamaño normal usa el alto táctil y el padding horizontal de 20 px', () => {
    const resultado = clases(claseBoton('primario'));
    expect(resultado).toContain('min-h-tap');
    expect(resultado).toContain('px-5');
  });

  it('el tamaño compacto reemplaza (no suma) el alto táctil y el padding: no quedan clases de tamaño enfrentadas', () => {
    const resultado = clases(claseBoton('fantasma', { compacto: true }));
    expect(resultado).toContain('min-h-[36px]');
    expect(resultado).toContain('px-3');
    expect(resultado).not.toContain('min-h-tap');
    expect(resultado).not.toContain('px-5');
  });
});
