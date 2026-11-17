import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@/shared/ui';
import type { SeccionNav } from './model';

interface NavSectionsProps {
  secciones: readonly SeccionNav[];
  /** Panel colapsado: se muestra la etiqueta como tooltip y como nombre accesible. */
  colapsado: boolean;
}

/** Listas de enlaces del panel lateral: separadores entre listas y encabezado en los grupos con título. */
export function NavSections({ secciones, colapsado }: NavSectionsProps) {
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
            {seccion.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  className="nav-item"
                  to={item.to}
                  title={colapsado ? item.label : undefined}
                  aria-label={colapsado ? item.label : undefined}
                >
                  <Icon name={item.icon} />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </>
  );
}
