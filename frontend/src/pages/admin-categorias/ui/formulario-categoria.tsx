import { useForm } from '@tanstack/react-form';
import { useEffect, useRef, useState } from 'react';
import { padresPosibles, useCrearCategoria, useEditarCategoria, type CategoriaNodo } from '@/entities/categoria';
import { esApiError } from '@/shared/api';
import { avisarExito } from '@/shared/model';
import { Campo, claseBoton, Icon } from '@/shared/ui';
import { aCuerpoCategoria, cambiosCategoria, validarNombreCategoria, valoresInicialesCategoria, type ValoresCategoria } from '../model';

export interface FormularioCategoriaProps {
  /** Árbol cargado: de ahí salen los padres posibles. */
  arbol: readonly CategoriaNodo[];
  /** Categoría a editar; sin ella es un alta. */
  categoria?: CategoriaNodo;
  /** Alta desde «Agregar subcategoría»: padre ya elegido. */
  padreId?: number;
  /** «Cancelar» o «Volver»: cierra sin enviar nada. */
  onCancelar: () => void;
  /** Cierra tras guardar o al no haber cambios; `nuevoId` es el de la categoría creada (para resaltarla). */
  onTerminar: (nuevoId?: number) => void;
}

const MENSAJE_NOMBRE_REPETIDO = 'Ya existe una categoría con ese nombre.';

/** Formulario de alta y edición de una categoría (TanStack Form): padre sin ciclos, diff al editar y errores del servidor. */
export function FormularioCategoria({ arbol, categoria, padreId, onCancelar, onTerminar }: FormularioCategoriaProps) {
  const crear = useCrearCategoria();
  const editar = useEditarCategoria();
  const [nombreRepetido, setNombreRepetido] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const enEdicion = categoria !== undefined;
  const iniciales = valoresInicialesCategoria(categoria, padreId);
  const padres = padresPosibles(arbol, categoria?.id);

  // Al abrir, el foco va al encabezado (el contenido anterior desapareció).
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  // Un 409 de nombre repetido deja el foco en «Nombre», con el error ya dibujado.
  useEffect(() => {
    if (nombreRepetido) nombreRef.current?.focus();
  }, [nombreRepetido]);

  const guardar = async (valores: ValoresCategoria): Promise<void> => {
    setNombreRepetido(false);
    setErrorGeneral(null);
    try {
      if (categoria === undefined) {
        const creada = await crear.mutateAsync(aCuerpoCategoria(valores));
        avisarExito('Categoría creada', `«${creada.nombre}»`);
        onTerminar(creada.id);
        return;
      }
      const cambios = cambiosCategoria(iniciales, valores);
      if (Object.keys(cambios).length > 0) {
        await editar.mutateAsync({ id: categoria.id, cambios });
        avisarExito('Categoría actualizada', `«${valores.nombre.trim()}»`);
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
    // «Nombre» es el único campo con reglas locales: el foco va ahí sin esperar a que se dibuje el error.
    onSubmitInvalid: () => nombreRef.current?.focus(),
  });

  const pendiente = crear.isPending || editar.isPending;
  const errorLocal = (errores: readonly unknown[], tocado: boolean): string | undefined =>
    tocado ? errores.find((e): e is string => typeof e === 'string') : undefined;

  return (
    <>
      <button type="button" className="back-link" onClick={onCancelar}>
        <Icon name="volver" />
        Volver a Categorías
      </button>
      <section className="form-card" aria-labelledby="form-titulo">
        <h2 id="form-titulo" ref={tituloRef} tabIndex={-1}>
          {enEdicion ? `Editar «${categoria.nombre}»` : padreId === undefined ? 'Nueva categoría' : 'Nueva subcategoría'}
        </h2>
        {errorGeneral === null ? null : (
          <div className="form-alert" role="alert">
            <Icon name="alerta" />
            <div>
              No pudimos guardar la categoría
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
              onMount: ({ value }) => validarNombreCategoria(value),
              onChange: ({ value }) => validarNombreCategoria(value),
              onBlur: ({ value }) => validarNombreCategoria(value),
            }}
          >
            {(campo) => {
              const error = nombreRepetido ? MENSAJE_NOMBRE_REPETIDO : errorLocal(campo.state.meta.errors, campo.state.meta.isTouched);
              return (
                <Campo
                  etiqueta="Nombre"
                  className="c-3"
                  contador={`${campo.state.value.length}/100`}
                  {...(error === undefined ? {} : { error })}
                >
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
          <form.Field name="parent_id">
            {(campo) => (
              <Campo
                etiqueta="Categoría padre"
                opcional
                className="c-3"
                ayuda={
                  enEdicion
                    ? `No se ofrecen «${categoria.nombre}» ni sus subcategorías: formarían un ciclo.`
                    : 'Vacío = categoría principal.'
                }
              >
                {(control) => (
                  <select {...control} className="input" name={campo.name} value={campo.state.value} onChange={(evento) => campo.handleChange(evento.target.value)}>
                    <option value="">Sin padre (categoría raíz)</option>
                    {padres.map((padre) => (
                      <option key={padre.id} value={String(padre.id)}>
                        {'— '.repeat(padre.nivel)}
                        {padre.nombre}
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
          <form.Field name="imagen_url">
            {(campo) => (
              <Campo etiqueta="URL de imagen" opcional className="c-6" ayuda="Pegá el enlace de una imagen que represente la categoría.">
                {(control) => (
                  <input
                    {...control}
                    className="input"
                    name={campo.name}
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={campo.state.value}
                    onBlur={campo.handleBlur}
                    onChange={(evento) => campo.handleChange(evento.target.value)}
                  />
                )}
              </Campo>
            )}
          </form.Field>
          <div className="form-actions c-6">
            <button type="button" className={claseBoton('fantasma')} onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className={claseBoton('primario')} disabled={pendiente}>
              {pendiente ? 'Guardando…' : enEdicion ? 'Guardar cambios' : 'Crear categoría'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
