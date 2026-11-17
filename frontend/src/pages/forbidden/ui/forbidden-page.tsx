import { Link } from 'react-router-dom';
import { RUTAS } from '@/shared/config';
import { Icon, claseBoton } from '@/shared/ui';

/** «Sin permiso» dentro del shell (según el mockup aprobado `forbidden.html` de C-13b): la URL no cambia y el texto no es técnico. */
export function ForbiddenPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-1 items-center justify-center px-4 py-5 lg:px-5 lg:py-6">
      <section
        className="flex w-full max-w-[560px] flex-col items-center gap-3 rounded-lg border-2 border-solid border-border bg-surface px-4 py-7 text-center"
        aria-labelledby="forbidden-titulo"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-warning-bg text-warning" aria-hidden="true">
          <Icon name="candado" className="h-7 w-7" />
        </span>
        <h1 id="forbidden-titulo" className="text-2xl">
          No tenés acceso a esta sección
        </h1>
        <p className="max-w-[40ch] text-text-muted">
          Tu cuenta no tiene permiso para ver esta página. Si creés que es un error, consultá con quien administra la tienda.
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
