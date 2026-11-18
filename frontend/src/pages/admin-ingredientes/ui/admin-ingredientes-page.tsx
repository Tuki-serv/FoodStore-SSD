import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ingredienteQueries, type Ingrediente } from '@/entities/ingrediente';
import { unidadMedidaQueries } from '@/entities/unidad-medida';
import { aApiError } from '@/shared/api';
import { AvisoDesactualizado, claseBoton, EsqueletoFilas, EstadoError, EstadoVacio, Icon, Paginacion } from '@/shared/ui';
import { alergenoDeFiltro, aParametros, leerEstadoListado, type FiltroAlergeno } from '../model';
import { DialogoBajaIngrediente } from './dialogo-baja-ingrediente';
import { FiltroAlergenos } from './filtro-alergenos';
import { FormularioIngrediente } from './formulario-ingrediente';
import { ListaIngredientes } from './lista-ingredientes';

/** Ingredientes por página (el backend admite hasta 100). */
export const TAMANO_PAGINA = 20;

const TEXTOS_VACIO: Record<Exclude<FiltroAlergeno, 'todos'>, { titulo: string; texto: string }> = {
  si: { titulo: 'No hay ingredientes alérgenos', texto: 'Cuando marques un ingrediente como alérgeno va a aparecer acá.' },
  no: { titulo: 'No hay ingredientes no alérgenos', texto: 'Cuando cargues un ingrediente sin marca de alérgeno va a aparecer acá.' },
};

/** La página muestra el listado o el formulario (alta o edición): sin rutas propias (design D3). */
type Modo = { tipo: 'lista' } | { tipo: 'alta' } | { tipo: 'edicion'; ingrediente: Ingrediente };

/** Administración de ingredientes (US-011, solo ADMIN): listado paginado y filtrado, alta, edición y baja. */
export function AdminIngredientesPage() {
  const [parametros, setParametros] = useSearchParams();
  const { filtro, page } = leerEstadoListado(parametros);
  const consulta = useQuery(ingredienteQueries.lista({ page, size: TAMANO_PAGINA, alergeno: alergenoDeFiltro(filtro) }));
  const unidades = useQuery(unidadMedidaQueries.todas());
  const { data } = consulta;
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [nuevoId, setNuevoId] = useState<number | null>(null);
  const [baja, setBaja] = useState<Ingrediente | null>(null);
  // Marca (`data-foco`) del botón al que vuelve el foco al cerrar el formulario.
  const focoAlVolver = useRef<string | null>(null);

  useEffect(() => {
    if (modo.tipo !== 'lista' || focoAlVolver.current === null) return;
    document.querySelector<HTMLElement>(`[data-foco="${focoAlVolver.current}"]`)?.focus();
    focoAlVolver.current = null;
  }, [modo]);

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

  const irA = (siguiente: { filtro: FiltroAlergeno; page: number }, reemplazar = false): void =>
    setParametros(aParametros(siguiente), reemplazar ? { replace: true } : undefined);

  // Si la página pedida ya no existe (por ejemplo, tras eliminar el último de la última página), se vuelve a la última que hay.
  useEffect(() => {
    if (data !== undefined && data.items.length === 0 && data.total > 0 && data.page > 1) {
      setParametros(aParametros({ filtro, page: data.pages }), { replace: true });
    }
  }, [data, filtro, setParametros]);

  const reintentar = (): void => void consulta.refetch();
  const contenedor = 'mx-auto flex w-full max-w-[1040px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6';
  // El diálogo devolvió el foco al botón «Eliminar», que el refetch ya quitó del DOM: tras eliminar, el foco pasa al título.
  const terminarBaja = (): void => {
    setBaja(null);
    tituloRef.current?.focus();
  };

  const nuevo = (): void => abrirFormulario({ tipo: 'alta' }, 'nuevo');
  const sinNingunoYSinFiltro = data !== undefined && data.total === 0 && filtro === 'todos';

  if (modo.tipo !== 'lista') {
    return (
      <div className={contenedor}>
        <h1 className="sr-only">Ingredientes</h1>
        <FormularioIngrediente
          key={modo.tipo === 'edicion' ? modo.ingrediente.id : 'alta'}
          {...(modo.tipo === 'edicion' ? { ingrediente: modo.ingrediente } : {})}
          onCancelar={cerrarFormulario}
          onTerminar={terminarFormulario}
        />
      </div>
    );
  }

  return (
    <div className={contenedor}>
      <div className="page-head-row">
        <header className="page-head">
          <h1 ref={tituloRef} tabIndex={-1} className="text-2xl">
            Ingredientes
          </h1>
          <p>Cargá los ingredientes y marcá los alérgenos: se destacan en el detalle de cada producto.</p>
        </header>
        {sinNingunoYSinFiltro ? null : (
          <button type="button" className={`${claseBoton('primario')} btn-agregar`} data-foco="nuevo" onClick={nuevo}>
            <Icon name="mas" />
            Nuevo ingrediente
          </button>
        )}
      </div>
      <div className="toolbar">
        <FiltroAlergenos filtro={filtro} onCambiar={(siguiente) => irA({ filtro: siguiente, page: 1 })} />
        {data === undefined ? null : (
          <p className="admin-summary" role="status">
            <strong>
              {data.total} {data.total === 1 ? 'ingrediente' : 'ingredientes'}
            </strong>
            {filtro === 'todos' ? '' : filtro === 'si' ? ' alérgenos' : ' no alérgenos'}
          </p>
        )}
      </div>
      {consulta.isError && data !== undefined ? <AvisoDesactualizado texto="No pudimos actualizar los ingredientes" onReintentar={reintentar} /> : null}
      {data === undefined ? (
        consulta.isError ? (
          <EstadoError titulo="No pudimos cargar los ingredientes" detalle={aApiError(consulta.error).detail} onReintentar={reintentar} />
        ) : (
          <EsqueletoFilas etiqueta="Cargando ingredientes" filas={6} />
        )
      ) : data.total === 0 ? (
        filtro === 'todos' ? (
          <EstadoVacio icono="ingredientes" titulo="Todavía no hay ingredientes" texto="Cargá el primero para poder armar productos con él.">
            <button type="button" className={claseBoton('primario')} data-foco="nuevo" onClick={nuevo}>
              <Icon name="mas" />
              Nuevo ingrediente
            </button>
          </EstadoVacio>
        ) : (
          <EstadoVacio icono="alergeno" titulo={TEXTOS_VACIO[filtro].titulo} texto={TEXTOS_VACIO[filtro].texto}>
            <button type="button" className={claseBoton('secundario')} onClick={() => irA({ filtro: 'todos', page: 1 })}>
              Ver todos
            </button>
          </EstadoVacio>
        )
      ) : (
        <>
          <ListaIngredientes ingredientes={data.items} unidades={unidades.data ?? []} nuevoId={nuevoId} onEditar={(ingrediente) => abrirFormulario({ tipo: 'edicion', ingrediente }, `editar-${ingrediente.id}`)} onEliminar={setBaja} />
          <Paginacion etiqueta="Paginación de ingredientes" page={data.page} pages={data.pages} onCambiar={(destino) => irA({ filtro, page: destino })} />
        </>
      )}
      {baja === null ? null : <DialogoBajaIngrediente ingrediente={baja} onCerrar={() => setBaja(null)} onEliminado={terminarBaja} />}
    </div>
  );
}
