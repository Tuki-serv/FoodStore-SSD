import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RUTAS } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';
import { direccionQueries } from '../api';
import { direccionPorDefecto } from '../model';
import { ResumenDireccion } from './resumen-direccion';

/** Máximo de direcciones que el backend entrega por página: el selector pide una sola (R2). */
const TAMANO_SELECTOR = 100;

export interface SelectorDireccionProps {
  /** Dirección elegida: id, `null` = retiro en el local, `undefined` = todavía sin elegir. */
  valor: number | null | undefined;
  onCambiar: (valor: number | null) => void;
  /** Muestra la opción «Retiro en el local» (por defecto sí). */
  permitirRetiro?: boolean;
  /** Leyenda del grupo (por defecto «¿Dónde lo recibís?»). */
  leyenda?: string;
}

/**
 * Selector de dirección de entrega (grupo de opciones controlado). Cuando llegan los datos y la elección no es válida
 * (sin elegir, o con una dirección que ya no existe) informa por `onCambiar` la dirección por defecto: la principal,
 * si no la primera y, sin direcciones, el retiro si está habilitado.
 */
export function SelectorDireccion({ valor, onCambiar, permitirRetiro = true, leyenda = '¿Dónde lo recibís?' }: SelectorDireccionProps) {
  const nombre = useId();
  const consulta = useQuery(direccionQueries.lista({ page: 1, size: TAMANO_SELECTOR }));
  const { data } = consulta;
  const onCambiarRef = useRef(onCambiar);
  // La última `onCambiar`, sin que un callback nuevo en cada render repita la preselección.
  useEffect(() => {
    onCambiarRef.current = onCambiar;
  });

  useEffect(() => {
    if (data === undefined) return;
    const valida = valor === null ? permitirRetiro : valor !== undefined && data.items.some((direccion) => direccion.id === valor);
    if (valida) return;
    const porDefecto = direccionPorDefecto(data.items);
    if (porDefecto !== null) onCambiarRef.current(porDefecto);
    else if (permitirRetiro) onCambiarRef.current(null);
  }, [data, valor, permitirRetiro]);

  if (data === undefined) {
    if (consulta.isError) {
      return (
        <div className="sel-empty" role="alert">
          <Icon name="alerta" className="text-text-muted" />
          <div>
            <strong>No pudimos cargar tus direcciones</strong>
            <p>{consulta.error.detail}</p>
            <button type="button" className={claseBoton('secundario', { compacto: true })} onClick={() => void consulta.refetch()}>
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return (
      <div role="status" aria-busy="true" aria-label="Cargando direcciones" className="grid gap-2">
        {[0, 1].map((indice) => (
          <div key={indice} className="skel h-[68px]" />
        ))}
      </div>
    );
  }

  const sinDirecciones = data.items.length === 0;

  return (
    <>
      <fieldset className="sel">
        <legend>{leyenda}</legend>
        {sinDirecciones ? (
          <div className="sel-empty">
            <Icon name="direcciones" className="text-text-muted" />
            <div>
              <strong>No tenés direcciones guardadas</strong>
              <p>Agregá una para que te la llevemos.</p>
              <Link to={RUTAS.direcciones}>Agregar dirección</Link>
            </div>
          </div>
        ) : null}
        {data.items.map((direccion) => (
          <label key={direccion.id} className={valor === direccion.id ? 'opt is-checked' : 'opt'}>
            <input type="radio" name={nombre} checked={valor === direccion.id} onChange={() => onCambiar(direccion.id)} />
            <ResumenDireccion direccion={direccion} />
          </label>
        ))}
        {permitirRetiro ? (
          <label className={valor === null ? 'opt is-checked' : 'opt'}>
            <input type="radio" name={nombre} checked={valor === null} onChange={() => onCambiar(null)} />
            <span className="addr-body">
              <span className="addr-title">
                <Icon name="tienda" className="h-[18px] w-[18px]" />
                <strong>Retiro en el local</strong>
              </span>
              <span className="addr-sub">Pasás a buscarlo cuando esté listo</span>
            </span>
          </label>
        ) : null}
      </fieldset>
      {sinDirecciones ? null : (
        <div className="sel-foot">
          <span>{data.pages > 1 ? `Mostrando ${data.items.length} de ${data.total} direcciones.` : '¿Otra dirección?'}</span>
          <Link to={RUTAS.direcciones}>Gestionar direcciones</Link>
        </div>
      )}
    </>
  );
}
