import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Icon } from '../icon/icon';

export interface FiltroActivo {
  id: string;
  /** Texto accesible del filtro («Quitar filtro <etiqueta>»). */
  etiqueta: string;
  /** Texto visible del chip; por defecto, la etiqueta. */
  texto?: string;
  onQuitar: () => void;
}

export interface FiltrosActivosProps {
  /** Conteo de resultados («12 productos»); se anuncia como estado. */
  conteo: ReactNode;
  filtros: readonly FiltroActivo[];
  /** Ofrece «Limpiar filtros» cuando hay dos o más. */
  onLimpiar?: () => void;
  conteoRef?: Ref<HTMLParagraphElement>;
}

export interface EncabezadoPaginaProps {
  /** Sin título (p. ej. detalle de producto, que conserva su h1 en el bloque del producto) la banda lleva solo la ruta. */
  titulo?: ReactNode;
  /** Sección a la que pertenece la página («Tienda», «Operación», «Administración»…). */
  eyebrow?: string;
  subtitulo?: string;
  /** Enlace de vuelta o ruta (un `Link`, o varios separados). */
  ruta?: ReactNode;
  /** Badge o texto de estado junto al título. */
  estado?: ReactNode;
  /** Metadatos a la izquierda de las acciones (conteo, período, hora de actualización). */
  metadatos?: ReactNode;
  /** Acción primaria y secundarias, alineadas a la derecha. */
  acciones?: ReactNode;
  /** Búsqueda, filtros, orden y período (barra de herramientas dentro de la banda). */
  herramientas?: ReactNode;
  filtrosActivos?: FiltrosActivosProps;
  /** Ref del h1 (queda enfocable por código, tabindex -1) para devolverle el foco tras una acción. */
  tituloRef?: Ref<HTMLHeadingElement>;
  /** En mobile y compacto la barra de herramientas se oculta (listados con filtros que no caben en un cuarto de pantalla). */
  herramientasColapsables?: boolean;
  /** Queda fija arriba del área de contenido y pasa a compacto al desplazar. Por defecto no. */
  fijo?: boolean;
}

/** Distancia desde el borde superior de la ventana a la que queda pegada la banda (la barra superior en mobile). */
function topDeBanda(banda: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(banda).top) || 0;
}

/** Conteo de resultados, chips quitables y «Limpiar filtros» (con dos o más). */
function FiltrosActivosBanda({ conteo, filtros, onLimpiar, conteoRef }: FiltrosActivosProps) {
  return (
    <div className="band-active">
      <p className="band-count" role="status" tabIndex={-1} ref={conteoRef}>
        {conteo}
      </p>
      {filtros.length === 0 ? null : (
        <div className="chips" role="group" aria-label="Filtros aplicados">
          {filtros.map((filtro) => (
            <span key={filtro.id} className="chip">
              {filtro.texto ?? filtro.etiqueta}
              <button type="button" aria-label={`Quitar filtro ${filtro.etiqueta}`} onClick={filtro.onQuitar}>
                <Icon name="cerrar" className="h-[14px] w-[14px]" />
              </button>
            </span>
          ))}
          {onLimpiar !== undefined && filtros.length >= 2 ? (
            <button type="button" className="link-btn" onClick={onLimpiar}>
              Limpiar filtros
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Banda de título de página: título, subtítulo, metadatos, acciones, herramientas y filtros activos; fija en listados (D9). */
export function EncabezadoPagina({
  titulo,
  eyebrow,
  subtitulo,
  ruta,
  estado,
  metadatos,
  acciones,
  herramientas,
  filtrosActivos,
  tituloRef,
  herramientasColapsables = false,
  fijo = false,
}: EncabezadoPaginaProps) {
  const centinelaRef = useRef<HTMLDivElement>(null);
  const bandaRef = useRef<HTMLElement>(null);
  const [compacto, setCompacto] = useState(false);
  // Cambia al cruzar el corte de 1024 px (la banda pasa a quedar bajo la barra superior): obliga a recalcular el observador.
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!fijo) return undefined;
    const banda = bandaRef.current;
    if (banda === null) return undefined;
    const alCambiarTamano = (): void => setTop(topDeBanda(banda));
    alCambiarTamano();
    window.addEventListener('resize', alCambiarTamano);
    return () => window.removeEventListener('resize', alCambiarTamano);
  }, [fijo]);

  // El centinela (alto 0, justo antes de la banda) sale por arriba cuando la banda ya quedó pegada: ahí pasa a compacto.
  useEffect(() => {
    const centinela = centinelaRef.current;
    if (!fijo || centinela === null || typeof IntersectionObserver === 'undefined') return undefined;
    const observador = new IntersectionObserver(
      (entradas) => {
        const ultima = entradas[entradas.length - 1];
        if (ultima !== undefined) setCompacto(!ultima.isIntersecting);
      },
      { rootMargin: `${-top}px 0px 0px 0px` },
    );
    observador.observe(centinela);
    return () => observador.disconnect();
  }, [fijo, top]);

  // Alto de la banda (borde inferior respecto de la ventana) para que los encabezados de tabla queden fijos justo debajo.
  useEffect(() => {
    const banda = bandaRef.current;
    if (!fijo || banda === null) return undefined;
    const raiz = document.documentElement;
    const publicar = (): void => raiz.style.setProperty('--band-h', `${topDeBanda(banda) + banda.offsetHeight}px`);
    publicar();
    const observador = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(publicar);
    observador?.observe(banda);
    return () => {
      observador?.disconnect();
      raiz.style.removeProperty('--band-h');
    };
  }, [fijo, top]);

  const hayTitulo = titulo !== undefined || estado !== undefined;
  const hayTop = hayTitulo || eyebrow !== undefined || subtitulo !== undefined || metadatos !== undefined || acciones !== undefined;

  return (
    <>
      {fijo ? <div ref={centinelaRef} aria-hidden="true" /> : null}
      <header
        ref={bandaRef}
        className={['page-band', fijo ? 'is-sticky' : '', herramientasColapsables ? 'band-tools-collapse' : ''].filter(Boolean).join(' ')}
        {...(fijo && compacto ? { 'data-stuck': 'true' } : {})}
      >
        <div className="band-inner">
          {ruta === undefined ? null : (
            <nav className="band-crumbs" aria-label="Ruta de navegación">
              {ruta}
            </nav>
          )}
          {hayTop ? (
            <div className="band-top">
              {hayTitulo || eyebrow !== undefined || subtitulo !== undefined ? (
                <div className="band-titles">
                  {eyebrow === undefined ? null : <span className="eyebrow">{eyebrow}</span>}
                  {hayTitulo ? (
                    <div className="band-h">
                      {titulo === undefined ? null : (
                        <h1 ref={tituloRef} {...(tituloRef === undefined ? {} : { tabIndex: -1 })}>
                          {titulo}
                        </h1>
                      )}
                      {estado}
                    </div>
                  ) : null}
                  {subtitulo === undefined ? null : (
                    <div className="band-sub">
                      <p>{subtitulo}</p>
                    </div>
                  )}
                </div>
              ) : null}
              {metadatos === undefined && acciones === undefined ? null : (
                <div className="band-actions">
                  {metadatos === undefined ? null : <span className="band-meta">{metadatos}</span>}
                  {acciones}
                </div>
              )}
            </div>
          ) : null}
          {herramientas === undefined ? null : <div className="band-toolbar">{herramientas}</div>}
          {filtrosActivos === undefined ? null : <FiltrosActivosBanda {...filtrosActivos} />}
        </div>
      </header>
    </>
  );
}
