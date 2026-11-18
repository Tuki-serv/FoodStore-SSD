import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui';
import type { Direccion } from '../model';
import { ResumenDireccion } from './resumen-direccion';

export interface TarjetaDireccionProps {
  direccion: Direccion;
  /** Acciones de la tarjeta (botones con nombre accesible propio). */
  acciones?: ReactNode;
}

/** Ítem de una lista de direcciones (`<li>`): ícono, resumen y acciones; la principal se destaca. */
export function TarjetaDireccion({ direccion, acciones }: TarjetaDireccionProps) {
  return (
    <li className={direccion.es_principal ? 'addr is-principal' : 'addr'}>
      <span className="addr-ico" aria-hidden="true">
        <Icon name="direcciones" />
      </span>
      <ResumenDireccion direccion={direccion} />
      {acciones === undefined ? null : <div className="addr-actions">{acciones}</div>}
    </li>
  );
}
