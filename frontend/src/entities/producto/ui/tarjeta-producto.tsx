import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { rutaProducto } from '@/shared/config';
import { categoriaPrincipal, estadoStock, imagenPrincipal, type Producto } from '../model';
import { ImagenProducto } from './imagen-producto';
import { MarcaStock } from './marca-stock';
import { Precio } from './precio';

export interface TarjetaProductoProps {
  producto: Producto;
  /** Acción de la tarjeta (el botón de agregar): la entidad no conoce el carrito, la página lo inyecta. */
  accion?: ReactNode;
}

/**
 * Tarjeta de producto (`<article>`): imagen, marca de stock, categoría principal, nombre (enlace al detalle; el área entera
 * es clicable por CSS), precio y el slot de acción. El enlace recuerda la búsqueda actual para «Volver al catálogo».
 */
export function TarjetaProducto({ producto, accion }: TarjetaProductoProps) {
  const { search } = useLocation();
  const categoria = categoriaPrincipal(producto);
  const agotado = estadoStock(producto.stock_cantidad) === 'agotado';
  return (
    <article className={agotado ? 'card prod unavailable' : 'card prod'}>
      <div className="img">
        <ImagenProducto nombre={producto.nombre} url={imagenPrincipal(producto)} />
        <MarcaStock stock={producto.stock_cantidad} flotante />
      </div>
      <div className="body">
        {categoria === null ? null : <span className="cat">{categoria.nombre}</span>}
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
