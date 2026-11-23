import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { direccionQueries, nombreDireccion, useEliminarDireccion, useMarcarPrincipal, type Direccion } from '@/entities/direccion';
import { useUiStore } from '@/shared/model';
import { claseBoton, EncabezadoPagina, Icon, Paginacion } from '@/shared/ui';
import { CargandoDirecciones, ErrorDirecciones, ListadoDesactualizado, VacioDirecciones } from './estados-direcciones';
import { FormularioDireccion } from './formulario-direccion';
import { ListaDirecciones } from './lista-direcciones';
import { avisarResultado } from '../model';


/** Direcciones por página (el backend admite hasta 100). */
export const TAMANO_PAGINA = 20;

/** Página pedida en `?page=`: entero >= 1; cualquier otro valor es la primera. */
function leerPagina(valor: string | null): number {
  const pagina = Number(valor);
  return Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
}

/** La página muestra el listado o el formulario (alta o edición): sin rutas propias (design D6). */
type Modo = { tipo: 'lista' } | { tipo: 'alta' } | { tipo: 'edicion'; direccion: Direccion };

/** Direcciones de entrega del usuario (US-006): listado paginado, formulario, principal y eliminación. */
export function DireccionesPage() {
  const [parametros, setParametros] = useSearchParams();
  const page = leerPagina(parametros.get('page'));
  const consulta = useQuery(direccionQueries.lista({ page, size: TAMANO_PAGINA }));
  const { data } = consulta;
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  // Marca (`data-foco`) del botón que abrió el formulario: al cerrarlo el foco vuelve ahí.
  const focoAlVolver = useRef<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const marcar = useMarcarPrincipal();
  const eliminar = useEliminarDireccion();

  const abrirFormulario = (siguiente: Modo, foco: string): void => {
    focoAlVolver.current = foco;
    setModo(siguiente);
  };
  const cerrarFormulario = (): void => setModo({ tipo: 'lista' });

  useEffect(() => {
    if (modo.tipo !== 'lista' || focoAlVolver.current === null) return;
    document.querySelector<HTMLElement>(`[data-foco="${focoAlVolver.current}"]`)?.focus();
    focoAlVolver.current = null;
  }, [modo]);

  const marcarPrincipal = (direccion: Direccion): void => {
    void avisarResultado(marcar.mutateAsync(direccion.id), 'Dirección principal actualizada');
  };

  // El diálogo devolvió el foco al botón «Eliminar», que el refetch quita del DOM: tras eliminar, el foco pasa al título.
  const eliminarYEnfocar = async (direccion: Direccion): Promise<void> => {
    if (await avisarResultado(eliminar.mutateAsync(direccion.id), 'Dirección eliminada')) tituloRef.current?.focus();
  };

  const pedirEliminar = (direccion: Direccion, hayOtras: boolean): void => {
    const avisoPrincipal =
      direccion.es_principal && hayOtras ? ' Es tu dirección principal: si la eliminás, ninguna quedará como principal hasta que marques otra.' : '';
    useUiStore.getState().pedirConfirmacion({
      titulo: `¿Eliminar «${nombreDireccion(direccion)}»?`,
      mensaje: `${direccion.linea1}, ${direccion.ciudad}. Los pedidos que ya hiciste no cambian.${avisoPrincipal}`,
      textoConfirmar: 'Eliminar',
      variante: 'peligro',
      onConfirmar: () => void eliminarYEnfocar(direccion),
    });
  };

  const irAPagina = (destino: number): void => {
    setParametros(destino <= 1 ? {} : { page: String(destino) });
  };

  // Si eliminar dejó vacía la página actual, se vuelve a la última que existe.
  useEffect(() => {
    if (data !== undefined && data.items.length === 0 && data.total > 0 && data.page > 1) {
      setParametros(data.pages <= 1 ? {} : { page: String(data.pages) }, { replace: true });
    }
  }, [data, setParametros]);


  if (modo.tipo !== 'lista') {
    return (
      <div className="flex flex-1 flex-col">
        <EncabezadoPagina eyebrow="Tu cuenta" titulo="Direcciones" />
        <div className="page-body flex flex-col gap-5">
          <FormularioDireccion
            key={modo.tipo === 'edicion' ? modo.direccion.id : 'alta'}
            {...(modo.tipo === 'edicion' ? { direccion: modo.direccion } : {})}
            onCancelar={cerrarFormulario}
            onTerminar={cerrarFormulario}
          />
        </div>
      </div>
    );
  }

  const agregar = (): void => abrirFormulario({ tipo: 'alta' }, 'agregar');
  const sinPrincipal = data !== undefined && data.page === 1 && data.items.length > 0 && !data.items.some((d) => d.es_principal);

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoPagina
        fijo
        eyebrow="Tu cuenta"
        titulo="Direcciones"
        tituloRef={tituloRef}
        subtitulo="Guardá dónde querés recibir tus pedidos. La principal se elige sola al pedir."
        acciones={
          data !== undefined && data.total > 0 ? (
            <button type="button" className={`${claseBoton('primario')} btn-agregar`} data-foco="agregar" onClick={agregar}>
              <Icon name="mas" />
              Agregar dirección
            </button>
          ) : undefined
        }
        {...(data === undefined || data.total === 0 ? {} : { filtrosActivos: { conteo: `${data.total} ${data.total === 1 ? 'dirección' : 'direcciones'}`, filtros: [] } })}
      />
      <div className="page-body flex flex-col gap-5">
      {sinPrincipal ? (
        <div className="notice">
          <Icon name="alerta" />
          <div>
            Ninguna dirección es principal
            <p>Marcá una para que se elija sola cuando hagas un pedido.</p>
          </div>
        </div>
      ) : null}
      {consulta.isError && data !== undefined ? <ListadoDesactualizado onReintentar={() => void consulta.refetch()} /> : null}
      {data === undefined ? (
        consulta.isError ? (
          <ErrorDirecciones error={consulta.error} onReintentar={() => void consulta.refetch()} />
        ) : (
          <CargandoDirecciones />
        )
      ) : data.total === 0 ? (
        <VacioDirecciones onAgregar={agregar} />
      ) : (
        <>
          <ListaDirecciones
            direcciones={data.items}
            onEditar={(direccion) => abrirFormulario({ tipo: 'edicion', direccion }, `editar-${direccion.id}`)}
            marcandoPrincipal={marcar.isPending}
            onMarcarPrincipal={marcarPrincipal}
            onEliminar={(direccion) => pedirEliminar(direccion, data.total > 1)}
          />
          <Paginacion etiqueta="Paginación de direcciones" page={data.page} pages={data.pages} onCambiar={irAPagina} />
        </>
      )}
      </div>
    </div>
  );
}
