import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/shared/lib';
import { selectSidebarCollapsed, selectSidebarOpen, useUiStore } from '@/shared/model';
import { seccionesParaRoles } from './model';
import { Sidebar, type UsuarioShell } from './sidebar';
import { Topbar } from './topbar';

const ES_DESKTOP = '(min-width: 1024px)';

export interface AppShellProps {
  /** Roles de la sesión; sin roles es la variante «sin sesión». */
  roles?: readonly string[];
  /** Usuario para el pie del panel; sin usuario no hay pie. */
  usuario?: UsuarioShell;
  onCerrarSesion?: () => void;
}

/** Shell de la aplicación: panel lateral (colapsable en desktop, drawer en mobile), barra superior mobile y la página actual. */
export function AppShell({ roles = [], usuario, onCerrarSesion }: AppShellProps) {
  const esDesktop = useMediaQuery(ES_DESKTOP);
  const sidebarCollapsed = useUiStore(selectSidebarCollapsed);
  const sidebarOpen = useUiStore(selectSidebarOpen);
  const { toggleSidebarCollapsed, openSidebar, closeSidebar } = useUiStore.getState();
  const { pathname } = useLocation();

  const secciones = seccionesParaRoles(roles);
  // El acceso al carrito de la barra superior existe solo en mobile y si la navegación del rol incluye «Carrito» (hay sesión).
  const mostrarCarrito = !esDesktop && secciones.some((seccion) => seccion.items.some((item) => item.id === 'carrito'));

  const colapsado = esDesktop && sidebarCollapsed;
  const drawerAbierto = !esDesktop && sidebarOpen;

  const botonMenuRef = useRef<HTMLButtonElement>(null);
  const botonCerrarRef = useRef<HTMLButtonElement>(null);
  const drawerEstabaAbierto = useRef(false);

  // Transiciones solo después del primer render: el estado inicial no se anima.
  const [listo, setListo] = useState(false);
  useEffect(() => {
    let segundo = 0;
    const primero = requestAnimationFrame(() => {
      segundo = requestAnimationFrame(() => setListo(true));
    });
    return () => {
      cancelAnimationFrame(primero);
      cancelAnimationFrame(segundo);
    };
  }, []);

  // Al pasar a desktop o navegar, el drawer se cierra (y deja de estar «abierto» en el store).
  useEffect(() => {
    if (esDesktop) closeSidebar();
  }, [esDesktop, closeSidebar]);
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  // Foco: al abrir, a «Cerrar menú»; al cerrar, de vuelta a «Abrir menú» si el foco quedó en el panel o se perdió.
  useEffect(() => {
    if (drawerAbierto) {
      botonCerrarRef.current?.focus();
    } else if (drawerEstabaAbierto.current && !esDesktop) {
      const activo = document.activeElement;
      if (activo === document.body || activo === null || document.getElementById('sidebar')?.contains(activo)) {
        botonMenuRef.current?.focus();
      }
    }
    drawerEstabaAbierto.current = drawerAbierto;
  }, [drawerAbierto, esDesktop]);

  // Escape cierra el drawer; mientras está abierto no se desplaza el documento.
  useEffect(() => {
    if (!drawerAbierto) return undefined;
    const alTeclear = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') closeSidebar();
    };
    document.addEventListener('keydown', alTeclear);
    const overflowAnterior = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.documentElement.style.overflow = overflowAnterior;
    };
  }, [drawerAbierto, closeSidebar]);

  const clases = ['shell', drawerAbierto ? 'drawer-open' : '', listo ? 'is-ready' : ''].filter(Boolean).join(' ');

  return (
    <div className={clases}>
      <Sidebar
        secciones={secciones}
        usuario={usuario}
        colapsado={colapsado}
        onAlternarColapso={toggleSidebarCollapsed}
        onCerrarMenu={closeSidebar}
        onCerrarSesion={onCerrarSesion}
        botonCerrarRef={botonCerrarRef}
      />
      <div className="scrim" onClick={closeSidebar} aria-hidden="true" data-testid="scrim" />
      <div className="shell-main">
        <Topbar menuAbierto={drawerAbierto} onAbrirMenu={openSidebar} botonMenuRef={botonMenuRef} mostrarCarrito={mostrarCarrito} />
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
