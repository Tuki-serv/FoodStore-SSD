import type { UseQueryResult } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { claseBoton, EstadoError, EstadoVacio, Icon } from '@/shared/ui';
import { TablaDatos } from './tabla-datos';

/** Datos de la tabla equivalente de un gráfico. */
export interface DatosTabla {
  columnas: readonly string[];
  filas: readonly (readonly ReactNode[])[];
}

export interface BloqueGraficoProps<T> {
  titulo: string;
  subtitulo: string;
  consulta: UseQueryResult<T>;
  /** `true` si el reporte llegó pero no tiene nada que graficar en el período. */
  estaVacio: (datos: T) => boolean;
  vacio: { titulo: string; texto: string };
  /** Detalle del error de este bloque (los demás siguen funcionando). */
  textoError: string;
  /** El gráfico; el bloque lo oculta a la tecnología asistiva y a la vista con «Ver como tabla». */
  renderGrafico: (datos: T) => ReactNode;
  renderTabla: (datos: T) => DatosTabla;
}

/**
 * Bloque común de los cuatro gráficos: título, «Ver como tabla», gráfico (decorativo, `aria-hidden`) y su tabla equivalente,
 * más los estados de carga (esqueleto), vacío y error con «Reintentar» que vuelve a pedir solo este reporte.
 */
export function BloqueGrafico<T>({ titulo, subtitulo, consulta, estaVacio, vacio, textoError, renderGrafico, renderTabla }: BloqueGraficoProps<T>) {
  const idTitulo = useId();
  const [verTabla, setVerTabla] = useState(false);
  const { data } = consulta;
  const etiquetaVista = verTabla ? 'Ver gráfico' : 'Ver como tabla';
  const conDatos = data !== undefined && !estaVacio(data);

  return (
    <section className="bloque" aria-labelledby={idTitulo}>
      <header className="bloque-head">
        <div>
          <h2 id={idTitulo}>{titulo}</h2>
          <p className="bloque-sub">{subtitulo}</p>
        </div>
        {conDatos ? (
          <button
            type="button"
            className={`${claseBoton('fantasma', { compacto: true })} toggle !border !border-border max-[719px]:!min-h-[44px] max-[719px]:!min-w-[44px] max-[719px]:!px-0`}
            aria-label={etiquetaVista}
            onClick={() => setVerTabla(!verTabla)}
          >
            <Icon name={verTabla ? 'grafico' : 'tabla'} />
            <span className="lbl">{etiquetaVista}</span>
          </button>
        ) : null}
      </header>
      {data === undefined ? (
        consulta.isError ? (
          <EstadoError titulo="No pudimos cargar este gráfico" detalle={textoError} onReintentar={() => void consulta.refetch()} />
        ) : (
          <div className="skel-chart" role="status" aria-busy="true" aria-label={`Cargando ${titulo}`}>
            {[0, 1, 2, 3, 4, 5].map((indice) => (
              <span key={indice} className="skel" />
            ))}
          </div>
        )
      ) : estaVacio(data) ? (
        <EstadoVacio icono="vacio" titulo={vacio.titulo} texto={vacio.texto} region={false} />
      ) : (
        <>
          <div className="chart-box" aria-hidden="true" hidden={verTabla}>
            {renderGrafico(data)}
          </div>
          <TablaDatos titulo={titulo} visible={verTabla} {...renderTabla(data)} />
        </>
      )}
    </section>
  );
}
