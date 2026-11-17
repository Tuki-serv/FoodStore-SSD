import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { LOGO_ALT } from '@/shared/config';
import { Icon, claseBoton } from '@/shared/ui';
import logo from '@design-system/assets/logo.svg';

/**
 * Error genérico a pantalla completa, fuera del shell (el error puede venir del propio shell).
 * Nunca muestra trazas ni mensajes del error: en desarrollo se registra en la consola.
 */
export function ErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    if (import.meta.env.DEV) console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-6">
        <img className="h-10 max-w-[200px]" src={logo} alt={LOGO_ALT} />
        <section
          className="flex w-full max-w-[480px] flex-col items-center gap-3 rounded-lg border border-t-[6px] border-border border-t-danger bg-surface px-5 py-6 text-center shadow-md"
          aria-labelledby="error-titulo"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-danger-bg text-danger" aria-hidden="true">
            <Icon name="alerta" className="h-7 w-7" />
          </span>
          <h1 id="error-titulo" className="text-2xl">
            Algo salió mal
          </h1>
          <p className="text-text-muted">
            Tuvimos un problema al mostrar esta página. Probá de nuevo; si sigue pasando, volvé al inicio.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className={claseBoton('primario')} type="button" onClick={() => window.location.reload()}>
              Reintentar
            </button>
            {/* Enlace común (no del router): recarga la app completa por si el estado quedó roto. */}
            <a className={claseBoton('secundario')} href="/">
              Volver al inicio
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
