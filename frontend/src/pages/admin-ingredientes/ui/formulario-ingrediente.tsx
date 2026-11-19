import { useForm } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useCrearIngrediente, useEditarIngrediente, type Ingrediente } from '@/entities/ingrediente';
import { etiquetaUnidad, unidadMedidaQueries, type UnidadMedida } from '@/entities/unidad-medida';
import { aApiError, esApiError } from '@/shared/api';
import { avisarExito } from '@/shared/model';
import { Campo, claseBoton, EsqueletoFilas, EstadoError, Icon } from '@/shared/ui';
import { aCuerpoIngrediente, cambiosIngrediente, validarNombreIngrediente, valoresInicialesIngrediente, type ValoresIngrediente } from '../model';

export interface FormularioIngredienteProps {
  /** Ingrediente a editar; sin él es un alta. */
  ingrediente?: Ingrediente;
  /** «Cancelar» o «Volver»: cierra sin enviar nada. */
  onCancelar: () => void;
  /** Cierra tras guardar o al no haber cambios; `nuevoId` es el del ingrediente creado (para resaltarlo). */
  onTerminar: (nuevoId?: number) => void;
}

const MENSAJE_NOMBRE_REPETIDO = 'Ya existe un ingrediente con ese nombre.';
/** Símbolo de la unidad que se propone al crear (el id depende de la base, el símbolo no). */
const SIMBOLO_POR_DEFECTO = 'u';

/** Carga las unidades de medida (el selector las necesita) y recién entonces dibuja el formulario. */
export function FormularioIngrediente(props: FormularioIngredienteProps) {
  const unidades = useQuery(unidadMedidaQueries.todas());
  if (unidades.data === undefined) {
    return (
      <>
        <button type="button" className="back-link" onClick={props.onCancelar}>
          <Icon name="volver" />
          Volver a Ingredientes
        </button>
        {unidades.isError ? (
          <EstadoError titulo="No pudimos cargar las unidades de medida" detalle={aApiError(unidades.error).detail} onReintentar={() => void unidades.refetch()} />
        ) : (
          <EsqueletoFilas etiqueta="Cargando unidades de medida" filas={3} />
        )}
      </>
    );
  }
  return <CuerpoFormulario {...props} unidades={unidades.data} />;
}

