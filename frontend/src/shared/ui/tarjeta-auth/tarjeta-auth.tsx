import type { ReactNode } from 'react';

export interface TarjetaAuthProps {
  titulo: string;
  descripcion: string;
  /** Tarjeta más ancha (el registro tiene dos columnas en desktop). */
  ancha?: boolean;
  /** Pie con el enlace a la otra pantalla de acceso. */
  pie: ReactNode;
  children: ReactNode;
}

/** Tarjeta centrada de las pantallas de acceso (ingreso y registro): encabezado de nivel 1, formulario y pie. */
export function TarjetaAuth({ titulo, descripcion, ancha = false, pie, children }: TarjetaAuthProps) {
  return (
    <div className="mx-auto flex w-full flex-1 flex-col items-center justify-start gap-4 px-4 py-5 md:justify-center md:px-5 md:py-7">
      <section className={ancha ? 'auth-card is-wide' : 'auth-card'} aria-labelledby="auth-titulo">
        <div className="auth-head">
          <h1 id="auth-titulo" className="text-2xl">
            {titulo}
          </h1>
          <p>{descripcion}</p>
        </div>
        {children}
        <p className="auth-foot">{pie}</p>
      </section>
    </div>
  );
}
