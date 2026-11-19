import { Link } from 'react-router-dom';
import type { Ref } from 'react';
import { ContadorCarrito, etiquetaCarrito, selectTotalItems, useCartStore } from '@/entities/cart';
import { LOGO_ALT, RUTAS } from '@/shared/config';
import { Icon } from '@/shared/ui';
import logo from '@design-system/assets/logo.svg';

interface TopbarProps {
  menuAbierto: boolean;
  onAbrirMenu: () => void;
  botonMenuRef: Ref<HTMLButtonElement>;
  /** Muestra el acceso al carrito (solo con sesión y en mobile). */
  mostrarCarrito?: boolean;
}

/** Barra superior que solo se ve en mobile (< 1024 px): botón del menú, logo y, con sesión, el carrito con su contador. */
export function Topbar({ menuAbierto, onAbrirMenu, botonMenuRef, mostrarCarrito = false }: TopbarProps) {
  const unidades = useCartStore(selectTotalItems);
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
      {mostrarCarrito ? (
        <Link className="icon-btn" to={RUTAS.carrito} aria-label={etiquetaCarrito(unidades)}>
          <Icon name="carrito" />
          <ContadorCarrito />
        </Link>
      ) : null}
    </header>
  );
}
