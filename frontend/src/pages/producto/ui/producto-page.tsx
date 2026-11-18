import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { productoQueries } from '@/entities/producto';
import { esApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { Icon } from '@/shared/ui';
import { DetalleProducto } from './detalle-producto';
import { ErrorProducto, EsqueletoProducto, ProductoNoDisponible } from './estados-producto';

/** Id válido de la URL: entero positivo sin ceros a la izquierda. */
const REGEX_ID = /^[1-9]\d*$/;

/** `state.volverA` que dejó la tarjeta del catálogo: una query string (`?categoria=2&page=2`); cualquier otra cosa se ignora. */
function busquedaDeVuelta(state: unknown): string {
  const volverA = typeof state === 'object' && state !== null ? (state as { volverA?: unknown }).volverA : undefined;
  return typeof volverA === 'string' && volverA.startsWith('?') ? volverA : '';
}

/** Detalle público de un producto (US-008): `/catalogo/:productoId`. */
export function ProductoPage() {
  const { productoId = '' } = useParams();
  const { state } = useLocation();
  const idValido = REGEX_ID.test(productoId);
  const consulta = useQuery({ ...productoQueries.detalle(idValido ? Number(productoId) : 0), enabled: idValido });

  const sinProducto = !idValido || (consulta.isError && esApiError(consulta.error) && consulta.error.status === 404);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6">
      {sinProducto ? null : (
        <Link className="back-link" to={`${RUTAS.catalogo}${busquedaDeVuelta(state)}`}>
          <Icon name="volver" className="h-[18px] w-[18px]" />
          Volver al catálogo
        </Link>
      )}
      {sinProducto ? <ProductoNoDisponible /> : null}
      {!sinProducto && consulta.data === undefined && !consulta.isError ? <EsqueletoProducto /> : null}
      {!sinProducto && consulta.data === undefined && consulta.isError ? <ErrorProducto error={consulta.error} onReintentar={() => void consulta.refetch()} /> : null}
      {consulta.data === undefined || sinProducto ? null : <DetalleProducto key={consulta.data.id} producto={consulta.data} />}
    </div>
  );
}
