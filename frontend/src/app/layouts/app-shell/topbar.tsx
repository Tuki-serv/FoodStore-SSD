import type { Ref } from 'react';
import { LOGO_ALT } from '@/shared/config';
import { Icon } from '@/shared/ui';
import logo from '@design-system/assets/logo.svg';

interface TopbarProps {
  menuAbierto: boolean;
  onAbrirMenu: () => void;
  botonMenuRef: Ref<HTMLButtonElement>;
}

/** Barra superior que solo se ve en mobile (< 1024 px): botón del menú y logo. */
export function Topbar({ menuAbierto, onAbrirMenu, botonMenuRef }: TopbarProps) {
  return (
    <header className="topbar">
      <button
        className="icon-btn"
        type="button"
        aria-controls="sidebar"
        aria-expanded={menuAbierto}
        aria-label="Abrir menú"
        ref={botonMenuRef}
        onClick={onAbrirMenu}
      >
        <Icon name="menu" />
      </button>
      <img src={logo} alt={LOGO_ALT} />
    </header>
  );
}
