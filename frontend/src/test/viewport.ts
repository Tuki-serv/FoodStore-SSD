/**
 * `matchMedia` controlable para jsdom (que no evalúa media queries).
 * Soporta `(min-width: Npx)` y `(max-width: Npx)`; `setViewport(ancho)` actualiza
 * todas las consultas vivas y dispara sus listeners `change`.
 */
type Escucha = (evento: MediaQueryListEvent) => void;

interface ConsultaViva {
  media: string;
  matches: boolean;
  escuchas: Set<Escucha>;
  lista: MediaQueryList;
}

const ANCHO_POR_DEFECTO = 1440;
let anchoActual = ANCHO_POR_DEFECTO;
const consultas = new Set<ConsultaViva>();

function evaluar(media: string, ancho: number): boolean {
  const min = /\(\s*min-width:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(media);
  const max = /\(\s*max-width:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(media);
  if (!min && !max) return false;
  const cumpleMin = min?.[1] === undefined || ancho >= Number(min[1]);
  const cumpleMax = max?.[1] === undefined || ancho <= Number(max[1]);
  return cumpleMin && cumpleMax;
}

function crearLista(media: string): MediaQueryList {
  const consulta = { media, matches: evaluar(media, anchoActual), escuchas: new Set<Escucha>() } as ConsultaViva;
  const lista = {
    get matches() {
      return consulta.matches;
    },
    media,
    onchange: null,
    addEventListener: (tipo: string, escucha: EventListenerOrEventListenerObject) => {
      if (tipo === 'change' && typeof escucha === 'function') consulta.escuchas.add(escucha as Escucha);
    },
    removeEventListener: (tipo: string, escucha: EventListenerOrEventListenerObject) => {
      if (tipo === 'change' && typeof escucha === 'function') consulta.escuchas.delete(escucha as Escucha);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
  consulta.lista = lista;
  consultas.add(consulta);
  return lista;
}

export function instalarMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string) => crearLista(media),
  });
}

/** Cambia el ancho simulado y avisa a quienes escuchan `change`. Envolver en `act` si hay componentes montados. */
export function setViewport(ancho: number): void {
  anchoActual = ancho;
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: ancho });
  for (const consulta of consultas) {
    const nuevo = evaluar(consulta.media, ancho);
    if (nuevo === consulta.matches) continue;
    consulta.matches = nuevo;
    const evento = { matches: nuevo, media: consulta.media } as MediaQueryListEvent;
    for (const escucha of consulta.escuchas) escucha(evento);
  }
}

export function restablecerViewport(): void {
  consultas.clear();
  setViewport(ANCHO_POR_DEFECTO);
}
