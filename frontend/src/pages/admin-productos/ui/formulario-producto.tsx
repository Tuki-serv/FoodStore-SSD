import { useForm, useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { categoriaQueries, padresPosibles } from '@/entities/categoria';
import { ingredienteQueries } from '@/entities/ingrediente';
import { productoGestionQueries, useCrearProducto, useEditarProducto, type Producto } from '@/entities/producto';
import { unidadMedidaQueries } from '@/entities/unidad-medida';
import { aApiError, esApiError } from '@/shared/api';
import { avisarExito } from '@/shared/model';
import { Campo, claseBoton, EsqueletoFilas, EstadoError, Icon } from '@/shared/ui';
import {
  aCuerpoProducto,
  cambiosProducto,
  MAXIMO_NOMBRE_PRODUCTO,
  validarProducto,
  valoresInicialesProducto,
  type ValoresProducto,
} from '../model';
import { SeccionCategorias } from './seccion-categorias';
import { SeccionIngredientes } from './seccion-ingredientes';

export interface FormularioProductoProps {
  /** Id del producto a editar; sin él es un alta. */
  id?: number;
  /** «Cancelar» o «Volver»: cierra sin enviar nada. */
  onCancelar: () => void;
  /** Cierra tras guardar o al no haber cambios; `nuevoId` es el del producto creado (para resaltarlo). */
  onTerminar: (nuevoId?: number) => void;
}

const MENSAJE_NOMBRE_REPETIDO = 'Ya existe un producto con ese nombre.';
/** Símbolo de la unidad con la que arranca una fila de ingrediente nueva. */
const SIMBOLO_POR_DEFECTO = 'u';

function VolverAProductos({ onCancelar }: { onCancelar: () => void }) {
  return (
    <button type="button" className="back-link" onClick={onCancelar}>
      <Icon name="volver" />
      Volver a Productos y stock
    </button>
  );
}

/** Carga lo que el formulario necesita (árbol, ingredientes, unidades y, al editar, el producto) y recién entonces lo dibuja. */
export function FormularioProducto(props: FormularioProductoProps) {
  const arbol = useQuery(categoriaQueries.arbol());
  const ingredientes = useQuery(ingredienteQueries.lista({ page: 1, size: 100, alergeno: null }));
  const unidades = useQuery(unidadMedidaQueries.todas());
  const detalle = useQuery({ ...productoGestionQueries.detalle(props.id ?? 0), enabled: props.id !== undefined });

  const consultas = [arbol, ingredientes, unidades, ...(props.id === undefined ? [] : [detalle])];
  const fallida = consultas.find((consulta) => consulta.isError);
  const listo = arbol.data !== undefined && ingredientes.data !== undefined && unidades.data !== undefined && (props.id === undefined || detalle.data !== undefined);

  if (!listo) {
    return (
      <>
        <VolverAProductos onCancelar={props.onCancelar} />
        {fallida === undefined ? (
          <EsqueletoFilas etiqueta="Cargando el formulario" filas={4} />
        ) : (
          <EstadoError
            titulo="No pudimos cargar el formulario"
            detalle={aApiError(fallida.error).detail}
            onReintentar={() => consultas.forEach((consulta) => void consulta.refetch())}
          />
        )}
      </>
    );
  }

  const unidadPorDefecto = unidades.data.find((u) => u.simbolo === SIMBOLO_POR_DEFECTO) ?? unidades.data[0];
  return (
    <CuerpoFormulario
      {...props}
      producto={detalle.data}
      categorias={padresPosibles(arbol.data)}
      ingredientes={ingredientes.data.items}
      unidades={unidades.data}
      unidadPorDefecto={unidadPorDefecto === undefined ? '' : String(unidadPorDefecto.id)}
    />
  );
}

interface CuerpoProps extends FormularioProductoProps {
  producto: Producto | undefined;
  categorias: ReturnType<typeof padresPosibles>;
  ingredientes: Parameters<typeof SeccionIngredientes>[0]['ingredientes'];
  unidades: Parameters<typeof SeccionIngredientes>[0]['unidades'];
  unidadPorDefecto: string;
}

function CuerpoFormulario({ producto, categorias, ingredientes, unidades, unidadPorDefecto, onCancelar, onTerminar }: CuerpoProps) {
  const cliente = useQueryClient();
  const crear = useCrearProducto();
  const editar = useEditarProducto();
  const enEdicion = producto !== undefined;
  const [iniciales] = useState(() => valoresInicialesProducto(producto));
  const [intentado, setIntentado] = useState(0);
  const [nombreRepetido, setNombreRepetido] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const formularioRef = useRef<HTMLFormElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: iniciales,
    onSubmit: ({ value }) => guardar(value),
  });
  const valores = useStore(form.store, (estado) => estado.values);
  const errores = validarProducto(valores, { alta: !enEdicion });
  const hayErrores = Object.keys(errores).length > 0;
  const mostrar = intentado > 0 ? errores : {};

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  useEffect(() => {
    if (nombreRepetido) nombreRef.current?.focus();
  }, [nombreRepetido]);

  // Tras un intento de guardar con errores, el foco va al primer campo marcado.
  useEffect(() => {
    if (intentado === 0) return;
    formularioRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [intentado]);

  async function guardar(valoresAGuardar: ValoresProducto): Promise<void> {
    setNombreRepetido(false);
    setErrorGeneral(null);
    try {
      if (producto === undefined) {
        const creado = await crear.mutateAsync(aCuerpoProducto(valoresAGuardar));
        avisarExito('Producto creado', `«${creado.nombre}»`);
        onTerminar(creado.id);
        return;
      }
      const cambios = cambiosProducto(iniciales, valoresAGuardar);
      if (Object.keys(cambios).length > 0) {
        await editar.mutateAsync({ id: producto.id, cambios });
        avisarExito('Producto actualizado', `«${valoresAGuardar.nombre.trim()}»`);
      }
      onTerminar();
    } catch (error) {
      if (!esApiError(error)) throw error;
      if (error.code === 'DUPLICATE_VALUE' && error.field === 'nombre') {
        setNombreRepetido(true);
        return;
      }
      setErrorGeneral(error.detail);
      // Una categoría, un ingrediente o una unidad pudo haberse eliminado mientras se editaba: se refrescan las listas.
      if (error.status === 404 || error.status === 422) {
        await Promise.all([cliente.invalidateQueries({ queryKey: ['categorias'] }), cliente.invalidateQueries({ queryKey: ['ingredientes'] })]);
      }
    }
  }

  const intentarGuardar = (): void => {
    setIntentado((n) => n + 1);
    if (!hayErrores) void form.handleSubmit();
  };

  const pendiente = crear.isPending || editar.isPending;
  const errorNombre = nombreRepetido ? MENSAJE_NOMBRE_REPETIDO : mostrar.nombre;

  return (
    <>
      <VolverAProductos onCancelar={onCancelar} />
      <section className="form-card wide" aria-labelledby="form-titulo">
        <h2 id="form-titulo" ref={tituloRef} tabIndex={-1}>
          {enEdicion ? `Editar «${producto.nombre}»` : 'Nuevo producto'}
        </h2>
        {errorGeneral === null ? null : (
          <div className="form-alert" role="alert">
            <Icon name="alerta" />
            <div>
              No pudimos guardar el producto
              <p>{errorGeneral}</p>
            </div>
          </div>
        )}
        {intentado > 0 && hayErrores ? (
          <div className="form-alert" role="alert">
            <Icon name="alerta" />
            <div>
              Revisá los datos marcados
              <p>No enviamos nada todavía: corregí los campos con error y volvé a guardar.</p>
            </div>
          </div>
        ) : null}
        <form
          ref={formularioRef}
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            intentarGuardar();
          }}
        >
          <div className="form-grid">
            <form.Field name="nombre">
              {(campo) => (
                <Campo etiqueta="Nombre" className="c-4" contador={`${campo.state.value.length}/${MAXIMO_NOMBRE_PRODUCTO}`} {...(errorNombre === undefined ? {} : { error: errorNombre })}>
                  {(control) => (
                    <input
                      {...control}
                      ref={nombreRef}
                      className="input"
                      name={campo.name}
                      maxLength={MAXIMO_NOMBRE_PRODUCTO + 20}
                      value={campo.state.value}
                      onBlur={campo.handleBlur}
                      onChange={(evento) => {
                        setNombreRepetido(false);
                        campo.handleChange(evento.target.value);
                      }}
                    />
                  )}
                </Campo>
              )}
            </form.Field>
            <form.Field name="precio_base">
              {(campo) => (
                <Campo etiqueta="Precio" className="c-2" {...(mostrar.precio_base === undefined ? {} : { error: mostrar.precio_base })}>
                  {(control) => (
                    <div className="input-money">
                      <span aria-hidden="true">$</span>
                      <input {...control} className="input" name={campo.name} inputMode="decimal" value={campo.state.value} onBlur={campo.handleBlur} onChange={(evento) => campo.handleChange(evento.target.value)} />
                    </div>
                  )}
                </Campo>
              )}
            </form.Field>
            <form.Field name="descripcion">
              {(campo) => (
                <Campo etiqueta="Descripción" opcional className="c-6">
                  {(control) => (
                    <textarea {...control} className="input" name={campo.name} rows={2} value={campo.state.value} onBlur={campo.handleBlur} onChange={(evento) => campo.handleChange(evento.target.value)} />
                  )}
                </Campo>
              )}
            </form.Field>
            {enEdicion ? (
              <div className="c-6 ro-note">
                <Icon name="alerta" />
                <div>
                  Stock y disponibilidad
                  <br />
                  <span>Se cambian desde la lista de productos (también puede hacerlo el rol Stock).</span>
                </div>
              </div>
            ) : (
              <>
                <form.Field name="stock_cantidad">
                  {(campo) => (
                    <Campo etiqueta="Stock inicial" className="c-2" {...(mostrar.stock_cantidad === undefined ? {} : { error: mostrar.stock_cantidad })}>
                      {(control) => (
                        <input {...control} className="input" name={campo.name} type="number" inputMode="numeric" min={0} step={1} value={campo.state.value} onBlur={campo.handleBlur} onChange={(evento) => campo.handleChange(evento.target.value)} />
                      )}
                    </Campo>
                  )}
                </form.Field>
                <form.Field name="disponible">
                  {(campo) => (
                    <div className="field c-4">
                      <span className="field-label" aria-hidden="true">
                        &nbsp;
                      </span>
                      <label className="switch">
                        <span>
                          Disponible para la venta
                          <small>Si lo apagás, se crea oculto del catálogo.</small>
                        </span>
                        <input type="checkbox" role="switch" name={campo.name} checked={campo.state.value} onChange={(evento) => campo.handleChange(evento.target.checked)} />
                      </label>
                    </div>
                  )}
                </form.Field>
              </>
            )}
          </div>

          <SeccionCategorias
            categorias={categorias}
            marcadas={valores.categoria_ids}
            principal={valores.categoria_principal}
            error={mostrar.categorias}
            onCambiar={(marcadas, principal) => {
              form.setFieldValue('categoria_ids', marcadas);
              form.setFieldValue('categoria_principal', principal);
            }}
          />
          <SeccionIngredientes
            filas={valores.ingredientes}
            ingredientes={ingredientes}
            unidades={unidades}
            unidadPorDefecto={unidadPorDefecto}
            errores={mostrar.ingredientes}
            onCambiar={(filas) => form.setFieldValue('ingredientes', filas)}
          />

          <div className="form-actions">
            <button type="button" className={claseBoton('fantasma')} onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className={claseBoton('primario')} disabled={pendiente}>
              {pendiente ? 'Guardando…' : enEdicion ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
