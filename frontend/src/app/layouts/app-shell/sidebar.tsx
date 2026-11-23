import type { KeyboardEvent, Ref } from 'react';
import { LOGO_ALT } from '@/shared/config';
import { atraparTab } from '@/shared/lib';
import { Icon } from '@/shared/ui';
import isotipo from '@design-system/assets/favicon.svg';
import logo from '@design-system/assets/logo.svg';
import type { SeccionNav } from './model';
import { NavSections } from './nav-sections';

export interface UsuarioShell {
  nombre: string;
  rolPrincipal: string;
}

interface SidebarProps {
  secciones: readonly SeccionNav[];
  usuario?: UsuarioShell;
  colapsado: boolean;
  onAlternarColapso: () => void;
  onCerrarMenu: () => void;
  onCerrarSesion?: () => void;
  botonCerrarRef: Ref<HTMLButtonElement>;
  /** Drawer mobile abierto: el panel es un diálogo modal con el foco atrapado (y sin el botón de colapsar). */
  modal?: boolean;
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}

export function Sidebar({
  secciones,
  usuario,
  colapsado,
  onAlternarColapso,
  onCerrarMenu,
  onCerrarSesion,
  botonCerrarRef,
  modal = false,
}: SidebarProps) {
  const alPresionarTecla = (evento: KeyboardEvent<HTMLElement>): void => atraparTab(evento, evento.currentTarget);
  // Un único `div` estable (si cambiara de elemento se reemplazaría el nodo y se cortaría la transición de deslizamiento):
  // el rol pasa de landmark `complementary` a diálogo modal (`role="dialog"` no es válido en `<aside>`).
  const propsModal = modal ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Menú', onKeyDown: alPresionarTecla } : { role: 'complementary', 'aria-label': 'Panel lateral' };
  return (
    <div className={colapsado ? 'sidebar is-collapsed' : 'sidebar'} id="sidebar" {...propsModal}>
      <div className="sidebar-head">
        {/* Colapsado: solo el isotipo (Revision 4, `favicon.svg`); ambos conservan el nombre accesible de la marca. */}
        {colapsado ? <img className="sidebar-mark" src={isotipo} alt={LOGO_ALT} /> : <img className="sidebar-logo" src={logo} alt={LOGO_ALT} />}
        {modal ? null : (
          <button
            className="icon-btn btn-collapse"
            type="button"
            aria-controls="sidebar"
            aria-expanded={!colapsado}
            aria-label={colapsado ? 'Expandir panel' : 'Colapsar panel'}
            onClick={onAlternarColapso}
          >
            <Icon name="panel" />
          </button>
        )}
        <button className="icon-btn btn-close" type="button" aria-label="Cerrar menú" ref={botonCerrarRef} onClick={onCerrarMenu}>
          <Icon name="cerrar" />
        </button>
      </div>
      <nav className="sidebar-nav" aria-label="Principal">
        <NavSections secciones={secciones} colapsado={colapsado} />
      </nav>
      {usuario && (
        <div className="sidebar-foot">
          <span className="avatar" aria-hidden="true">
            {iniciales(usuario.nombre)}
          </span>
          <div className="user-meta">
            <strong>{usuario.nombre}</strong>
            <small>{usuario.rolPrincipal}</small>
          </div>
          {onCerrarSesion && (
            <button className="icon-btn btn-logout" type="button" aria-label="Cerrar sesión" onClick={onCerrarSesion}>
              <Icon name="salir" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
