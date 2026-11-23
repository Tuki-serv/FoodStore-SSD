import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { rutaProducto } from '@/shared/config';
import { Icon } from '@/shared/ui';
import { alergenos, categoriaPrincipal, estadoStock, imagenPrincipal, type Producto } from '../model';
import { ImagenProducto } from './imagen-producto';
import { MarcaStock } from './marca-stock';
import { Precio } from './precio';

export interface TarjetaProductoProps {
  producto: Producto;
  /** Acción de la tarjeta (el botón de agregar): la entidad no conoce el carrito, la página lo inyecta. */
  accion?: ReactNode;
  /** Id de la categoría por la que está filtrado el listado: si coincide con la principal del producto, la tarjeta no la repite. */
  categoriaActiva?: number;
}

/**
 * Tarjeta de producto (`<article>`): imagen, marca de stock, categoría principal (texto; omitida si es la del filtro activo), ícono de alérgenos, nombre (enlace al detalle; el área entera
 * es clicable por CSS), precio y el slot de acción. El enlace recuerda la búsqueda actual para «Volver al catálogo».
 */
export function TarjetaProducto({ producto, accion, categoriaActiva }: TarjetaProductoProps) {
  const { search } = useLocation();
  const categoria = categoriaPrincipal(producto);
  const mostrarCategoria = categoria !== null && categoria.id !== categoriaActiva;
  const conAlergenos = alergenos(producto).length > 0;
  const agotado = estadoStock(producto.stock_cantidad) === 'agotado';
  return (
    <article className={agotado ? 'card prod unavailable' : 'card prod'}>
      <div className="img">
        <ImagenProducto nombre={producto.nombre} url={imagenPrincipal(producto)} />
        <MarcaStock stock={producto.stock_cantidad} flotante />
      </div>
      <div className="body">
        {mostrarCategoria || conAlergenos ? (
          <div className="meta">
            {mostrarCategoria ? <span className="cat">{categoria.nombre}</span> : null}
            {conAlergenos ? (
              <span className="alergeno" role="img" aria-label="Contiene alérgenos">
                <Icon name="alergeno" />
              </span>
            ) : null}
          </div>
        ) : null}
        <h3>
          <Link to={rutaProducto(producto.id)} state={{ volverA: search }}>
            {producto.nombre}
          </Link>
        </h3>
        {producto.descripcion === null ? null : <p className="desc">{producto.descripcion}</p>}
        <div className="foot">
          <Precio valor={producto.precio_base} />
          {accion}
        </div>
      </div>
    </article>
  );
}
