import { LOGO_ALT } from '@/shared/config';
import logo from '@design-system/assets/logo.svg';

/** Pantalla completa de espera (logo + «Cargando…»), según el mockup aprobado `session-loading.html` de C-13b. */
export function PantallaCarga() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-6">
        <img className="h-12 max-w-[240px]" src={logo} alt={LOGO_ALT} />
        <div className="flex items-center gap-3 font-semibold text-text-muted" role="status" aria-live="polite">
          <span
            className="h-6 w-6 animate-spin rounded-full border-[3px] border-border border-t-primary motion-reduce:animate-none motion-reduce:border-r-primary motion-reduce:border-t-border"
            aria-hidden="true"
          />
          <span>Cargando…</span>
        </div>
      </main>
    </div>
  );
}
