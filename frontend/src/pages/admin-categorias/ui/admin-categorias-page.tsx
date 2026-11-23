import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { categoriaQueries, type CategoriaNodo } from '@/entities/categoria';
import { aApiError } from '@/shared/api';
import { AvisoDesactualizado, claseBoton, EncabezadoPagina, EsqueletoFilas, EstadoError, EstadoVacio, Icon } from '@/shared/ui';
import { ArbolEditable } from './arbol-editable';
import { DialogoBajaCategoria } from './dialogo-baja-categoria';
import { FormularioCategoria } from './formulario-categoria';

const contarCategorias = (nodos: readonly CategoriaNodo[]): number => nodos.reduce((total, nodo) => total + 1 + contarCategorias(nodo.subcategorias), 0);

/** La página muestra el árbol o el formulario (alta, alta de subcategoría o edición): sin rutas propias (design D3). */
type Modo = { tipo: 'lista' } | { tipo: 'alta'; padreId?: number } | { tipo: 'edicion'; categoria: CategoriaNodo };

/** Administración de categorías (US-009, solo ADMIN): árbol con alta, edición sin ciclos y baja validada. */
export function AdminCategoriasPage() {
  // El árbol de administración usa la misma consulta pública que el catálogo, pero siempre se revalida al entrar (design D2).
  const consulta = useQuery({ ...categoriaQueries.arbol(), staleTime: 0, refetchOnMount: 'always' });
  const { data: arbol } = consulta;
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [nuevoId, setNuevoId] = useState<number | null>(null);
  const [baja, setBaja] = useState<CategoriaNodo | null>(null);
  // Marca (`data-foco`) del botón al que vuelve el foco al cerrar el formulario.
  const focoAlVolver = useRef<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

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
  const terminarFormulario = (creadaId?: number): void => {
    if (creadaId !== undefined) {
      setNuevoId(creadaId);
      focoAlVolver.current = 'nueva';
    }
    cerrarFormulario();
  };

  // El diálogo devolvió el foco al botón «Eliminar», que el refetch ya quitó del DOM: tras eliminar, el foco pasa al título.
  const terminarBaja = (): void => {
    setBaja(null);
    tituloRef.current?.focus();
  };

  const reintentar = (): void => void consulta.refetch();

  if (modo.tipo !== 'lista') {
    return (
      <div className="flex flex-1 flex-col">
        <EncabezadoPagina eyebrow="Administración" titulo="Categorías" />
        <div className="page-body flex flex-col gap-5">
          <FormularioCategoria
            key={modo.tipo === 'edicion' ? modo.categoria.id : `alta-${modo.padreId ?? 'raiz'}`}
            arbol={arbol ?? []}
            {...(modo.tipo === 'edicion' ? { categoria: modo.categoria } : modo.padreId === undefined ? {} : { padreId: modo.padreId })}
            onCancelar={cerrarFormulario}
            onTerminar={terminarFormulario}
          />
        </div>
      </div>
    );
  }

  const nueva = (): void => abrirFormulario({ tipo: 'alta' }, 'nueva');
  const hayCategorias = arbol !== undefined && arbol.length > 0;

  const boton = hayCategorias ? (
    <button type="button" className={`${claseBoton('primario')} btn-agregar`} data-foco="nueva" onClick={nueva}>
      <Icon name="mas" />
      Nueva categoría
    </button>
  ) : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoPagina
        fijo
        eyebrow="Administración"
        titulo="Categorías"
        tituloRef={tituloRef}
        subtitulo="Organizá el catálogo en categorías y subcategorías. Los cambios se ven enseguida en el catálogo."
        acciones={boton}
        {...(hayCategorias
          ? {
              filtrosActivos: {
                conteo: (
                  <>
                    {contarCategorias(arbol)} categorías<small>{` · ${arbol.length} ${arbol.length === 1 ? 'principal' : 'principales'}`}</small>
                  </>
                ),
                filtros: [],
              },
            }
          : {})}
      />
      <div className="page-body flex flex-col gap-5">
      {consulta.isError && arbol !== undefined ? <AvisoDesactualizado texto="No pudimos actualizar las categorías" onReintentar={reintentar} /> : null}
      {arbol === undefined ? (
        consulta.isError ? (
          <EstadoError titulo="No pudimos cargar las categorías" detalle={aApiError(consulta.error).detail} onReintentar={reintentar} />
        ) : (
          <EsqueletoFilas etiqueta="Cargando categorías" filas={4} />
        )
      ) : arbol.length === 0 ? (
        <EstadoVacio icono="categorias" titulo="Todavía no hay categorías" texto="Creá la primera para empezar a ordenar el catálogo. Después vas a poder sumarle subcategorías.">
          <button type="button" className={claseBoton('primario')} data-foco="nueva" onClick={nueva}>
            <Icon name="mas" />
            Nueva categoría
          </button>
        </EstadoVacio>
      ) : (
        <ArbolEditable
          arbol={arbol}
          nuevoId={nuevoId}
          onAgregarSubcategoria={(categoria) => abrirFormulario({ tipo: 'alta', padreId: categoria.id }, `subcategoria-${categoria.id}`)}
          onEditar={(categoria) => abrirFormulario({ tipo: 'edicion', categoria }, `editar-${categoria.id}`)}
          onEliminar={setBaja}
        />
      )}
      {baja !== null && arbol !== undefined ? (
        <DialogoBajaCategoria categoria={baja} arbol={arbol} onCerrar={() => setBaja(null)} onEliminada={terminarBaja} />
      ) : null}
      </div>
    </div>
  );
}
