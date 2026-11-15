import type { Ref } from 'react';
import { LOGO_ALT } from '@/shared/config';
import { Icon } from '@/shared/ui';
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
}: SidebarProps) {
  return (
    <aside className={colapsado ? 'sidebar is-collapsed' : 'sidebar'} id="sidebar">
      <div className="sidebar-head">
        <img className="sidebar-logo" src={logo} alt={LOGO_ALT} />
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
    </aside>
  );
}
