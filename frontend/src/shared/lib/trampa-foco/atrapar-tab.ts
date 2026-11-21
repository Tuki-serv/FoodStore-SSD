/** Elementos que reciben foco con el teclado dentro de un diálogo modal. */
export const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Lo mínimo del evento de teclado que necesita la trampa (compatible con el de React y el del DOM). */
interface EventoTab {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
}

/**
 * Trampa de foco: con Tab en el último enfocable de `contenedor` vuelve al primero y con Shift+Tab en el primero
 * (o en el propio contenedor) pasa al último. Con cualquier otra tecla no hace nada.
 */
export function atraparTab(evento: EventoTab, contenedor: HTMLElement): void {
  if (evento.key !== 'Tab') return;
  const focusables = Array.from(contenedor.querySelectorAll<HTMLElement>(FOCUSABLES));
  const primero = focusables[0];
  const ultimo = focusables[focusables.length - 1];
  if (primero === undefined || ultimo === undefined) {
    evento.preventDefault();
    return;
  }
  const activo = document.activeElement;
  if (evento.shiftKey && (activo === primero || activo === contenedor)) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && activo === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
}
