import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Precio } from '../ui/precio';

describe('Precio', () => {
  it('por defecto es un solo texto «$ 1.500»', () => {
    const { container } = render(<Precio valor="1500.00" />);

    expect(container.querySelector('.price')).toHaveTextContent('$ 1.500');
    expect(container.querySelector('small')).toBeNull();
  });

  it.each([
    ['1500.00', '1.500'],
    ['2300.50', '2.300,50'],
  ])('con simboloChico separa el «$» en <small> y deja el importe de %s como «%s»', (valor, importe) => {
    const { container } = render(<Precio valor={valor} simboloChico />);

    expect(container.querySelector('small')).toHaveTextContent('$');
    expect(container.querySelector('.price')).toHaveTextContent(`$ ${importe}`);
  });
});
