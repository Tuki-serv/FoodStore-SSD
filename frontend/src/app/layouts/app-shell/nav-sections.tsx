import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { ContadorCarrito, etiquetaCarrito, selectTotalItems, useCartStore } from '@/entities/cart';
import { Icon } from '@/shared/ui';
import type { SeccionNav } from './model';

interface NavSectionsProps {
  secciones: readonly SeccionNav[];
  /** Panel colapsado: se muestra la etiqueta como tooltip y como nombre accesible. */
  colapsado: boolean;
}

/** Listas de enlaces del panel lateral: separadores entre listas y encabezado en los grupos con título. */
export function NavSections({ secciones, colapsado }: NavSectionsProps) {
  const unidadesCarrito = useCartStore(selectTotalItems);
  return (
    <>
      {secciones.map((seccion, indice) => (
        <Fragment key={seccion.id}>
          {seccion.titulo !== undefined ? (
            <p className="nav-group-title">
              <span>{seccion.titulo}</span>
            </p>
          ) : (
            indice > 0 && <hr className="nav-sep" />
          )}
          <ul className="nav-list" aria-label={seccion.titulo}>
            {seccion.items.map((item) => {
              const esCarrito = item.id === 'carrito';
              // El nombre accesible del carrito incluye las unidades; en el panel colapsado todos los ítems se nombran por su etiqueta.
              const nombre = esCarrito ? etiquetaCarrito(unidadesCarrito) : colapsado ? item.label : undefined;
              return (
                <li key={item.id}>
                  <NavLink
                    className="nav-item"
                    to={item.to}
                    title={colapsado ? item.label : undefined}
                    aria-label={nombre}
                  >
                    <Icon name={item.icon} />
                    <span className="nav-label">{item.label}</span>
                    {esCarrito ? <ContadorCarrito /> : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </Fragment>
      ))}
    </>
  );
}
