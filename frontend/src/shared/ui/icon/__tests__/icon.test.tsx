import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES, Icon } from '../icon';

describe('Icon', () => {
  it('incluye los 17 íconos del design system, los 3 de los mockups de C-13a y el candado de C-13b', () => {
    expect([...ICON_NAMES].sort()).toEqual(
      [
        'catalogo', 'carrito', 'pedidos', 'direcciones', 'cuenta', 'gestion', 'categorias', 'ingredientes',
        'productos', 'usuarios', 'dashboard', 'ingresar', 'registrarse', 'salir', 'menu', 'cerrar', 'panel',
        'obra', 'brujula', 'alerta', 'candado',
      ].sort(),
    );
  });

  it('renderiza un svg decorativo con trazos propios para cada nombre', () => {
    for (const nombre of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={nombre} />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg?.querySelector('path, circle, rect')).not.toBeNull();
      unmount();
    }
  });

  it('trae los trazos del símbolo del design system (menu: tres líneas)', () => {
    const { container } = render(<Icon name="menu" />);

    expect(container.querySelector('path')).toHaveAttribute('d', 'M4 6h16M4 12h16M4 18h16');
  });
});

describe('Icon con className', () => {
  it('conserva la clase base ico y suma las clases dadas', () => {
    const { container } = render(<Icon name="obra" className="h-10 w-10" />);

    expect(container.querySelector('svg')).toHaveClass('ico', 'h-10', 'w-10');
  });
});