function CuerpoFormulario({ ingrediente, unidades, onCancelar, onTerminar }: FormularioIngredienteProps & { unidades: readonly UnidadMedida[] }) {
  const crear = useCrearIngrediente();
  const editar = useEditarIngrediente();
  const [nombreRepetido, setNombreRepetido] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const enEdicion = ingrediente !== undefined;
  const unidadPorDefecto = unidades.find((u) => u.simbolo === SIMBOLO_POR_DEFECTO) ?? unidades[0];
  const iniciales = valoresInicialesIngrediente(unidadPorDefecto === undefined ? '' : String(unidadPorDefecto.id), ingrediente);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  useEffect(() => {
    if (nombreRepetido) nombreRef.current?.focus();
  }, [nombreRepetido]);

  const guardar = async (valores: ValoresIngrediente): Promise<void> => {
    setNombreRepetido(false);
    setErrorGeneral(null);
    try {
      if (ingrediente === undefined) {
        const creado = await crear.mutateAsync(aCuerpoIngrediente(valores));
        avisarExito('Ingrediente creado', `«${creado.nombre}»`);
        onTerminar(creado.id);
        return;
      }
      const cambios = cambiosIngrediente(iniciales, valores);
      if (Object.keys(cambios).length > 0) {
        await editar.mutateAsync({ id: ingrediente.id, cambios });
        avisarExito('Ingrediente actualizado', `«${valores.nombre.trim()}»`);
      }
      onTerminar();
    } catch (error) {
      if (!esApiError(error)) throw error;
      if (error.code === 'DUPLICATE_VALUE' && error.field === 'nombre') setNombreRepetido(true);
      else setErrorGeneral(error.detail);
    }
  };

  const form = useForm({
    defaultValues: iniciales,
    onSubmit: ({ value }) => guardar(value),
    onSubmitInvalid: () => nombreRef.current?.focus(),
  });

  const pendiente = crear.isPending || editar.isPending;
  const errorLocal = (errores: readonly unknown[], tocado: boolean): string | undefined =>
    tocado ? errores.find((e): e is string => typeof e === 'string') : undefined;

  return (
    <>
      <button type="button" className="back-link" onClick={onCancelar}>
        <Icon name="volver" />
        Volver a Ingredientes
      </button>
      <section className="form-card" aria-labelledby="form-titulo">
        <h2 id="form-titulo" ref={tituloRef} tabIndex={-1}>
          {enEdicion ? `Editar «${ingrediente.nombre}»` : 'Nuevo ingrediente'}
        </h2>
        {errorGeneral === null ? null : (
          <div className="form-alert" role="alert">
            <Icon name="alerta" />
            <div>
              No pudimos guardar el ingrediente
              <p>{errorGeneral}</p>
            </div>
          </div>
        )}
        <form
          className="form-grid"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="nombre"
            validators={{
              onMount: ({ value }) => validarNombreIngrediente(value),
              onChange: ({ value }) => validarNombreIngrediente(value),
              onBlur: ({ value }) => validarNombreIngrediente(value),
            }}
          >
            {(campo) => {
              const error = nombreRepetido ? MENSAJE_NOMBRE_REPETIDO : errorLocal(campo.state.meta.errors, campo.state.meta.isTouched);
              return (
                <Campo etiqueta="Nombre" className="c-4" contador={`${campo.state.value.length}/100`} {...(error === undefined ? {} : { error })}>
                  {(control) => (
                    <input
                      {...control}
                      ref={nombreRef}
                      className="input"
                      name={campo.name}
                      maxLength={120}
                      value={campo.state.value}
                      onBlur={campo.handleBlur}
                      onChange={(evento) => {
                        setNombreRepetido(false);
                        campo.handleChange(evento.target.value);
                      }}
                    />
                  )}
                </Campo>
              );
            }}
          </form.Field>
          <form.Field name="unidad_medida_id">
            {(campo) => (
              <Campo etiqueta="Unidad de medida" className="c-2">
                {(control) => (
                  <select {...control} className="input" name={campo.name} value={campo.state.value} onChange={(evento) => campo.handleChange(evento.target.value)}>
                    {unidades.map((unidad) => (
                      <option key={unidad.id} value={String(unidad.id)}>
                        {etiquetaUnidad(unidad)}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            )}
          </form.Field>
          <form.Field name="descripcion">
            {(campo) => (
              <Campo etiqueta="Descripción" opcional className="c-6">
                {(control) => (
                  <textarea
                    {...control}
                    className="input"
                    name={campo.name}
                    rows={3}
                    value={campo.state.value}
                    onBlur={campo.handleBlur}
                    onChange={(evento) => campo.handleChange(evento.target.value)}
                  />
                )}
              </Campo>
            )}
          </form.Field>
          <form.Field name="es_alergeno">
            {(campo) => (
              <label className={campo.state.value ? 'check c-6 is-on' : 'check c-6'}>
                <input type="checkbox" name={campo.name} checked={campo.state.value} onChange={(evento) => campo.handleChange(evento.target.checked)} />
                <span>
                  Es alérgeno
                  <small>Se destaca en el detalle de los productos que lo usan.</small>
                </span>
              </label>
            )}
          </form.Field>
          <div className="form-actions c-6">
            <button type="button" className={claseBoton('fantasma')} onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className={claseBoton('primario')} disabled={pendiente}>
              {pendiente ? 'Guardando…' : enEdicion ? 'Guardar cambios' : 'Crear ingrediente'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
