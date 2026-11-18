import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '../axe';

describe('esperarSinViolacionesA11y', () => {
  it('falla nombrando la violación image-alt cuando una imagen no tiene texto alternativo', async () => {
    const { container } = render(<img src="x.png" />);

    await expect(esperarSinViolacionesA11y(container)).rejects.toThrow(/image-alt/);
  });

  it('pasa con un botón con nombre accesible', async () => {
    const { container } = render(<button type="button">Ok</button>);

    await expect(esperarSinViolacionesA11y(container)).resolves.toBeUndefined();
  });

  it('falla con un botón sin nombre accesible (button-name)', async () => {
    const { container } = render(<button type="button" />);

    await expect(esperarSinViolacionesA11y(container)).rejects.toThrow(/button-name/);
  });
});
