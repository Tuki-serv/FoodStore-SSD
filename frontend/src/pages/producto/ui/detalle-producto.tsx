import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  alergenos,
  estadoStock,
  ImagenProducto,
  imagenPrincipal,
  ingredientesRemovibles,
  MarcaStock,
  Precio,
  type Producto,
} from '@/entities/producto';
import { BotonAgregarAlCarrito, SelectorPersonalizacion } from '@/features/agregar-al-carrito';
import { RUTAS } from '@/shared/config';
import { useMediaQuery } from '@/shared/lib';
import { Icon, SelectorCantidad } from '@/shared/ui';

/** Mobile: la compra va en una barra fija abajo; desde este ancho, en un bloque junto a la información. */
const CONSULTA_MOBILE = '(max-width: 719.98px)';

/** Categorías con la principal primero. */
const categoriasOrdenadas = (producto: Producto) => [...producto.categorias].sort((a, b) => Number(b.es_principal) - Number(a.es_principal));

/** Detalle del producto: imagen, categorías, precio y stock, descripción, compra, alérgenos e ingredientes. */
export function DetalleProducto({ producto }: { producto: Producto }) {
  const esMobile = useMediaQuery(CONSULTA_MOBILE);
  const [cantidad, setCantidad] = useState(1);
  const [excluidos, setExcluidos] = useState<ReadonlySet<number>>(new Set());
  const agotado = estadoStock(producto.stock_cantidad) === 'agotado';
  const conAlergenos = alergenos(producto);
  const removibles = ingredientesRemovibles(producto);
  const alternar = (id: number): void =>
    setExcluidos((actuales) => {
      const siguientes = new Set(actuales);
      if (!siguientes.delete(id)) siguientes.add(id);
      return siguientes;
    });
  const elegidos = removibles.filter((ingrediente) => excluidos.has(ingrediente.id)).map(({ id, nombre }) => ({ id, nombre }));

  // Se monta una sola vez según el ancho: dos botones «Agregar» en el DOM dejarían nombres accesibles repetidos.
  const compra = (
    <>
      {agotado ? null : <SelectorCantidad valor={cantidad} max={producto.stock_cantidad} onCambiar={setCantidad} />}
      <BotonAgregarAlCarrito producto={producto} cantidad={cantidad} variante="detalle" excluidos={elegidos} />
    </>
  );

  return (
    <>
      <article className="pd">
        <div className={agotado ? 'pd-media unavailable' : 'pd-media'}>
          <ImagenProducto nombre={producto.nombre} url={imagenPrincipal(producto)} />
        </div>
        <div className="pd-info">
          {producto.categorias.length === 0 ? null : (
            <div className="pd-cats">
              {categoriasOrdenadas(producto).map((categoria) => (
                <Link key={categoria.id} to={`${RUTAS.catalogo}?categoria=${categoria.id}`} className={categoria.es_principal ? 'is-main' : undefined}>
                  {categoria.nombre}
                </Link>
              ))}
            </div>
          )}
          <h1>{producto.nombre}</h1>
          <div className="pd-price">
            <Precio valor={producto.precio_base} />
            <MarcaStock stock={producto.stock_cantidad} />
          </div>
          {producto.descripcion === null ? null : <p className="pd-desc">{producto.descripcion}</p>}
          {agotado || removibles.length === 0 ? null : (
            <SelectorPersonalizacion ingredientes={removibles} excluidos={excluidos} onAlternar={alternar} />
          )}
          {esMobile ? null : <div className="buy">{compra}</div>}
          {conAlergenos.length === 0 ? null : (
            <div className="allergen-note" role="note">
              <Icon name="alerta" />
              <p>Contiene alérgenos: {conAlergenos.map((ingrediente) => ingrediente.nombre).join(', ')}</p>
            </div>
          )}
          {producto.ingredientes.length === 0 ? null : (
            <section className="ingr" aria-labelledby="ingredientes-titulo">
              <h2 id="ingredientes-titulo">Ingredientes</h2>
              <ul>
                {producto.ingredientes.map((ingrediente) => (
                  <li key={ingrediente.id} className={ingrediente.es_alergeno ? 'is-allergen' : undefined}>
                    {ingrediente.nombre}
                    {ingrediente.es_alergeno ? <span className="badge b-pendiente">Alérgeno</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>
      {esMobile ? <div className="buy-bar">{compra}</div> : null}
    </>
  );
}
