import { BRAND_NAME } from '@/shared/config';
import { Icon } from '@/shared/ui';

export interface PlaceholderPageProps {
  title: string;
  /** Change que implementa la pantalla real (C-xx). Va en `data-owner`, no en el texto visible. */
  owner: string;
}

/** Página provisoria de una sección todavía sin pantalla: encabezado y aviso de «en preparación». Sin datos del backend. */
export function PlaceholderPage({ title, owner }: PlaceholderPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6" data-owner={owner}>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl">{title}</h1>
      </header>
      <section
        className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface px-4 py-7 text-center"
        aria-label="Sección en preparación"
      >
        <Icon name="obra" className="h-10 w-10 text-text-muted [stroke-width:1.6]" />
        <p className="text-lg font-bold text-text">Estamos preparando esta sección.</p>
        <p className="max-w-[40ch] text-text-muted">Volvé a pasar pronto: {BRAND_NAME} está creciendo.</p>
      </section>
    </div>
  );
}
