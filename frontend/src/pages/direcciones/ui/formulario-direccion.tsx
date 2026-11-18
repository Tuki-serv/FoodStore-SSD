import { useForm } from '@tanstack/react-form';
import { useEffect, useRef, useState } from 'react';
import { useActualizarDireccion, useCrearDireccion, type Direccion } from '@/entities/direccion';
import { esApiError } from '@/shared/api';
import { Campo, claseBoton, Icon } from '@/shared/ui';
import {
  aDireccionDatos,
  avisarErrorAccion,
  avisarExito,
  esDireccionNoDisponible,
  validarCampo,
  valoresIniciales,
  type CampoDireccion,
} from '../model';

export interface FormularioDireccionProps {
  /** Dirección a editar; sin ella es un alta. */
  direccion?: Direccion;
  /** «Cancelar» o «Volver»: cierra sin enviar nada. */
  onCancelar: () => void;
  /** Cierra tras guardar (o tras un 403/404, cuando la dirección ya no existe). */
  onTerminar: () => void;
}

function esCampoDireccion(campo: string | null): campo is CampoDireccion {
  return DEFINICION_CAMPOS.some((definicion) => definicion.nombre === campo);
}

interface DefinicionCampo {
  nombre: CampoDireccion;
  etiqueta: string;
  opcional: boolean;
  ayuda?: string;
  /** Columnas que ocupa en la grilla del formulario (`.c-N`). */
  columnas: string;
}

const DEFINICION_CAMPOS: readonly DefinicionCampo[] = [
  { nombre: 'alias', etiqueta: 'Alias', opcional: true, ayuda: 'Ej.: Casa, Trabajo', columnas: 'c-6' },
  { nombre: 'linea1', etiqueta: 'Calle y número', opcional: false, columnas: 'c-4' },
  { nombre: 'linea2', etiqueta: 'Piso, depto.', opcional: true, columnas: 'c-2' },
  { nombre: 'ciudad', etiqueta: 'Ciudad', opcional: false, columnas: 'c-3' },
  { nombre: 'provincia', etiqueta: 'Provincia', opcional: true, columnas: 'c-3' },
  { nombre: 'codigo_postal', etiqueta: 'Código postal', opcional: true, columnas: 'c-2' },
];

type ErroresServidor = Partial<Record<CampoDireccion, string>>;

/** Formulario de alta y edición de una dirección (TanStack Form): validación por campo, normalización y errores del servidor. */
export function FormularioDireccion({ direccion, onCancelar, onTerminar }: FormularioDireccionProps) {
  const crear = useCrearDireccion();
  const actualizar = useActualizarDireccion();
  const [erroresServidor, setErroresServidor] = useState<ErroresServidor>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const formularioRef = useRef<HTMLFormElement>(null);
  const enEdicion = direccion !== undefined;

  // Al abrir, el foco va al encabezado (el contenido anterior desapareció).
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  const guardar = async (valores: ReturnType<typeof valoresIniciales>): Promise<void> => {
    setErroresServidor({});
    setErrorGeneral(null);
    const datos = aDireccionDatos(valores);
    try {
      if (direccion === undefined) await crear.mutateAsync(datos);
      else await actualizar.mutateAsync({ id: direccion.id, datos });
      avisarExito('Dirección guardada');
      onTerminar();
    } catch (error) {
      if (!esApiError(error)) throw error;
      if (enEdicion && esDireccionNoDisponible(error)) {
        avisarErrorAccion(error);
        onTerminar();
      } else if (error.code === 'VALIDATION_ERROR' && esCampoDireccion(error.field)) {
        setErroresServidor({ [error.field]: error.detail });
      } else {
        setErrorGeneral(error.detail);
      }
    }
  };

  const form = useForm({
    defaultValues: valoresIniciales(direccion),
    onSubmit: ({ value }) => guardar(value),
    onSubmitInvalid: () => {
      formularioRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    },
  });

  const pendiente = crear.isPending || actualizar.isPending;

  return (
    <>
      <button type="button" className="back" onClick={onCancelar}>
        <span aria-hidden="true">&larr;</span> Volver a Direcciones
      </button>
      <section className="form-card" aria-labelledby="form-titulo">
        <h2 id="form-titulo" ref={tituloRef} tabIndex={-1}>
          {enEdicion ? 'Editar dirección' : 'Nueva dirección'}
        </h2>
        {errorGeneral === null ? null : (
          <div className="form-alert" role="alert">
            <Icon name="alerta" />
            <div>
              No pudimos guardar la dirección
              <p>{errorGeneral}</p>
            </div>
          </div>
        )}
        <form
          ref={formularioRef}
          className="form-grid"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            void form.handleSubmit();
          }}
        >
          {DEFINICION_CAMPOS.map(({ nombre, etiqueta, opcional, ayuda, columnas }) => (
            <form.Field
              key={nombre}
              name={nombre}
              validators={{
                // Siempre al día (también al montar): `handleSubmit` no envía con campos inválidos y, al intentarlo, los marca como tocados.
                onMount: ({ value }) => validarCampo(nombre, value),
                onChange: ({ value }) => validarCampo(nombre, value),
                onBlur: ({ value }) => validarCampo(nombre, value),
              }}
            >
              {(campo) => {
                const errorLocal = campo.state.meta.isTouched ? campo.state.meta.errors.find((e): e is string => typeof e === 'string') : undefined;
                const error = erroresServidor[nombre] ?? errorLocal;
                return (
                  <Campo
                    etiqueta={etiqueta}
                    opcional={opcional}
                    className={columnas}
                    {...(ayuda === undefined ? {} : { ayuda })}
                    {...(error === undefined ? {} : { error })}
                  >
                    {(control) => (
                      <input
                        {...control}
                        className="input"
                        name={campo.name}
                        value={campo.state.value}
                        onBlur={campo.handleBlur}
                        onChange={(evento) => {
                          if (erroresServidor[nombre] !== undefined) setErroresServidor({});
                          campo.handleChange(evento.target.value);
                        }}
                      />
                    )}
                  </Campo>
                );
              }}
            </form.Field>
          ))}
          <div className="form-actions c-6">
            <button type="button" className={claseBoton('fantasma')} onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className={claseBoton('primario')} disabled={pendiente}>
              {pendiente ? 'Guardando…' : enEdicion ? 'Guardar cambios' : 'Guardar dirección'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
