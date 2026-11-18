import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Notificaciones } from '@/app/layouts/app-shell/notificaciones';

/** Renderiza `ui` dentro de un router en memoria con el host de notificaciones del shell (para ver los avisos de `notificar`). */
export function renderConToasts(ui: ReactNode, ruta = '/catalogo') {
  const usuario = userEvent.setup();
  const vista = render(
    <MemoryRouter initialEntries={[ruta]}>
      {ui}
      <Notificaciones />
    </MemoryRouter>,
  );
  return { usuario, ...vista };
}
