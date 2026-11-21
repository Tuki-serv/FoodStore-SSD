import { Link, useLocation } from 'react-router-dom';
import { RUTAS } from '@/shared/config';
import { Icon, claseBoton } from '@/shared/ui';

/** 404 dentro del shell: muestra la ruta pedida y un enlace al catálogo. El título mide 2rem como en el mockup aprobado de C-13a (a 390 px ocupa dos líneas). */
export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-1 items-center justify-center px-4 py-5 lg:px-5 lg:py-6">
      <section
        className="flex w-full max-w-[560px] flex-col items-center gap-3 rounded-lg border-2 border-solid border-border bg-surface px-4 py-7 text-center"
        aria-labelledby="not-found-titulo"
      >
        <Icon name="brujula" className="h-10 w-10 text-text-muted [stroke-width:1.6]" />
        <span className="font-display text-3xl font-extrabold leading-none tracking-[.04em] text-primary" aria-hidden="true">
          404
        </span>
        <h1 id="not-found-titulo" className="text-[2rem]">
          Página no encontrada
        </h1>
        <p className="max-w-[40ch] text-text-muted">
          No encontramos{' '}
          <span className="rounded-sm bg-surface-alt px-2 py-px font-mono text-sm text-text [overflow-wrap:anywhere]">{pathname}</span>
          . Puede que el enlace esté mal escrito o que la página ya no exista.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link className={claseBoton('primario')} to={RUTAS.catalogo}>
            Ir al catálogo
          </Link>
        </div>
      </section>
    </div>
  );
}
