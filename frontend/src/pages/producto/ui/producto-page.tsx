import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { categoriaPrincipal, productoQueries, type Producto } from '@/entities/producto';
import { esApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { EncabezadoPagina, Icon } from '@/shared/ui';
import { DetalleProducto } from './detalle-producto';
import { ErrorProducto, EsqueletoProducto, ProductoNoDisponible } from './estados-producto';

/** Id válido de la URL: entero positivo sin ceros a la izquierda. */
const REGEX_ID = /^[1-9]\d*$/;

/** `state.volverA` que dejó la tarjeta del catálogo: una query string (`?categoria=2&page=2`); cualquier otra cosa se ignora. */
function busquedaDeVuelta(state: unknown): string {
  const volverA = typeof state === 'object' && state !== null ? (state as { volverA?: unknown }).volverA : undefined;
  return typeof volverA === 'string' && volverA.startsWith('?') ? volverA : '';
}

/** Ruta «Catálogo / categoría principal / producto»: «Catálogo» vuelve a la búsqueda de origen y lleva la flecha. */
function RutaProducto({ producto, volverA }: { producto: Producto | undefined; volverA: string }) {
  const principal = producto === undefined ? null : categoriaPrincipal(producto);
  return (
    <>
      <Link to={`${RUTAS.catalogo}${volverA}`}>
        <Icon name="volver" className="h-[16px] w-[16px]" />
        Catálogo
      </Link>
      {principal === null ? null : (
        <>
          <span className="sep" aria-hidden="true">
            /
          </span>
          <Link to={`${RUTAS.catalogo}?categoria=${principal.id}`}>{principal.nombre}</Link>
        </>
      )}
      {producto === undefined ? null : (
        <>
          <span className="sep" aria-hidden="true">
            /
          </span>
          <span aria-current="page">{producto.nombre}</span>
        </>
      )}
    </>
  );
}

/** Detalle público de un producto (US-008): `/catalogo/:productoId`. */
export function ProductoPage() {
  const { productoId = '' } = useParams();
  const { state } = useLocation();
  const idValido = REGEX_ID.test(productoId);
  const consulta = useQuery({ ...productoQueries.detalle(idValido ? Number(productoId) : 0), enabled: idValido });

  const sinProducto = !idValido || (consulta.isError && esApiError(consulta.error) && consulta.error.status === 404);

  return (
    <div className="flex flex-1 flex-col">
      {sinProducto ? null : <EncabezadoPagina ruta={<RutaProducto producto={consulta.data} volverA={busquedaDeVuelta(state)} />} />}
      <div className="page-body flex flex-col gap-5">
        {sinProducto ? <ProductoNoDisponible /> : null}
        {!sinProducto && consulta.data === undefined && !consulta.isError ? <EsqueletoProducto /> : null}
        {!sinProducto && consulta.data === undefined && consulta.isError ? <ErrorProducto error={consulta.error} onReintentar={() => void consulta.refetch()} /> : null}
        {consulta.data === undefined || sinProducto ? null : <DetalleProducto key={consulta.data.id} producto={consulta.data} />}
      </div>
    </div>
  );
}
