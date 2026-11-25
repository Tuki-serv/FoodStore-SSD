import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCerrarSesion, useRevalidarSesion, useSesion } from '@/entities/session';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { RUTAS } from '@/shared/config';
import { AppShell } from './app-shell';
import { rolPrincipal } from './model/rol-principal';
import { ConfirmacionGlobal } from './confirmacion-global';
import { Notificaciones } from './notificaciones';

/**
 * `AppShell` alimentado por la sesión: navegación de sus roles, pie con el usuario y «Cerrar sesión».
 * Tras un cierre de sesión voluntario lleva a `/catalogo`, estés en la ruta que estés.
 */
export function ShellConSesion() {
  const { usuario, roles } = useSesion();
  const estado = useAuthStore(selectEstado);
  const motivo = useAuthStore((sesion) => sesion.motivo);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const cerrar = useCerrarSesion();
  // Enterarse de una sesión cerrada en otro dispositivo al navegar y al volver a la pestaña (acotado a un pedido cada 15 s).
  useRevalidarSesion(pathname);
  const cerrando = useRef(false);

  useEffect(() => {
    if (estado !== 'anonima' || motivo !== 'logout') return;
    if (pathname !== RUTAS.catalogo) {
      // Las rutas protegidas ya redirigen solas (RequiereAcceso); las públicas necesitan este empujón.
      navigate(RUTAS.catalogo, { replace: true });
      return;
    }
    // Ya en /catalogo el motivo se atendió: una visita posterior a una ruta protegida debe ir a /ingresar.
    useAuthStore.getState().limpiarMotivo();
  }, [estado, motivo, pathname, navigate]);

  const cerrarSesion = (): void => {
    if (cerrando.current) return;
    cerrando.current = true;
    cerrar.mutate(undefined, {
      onSettled: () => {
        cerrando.current = false;
      },
    });
  };

  return (
    <>
      <AppShell
        roles={roles}
        usuario={usuario === null ? undefined : { nombre: `${usuario.nombre} ${usuario.apellido}`, rolPrincipal: rolPrincipal(roles) }}
        onCerrarSesion={cerrarSesion}
      />
      <Notificaciones />
      <ConfirmacionGlobal />
    </>
  );
}
