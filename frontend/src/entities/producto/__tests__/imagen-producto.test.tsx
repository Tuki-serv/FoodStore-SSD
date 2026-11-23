import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImagenProducto } from '../index';

describe('ImagenProducto — respaldo tipográfico', () => {
  it('sin imágenes muestra la inicial en mayúscula, el nombre accesible «Sin imagen de …» y ninguna <img>', () => {
    const { container } = render(<ImagenProducto nombre="Limonada Natural" url={null} />);

    const respaldo = screen.getByRole('img', { name: 'Sin imagen de Limonada Natural' });
    expect(respaldo).toHaveTextContent('L');
    expect(container.querySelector('img')).toBeNull();
  });

  it.each([
    ['limonada', 'L'],
    ['Ñoquis', 'Ñ'],
    ['ñandú', 'Ñ'],
    ['Éclair', 'É'],
    ['"7 quesos"', '7'],
    ['(áspic)', 'Á'],
  ])('la inicial de «%s» es «%s» (Unicode, conserva tildes, salta los signos)', (nombre, inicial) => {
    render(<ImagenProducto nombre={nombre} url={null} />);

    expect(screen.getByRole('img', { name: `Sin imagen de ${nombre}` })).toHaveTextContent(inicial);
  });

  it('sin ningún carácter alfanumérico en el nombre muestra el ícono en lugar de una inicial', () => {
    const { container } = render(<ImagenProducto nombre="***" url={null} />);

    const respaldo = screen.getByRole('img', { name: 'Sin imagen de ***' });
    expect(respaldo.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('.ph-initial')).toBeNull();
  });

  it('una imagen que no carga se reemplaza por el respaldo con la inicial', () => {
    const { container } = render(<ImagenProducto nombre="Flan" url="https://img.test/rota.png" />);

    fireEvent.error(screen.getByRole('img', { name: 'Flan' }));

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Sin imagen de Flan' })).toHaveTextContent('F');
  });

  it('dos productos de categorías distintas usan el mismo respaldo de marca (misma clase, sin variantes por categoría) y difieren solo en la inicial', () => {
    render(
      <>
        <ImagenProducto nombre="Flan" url={null} />
        <ImagenProducto nombre="Hamburguesa" url={null} />
      </>,
    );

    const a = screen.getByRole('img', { name: 'Sin imagen de Flan' });
    const b = screen.getByRole('img', { name: 'Sin imagen de Hamburguesa' });
    expect(a.className).toBe(b.className);
    expect(a).toHaveTextContent('F');
    expect(b).toHaveTextContent('H');
  });

  it('con imagen la muestra con el nombre como texto alternativo', () => {
    render(<ImagenProducto nombre="Flan" url="https://img.test/flan.png" />);

    expect(screen.getByRole('img', { name: 'Flan' })).toHaveAttribute('src', 'https://img.test/flan.png');
  });

  it('el respaldo grande (detalle) agrega la variante «lg» a la misma clase base', () => {
    render(<ImagenProducto nombre="Flan" url={null} grande />);

    expect(screen.getByRole('img', { name: 'Sin imagen de Flan' })).toHaveClass('ph', 'lg');
  });
});
