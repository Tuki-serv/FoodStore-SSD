import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { categoriaQueries, padresPosibles } from '@/entities/categoria';
import { productoGestionQueries, type Producto } from '@/entities/producto';
import { useRolesSesion } from '@/entities/session';
import { aApiError } from '@/shared/api';
import { AvisoDesactualizado, claseBoton, EncabezadoPagina, EsqueletoFilas, EstadoError, EstadoVacio, Icon, Paginacion } from '@/shared/ui';
import { accionesProductos, aParametros, disponibleDeFiltro, leerEstadoListado, type EstadoListado } from '../model';
import { DialogoBajaProducto } from './dialogo-baja-producto';
import { FiltrosProductos } from './filtros-productos';
import { FormularioProducto } from './formulario-producto';
import { ListaProductos } from './lista-productos';

/** Productos por página (el backend admite hasta 100). */
export const TAMANO_PAGINA = 20;

/** La página muestra el listado o el formulario (alta o edición): sin rutas propias. */
type Modo = { tipo: 'lista' } | { tipo: 'alta' } | { tipo: 'edicion'; id: number };

/** Productos y stock (US-010 y US-012): ADMIN gestiona el catálogo; STOCK solo ajusta stock y disponibilidad. */
export function AdminProductosPage() {
  const roles = useRolesSesion();
  const acciones = accionesProductos(roles);
  const [parametros, setParametros] = useSearchParams();
  const estado = leerEstadoListado(parametros);
  const consulta = useQuery(
    productoGestionQueries.lista({
      page: estado.page,
      size: TAMANO_PAGINA,
      q: estado.q,
      ...(estado.categoria === null ? {} : { categoriaId: estado.categoria }),
      ...(disponibleDeFiltro(estado.disponible) === undefined ? {} : { disponible: disponibleDeFiltro(estado.disponible) as boolean }),
    }),
  );
  const arbol = useQuery(categoriaQueries.arbol());
  const { data } = consulta;
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [nuevoId, setNuevoId] = useState<number | null>(null);
  const [baja, setBaja] = useState<Producto | null>(null);
  // Marca (`data-foco`) del botón al que vuelve el foco al cerrar el formulario.
  const focoAlVolver = useRef<string | null>(null);

  useEffect(() => {
    if (modo.tipo !== 'lista' || focoAlVolver.current === null) return;
    document.querySelector<HTMLElement>(`[data-foco="${focoAlVolver.current}"]`)?.focus();
    focoAlVolver.current = null;
  }, [modo]);

  const irA = (siguiente: EstadoListado, reemplazar = false): void => setParametros(aParametros(siguiente), reemplazar ? { replace: true } : undefined);

  // Si la página pedida ya no existe (por ejemplo, tras eliminar el último de la última página), se vuelve a la última que hay.
  useEffect(() => {
    if (data !== undefined && data.items.length === 0 && data.total > 0 && data.page > 1) {
      setParametros(aParametros({ ...leerEstadoListado(parametros), page: data.pages }), { replace: true });
    }
  }, [data, parametros, setParametros]);

  const abrirFormulario = (siguiente: Modo, foco: string): void => {
    focoAlVolver.current = foco;
    setNuevoId(null);
    setModo(siguiente);
  };
  const cerrarFormulario = (): void => setModo({ tipo: 'lista' });
  const terminarFormulario = (creadoId?: number): void => {
    if (creadoId !== undefined) {
      setNuevoId(creadoId);
      focoAlVolver.current = 'nuevo';
    }
    cerrarFormulario();
  };
  // El diálogo devolvió el foco al botón «Eliminar», que el refetch ya quitó del DOM: tras eliminar, el foco pasa al título.
  const terminarBaja = (): void => {
    setBaja(null);
    tituloRef.current?.focus();
  };

  const reintentar = (): void => void consulta.refetch();
  const filtrado = estado.q !== '' || estado.categoria !== null || estado.disponible !== 'todos';
  const sinNingunoYSinFiltro = data !== undefined && data.total === 0 && !filtrado;
  const nuevo = (): void => abrirFormulario({ tipo: 'alta' }, 'nuevo');
  const limpiarFiltros = (): void => irA({ q: '', categoria: null, disponible: 'todos', page: 1 });
  const botonNuevo = (
    <button type="button" className={`${claseBoton('primario')} btn-agregar`} data-foco="nuevo" onClick={nuevo}>
      <Icon name="mas" />
      Nuevo producto
    </button>
  );

  if (modo.tipo !== 'lista' && acciones.gestionar) {
    return (
      <div className="flex flex-1 flex-col">
        <EncabezadoPagina eyebrow="Administración" titulo="Productos y stock" />
        <div className="page-body flex flex-col gap-5">
          <FormularioProducto key={modo.tipo === 'edicion' ? modo.id : 'alta'} {...(modo.tipo === 'edicion' ? { id: modo.id } : {})} onCancelar={cerrarFormulario} onTerminar={terminarFormulario} />
        </div>
      </div>
    );
  }

  const categoriasPosibles = padresPosibles(arbol.data ?? []);
  const nombreCategoria = categoriasPosibles.find((categoria) => categoria.id === estado.categoria)?.nombre ?? 'Categoría elegida';
  const filtrosActivos = [
    ...(estado.q === '' ? [] : [{ id: 'q', etiqueta: estado.q, texto: `«${estado.q}»`, onQuitar: () => irA({ ...estado, q: '', page: 1 }) }]),
    ...(estado.categoria === null ? [] : [{ id: 'categoria', etiqueta: nombreCategoria, onQuitar: () => irA({ ...estado, categoria: null, page: 1 }) }]),
    ...(estado.disponible === 'todos' ? [] : [{ id: 'disponible', etiqueta: estado.disponible === 'si' ? 'Disponibles' : 'No disponibles', onQuitar: () => irA({ ...estado, disponible: 'todos', page: 1 }) }]),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoPagina
        fijo
        herramientasColapsables
        eyebrow="Administración"
        titulo="Productos y stock"
        tituloRef={tituloRef}
        subtitulo={
          acciones.gestionar
            ? 'Cargá productos con sus categorías e ingredientes y mantené el stock y la disponibilidad al día.'
            : 'Actualizá el stock y la disponibilidad de cada producto.'
        }
        acciones={acciones.gestionar && !sinNingunoYSinFiltro ? botonNuevo : undefined}
        herramientas={<FiltrosProductos estado={estado} categorias={categoriasPosibles} onCambiar={(cambios) => irA({ ...estado, ...cambios, page: 1 })} />}
        {...(data === undefined ? {} : { filtrosActivos: { conteo: `${data.total} ${data.total === 1 ? 'producto' : 'productos'}`, filtros: filtrosActivos, onLimpiar: limpiarFiltros } })}
      />
      <div className="page-body flex flex-col gap-5">
      {consulta.isError && data !== undefined ? <AvisoDesactualizado texto="No pudimos actualizar los productos" onReintentar={reintentar} /> : null}
      {data === undefined ? (
        consulta.isError ? (
          <EstadoError titulo="No pudimos cargar los productos" detalle={aApiError(consulta.error).detail} onReintentar={reintentar} />
        ) : (
          <EsqueletoFilas etiqueta="Cargando productos" filas={6} />
        )
      ) : data.total === 0 ? (
        filtrado ? (
          <EstadoVacio icono="buscar" titulo="No encontramos productos con esos filtros" texto="Probá con otro nombre o quitá los filtros de categoría y disponibilidad.">
            <button type="button" className={claseBoton('secundario')} onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </EstadoVacio>
        ) : (
          <EstadoVacio icono="productos" titulo="Todavía no hay productos" texto={acciones.gestionar ? 'Cargá el primero para empezar a vender.' : 'Cuando se carguen productos van a aparecer acá.'}>
            {acciones.gestionar ? botonNuevo : null}
          </EstadoVacio>
        )
      ) : (
        <>
          <ListaProductos
            productos={data.items}
            acciones={acciones}
            nuevoId={nuevoId}
            onEditar={(producto) => abrirFormulario({ tipo: 'edicion', id: producto.id }, `editar-${producto.id}`)}
            onEliminar={setBaja}
          />
          <Paginacion etiqueta="Paginación de productos" page={data.page} pages={data.pages} onCambiar={(destino) => irA({ ...estado, page: destino })} />
        </>
      )}
      {baja === null ? null : <DialogoBajaProducto producto={baja} onCerrar={() => setBaja(null)} onEliminado={terminarBaja} />}
      </div>
    </div>
  );
}
