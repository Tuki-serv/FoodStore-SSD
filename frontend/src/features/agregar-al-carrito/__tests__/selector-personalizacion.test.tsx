import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IngredienteProducto } from '@/entities/producto';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { SelectorPersonalizacion } from '../ui/selector-personalizacion';

const ingrediente = (id: number, nombre: string, esAlergeno: boolean): IngredienteProducto => ({
  id,
  nombre,
  es_alergeno: esAlergeno,
  es_removible: true,
  cantidad: '1.000',
  unidad_medida_id: null,
});

describe('SelectorPersonalizacion: alérgeno como texto con ícono (spec «Badges solo para estados»)', () => {
  it('el ingrediente alérgeno lleva la marca «Alérgeno» sin clases de badge', () => {
    render(<SelectorPersonalizacion ingredientes={[ingrediente(1, 'Queso', true)]} excluidos={new Set()} onAlternar={() => undefined} />);

    const marca = screen.getByText('Alérgeno');
    expect(marca.className).not.toMatch(/\bbadge\b|\bb-[a-z-]+\b/);
    expect(marca).toHaveClass('al');
  });

  it('un ingrediente sin alérgeno no lleva marca', () => {
    render(<SelectorPersonalizacion ingredientes={[ingrediente(2, 'Lechuga', false)]} excluidos={new Set()} onAlternar={() => undefined} />);

    expect(screen.queryByText('Alérgeno')).not.toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <SelectorPersonalizacion ingredientes={[ingrediente(1, 'Queso', true), ingrediente(2, 'Lechuga', false)]} excluidos={new Set([1])} onAlternar={() => undefined} />,
    );

    await esperarSinViolacionesA11y(container);
  });
});
