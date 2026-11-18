import { useState } from 'react';
import { Link } from 'react-router-dom';
import { buscarCategoria, contarDescendientes, useEliminarCategoria, type CategoriaNodo } from '@/entities/categoria';
import { esApiError, type ApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { avisarExito } from '@/shared/model';
import { claseBoton, DialogoBaja } from '@/shared/ui';

export interface DialogoBajaCategoriaProps {
  categoria: CategoriaNodo;
  /** Árbol cargado (vivo): decide si hay subcategorías y se actualiza si el servidor avisa que cambió. */
  arbol: readonly CategoriaNodo[];
  onCerrar: () => void;
  /** La baja salió bien (el diálogo ya puede desmontarse). */
  onEliminada: () => void;
}

const DESCRIPCION = 'Deja de verse en el catálogo. Podés volver a crear una con el mismo nombre más adelante.';

function avisoDeError(error: ApiError) {
  if (error.code === 'CATEGORY_HAS_PRODUCTS') {
    return { titulo: 'No se puede eliminar: tiene productos activos', detalle: 'Quitalos de la categoría desde Productos y stock y volvé a intentarlo.', peligro: true };
  }
  if (error.code === 'CATEGORY_HAS_CHILDREN') {
    return { titulo: 'No se puede eliminar: tiene subcategorías activas', detalle: 'Movelas a otra categoría o eliminalas primero. Ya actualizamos el árbol.', peligro: true };
  }
  return { titulo: 'No pudimos eliminar la categoría', detalle: error.detail, peligro: true };
}

/** Baja de una categoría (design D6): confirmación, bloqueo si hay subcategorías y rechazos del servidor dentro del diálogo. */
export function DialogoBajaCategoria({ categoria, arbol, onCerrar, onEliminada }: DialogoBajaCategoriaProps) {
  const eliminar = useEliminarCategoria();
  const [error, setError] = useState<ApiError | null>(null);
  const hijas = buscarCategoria(arbol, categoria.id)?.subcategorias ?? [];
  const cantidad = contarDescendientes(arbol, categoria.id);

  const confirmar = async (): Promise<void> => {
    setError(null);
    try {
      await eliminar.mutateAsync(categoria.id);
    } catch (fallo) {
      if (!esApiError(fallo)) throw fallo;
      setError(fallo);
      return;
    }
    avisarExito('Categoría eliminada', `«${categoria.nombre}»`);
    onEliminada();
  };

  if (error !== null) {
    const bloqueada = error.code === 'CATEGORY_HAS_PRODUCTS' || error.code === 'CATEGORY_HAS_CHILDREN';
    return (
      <DialogoBaja
        titulo={`¿Eliminar «${categoria.nombre}»?`}
        descripcion={DESCRIPCION}
        aviso={avisoDeError(error)}
        pendiente={eliminar.isPending}
        onConfirmar={() => void confirmar()}
        onCerrar={onCerrar}
        {...(bloqueada
          ? {
              acciones: (
                <>
                  <button type="button" className={claseBoton('fantasma')} data-autofocus onClick={onCerrar}>
                    Cerrar
                  </button>
                  {error.code === 'CATEGORY_HAS_PRODUCTS' ? (
                    <Link className={claseBoton('secundario')} to={RUTAS.adminProductos}>
                      Ir a Productos y stock
                    </Link>
                  ) : null}
                </>
              ),
            }
          : {})}
      />
    );
  }

  if (cantidad > 0) {
    return (
      <DialogoBaja
        titulo={`No podés eliminar «${categoria.nombre}» todavía`}
        aviso={{
          titulo: `Tiene ${cantidad} ${cantidad === 1 ? 'subcategoría activa' : 'subcategorías activas'}`,
          detalle: 'Movelas a otra categoría (con «Editar») o eliminalas primero.',
        }}
        lista={hijas.map((hija) => hija.nombre)}
        onConfirmar={onCerrar}
        onCerrar={onCerrar}
        acciones={
          <button type="button" className={claseBoton('primario')} data-autofocus onClick={onCerrar}>
            Entendido
          </button>
        }
      />
    );
  }

  return (
    <DialogoBaja
      titulo={`¿Eliminar «${categoria.nombre}»?`}
      descripcion={DESCRIPCION}
      pendiente={eliminar.isPending}
      onConfirmar={() => void confirmar()}
      onCerrar={onCerrar}
    />
  );
}
