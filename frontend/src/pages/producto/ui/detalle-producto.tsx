import { useState } from 'react';
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
          <ImagenProducto nombre={producto.nombre} url={imagenPrincipal(producto)} grande />
        </div>
        <div className="pd-info">
          {producto.categorias.length === 0 ? null : <span className="tagline">{categoriasOrdenadas(producto).map((categoria) => categoria.nombre).join(' · ')}</span>}
          <h1>{producto.nombre}</h1>
          <div className="pd-price">
            <Precio valor={producto.precio_base} simboloChico />
            <MarcaStock stock={producto.stock_cantidad} />
          </div>
          {producto.descripcion === null ? null : <p className="pd-desc">{producto.descripcion}</p>}
          {agotado || removibles.length === 0 ? null : (
            <SelectorPersonalizacion ingredientes={removibles} excluidos={excluidos} onAlternar={alternar} />
          )}
          {esMobile ? null : <div className="pd-buy">{compra}</div>}
          {conAlergenos.length === 0 ? null : (
            <div className="pd-section pd-note" role="note">
              <Icon name="alergeno" />
              <div>
                <strong>Contiene alérgenos</strong>
                <p>{conAlergenos.map((ingrediente) => ingrediente.nombre).join(', ')}</p>
              </div>
            </div>
          )}
          {producto.ingredientes.length === 0 ? null : (
            <section className="pd-section" aria-labelledby="ingredientes-titulo">
              <h2 id="ingredientes-titulo">Ingredientes</h2>
              <ul className="ing-list">
                {producto.ingredientes.map((ingrediente) => (
                  <li key={ingrediente.id}>
                    {ingrediente.nombre}
                    {ingrediente.es_alergeno ? (
                      <span className="al">
                        <Icon name="alergeno" />
                        Alérgeno
                      </span>
                    ) : null}
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
