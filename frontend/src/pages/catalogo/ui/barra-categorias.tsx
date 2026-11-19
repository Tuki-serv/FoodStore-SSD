import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { buscarCategoria, raices, type CategoriaNodo } from '@/entities/categoria';
import type { ApiError } from '@/shared/api';
import { AvisoArbol } from './aviso-arbol';

export interface BarraCategoriasProps {
  /** `escritorio`: chips envueltos, segunda fila de subcategorías y aviso si el árbol falla; `mobile`: chips desplazables. */
  variante: 'escritorio' | 'mobile';
  arbol: UseQueryResult<CategoriaNodo[], ApiError>;
  /** Categoría elegida (raíz o subcategoría); `null` si no hay ninguna. */
  categoriaActual: number | null;
  /** Id de la raíz que contiene a la categoría elegida; `null` si no hay ninguna. */
  raizActual: number | null;
  onElegirCategoria: (id: number | null) => void;
  /** Herramientas a la derecha de los chips: «Precio» y «Solo con stock» (escritorio) o «Filtros» (mobile). */
  children?: ReactNode;
}

function Pill({ texto, activa, subnivel = false, onClick }: { texto: string; activa: boolean; subnivel?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={subnivel ? 'pill sub' : 'pill'} aria-pressed={activa} onClick={onClick}>
      {texto}
    </button>
  );
}

/** Segunda fila: «Todas» elige la raíz y cada chip una subcategoría (con nietos, la marca si la elegida está en su subárbol). */
function FilaSubcategorias({ raiz, categoriaActual, onElegir }: { raiz: CategoriaNodo; categoriaActual: number | null; onElegir: (id: number) => void }) {
  return (
    <div className="sub-row" role="group" aria-label={`Subcategorías de ${raiz.nombre}`}>
      <span className="sub-label" aria-hidden="true">
        {raiz.nombre}
      </span>
      <Pill subnivel texto="Todas" activa={categoriaActual === raiz.id} onClick={() => onElegir(raiz.id)} />
      {raiz.subcategorias.map((hija) => (
        <Pill key={hija.id} subnivel texto={hija.nombre} activa={categoriaActual !== null && buscarCategoria([hija], categoriaActual) !== undefined} onClick={() => onElegir(hija.id)} />
      ))}
    </div>
  );
}

/** Barra de categorías bajo el buscador: chips de primer nivel y, a la derecha, las herramientas de cada ancho. */
export function BarraCategorias({ variante, arbol, categoriaActual, raizActual, onElegirCategoria, children }: BarraCategoriasProps) {
  const escritorio = variante === 'escritorio';
  const nodos = arbol.data === undefined ? undefined : raices(arbol.data);
  const raiz = escritorio && raizActual !== null ? nodos?.find((nodo) => nodo.id === raizActual) : undefined;
  const claseChips = escritorio ? 'cat-pills' : 'cat-scroll';

  let chips: ReactNode;
  if (nodos !== undefined) {
    chips = (
      <div className={claseChips} role="group" aria-label="Categorías principales">
        <Pill texto="Todas" activa={raizActual === null} onClick={() => onElegirCategoria(null)} />
        {nodos.map((nodo) => (
          <Pill key={nodo.id} texto={nodo.nombre} activa={raizActual === nodo.id} onClick={() => onElegirCategoria(nodo.id)} />
        ))}
      </div>
    );
  } else if (escritorio && arbol.isError) {
    chips = <AvisoArbol arbol={arbol} />;
  } else {
    chips = <div className={claseChips} />;
  }

  return (
    <div className={escritorio ? 'desk-bar' : 'mob-bar'}>
      <div className={escritorio ? 'desk-row' : 'mob-row'}>
        {chips}
        {children}
      </div>
      {raiz !== undefined && raiz.subcategorias.length > 0 ? <FilaSubcategorias raiz={raiz} categoriaActual={categoriaActual} onElegir={onElegirCategoria} /> : null}
    </div>
  );
}
