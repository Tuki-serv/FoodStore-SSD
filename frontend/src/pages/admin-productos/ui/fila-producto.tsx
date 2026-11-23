import { useId, useState, type FormEvent } from 'react';
import {
  alergenos,
  categoriaPrincipal,
  formatearPrecio,
  MarcaStock,
  useFijarDisponibilidad,
  useFijarStock,
  type Producto,
} from '@/entities/producto';
import { aApiError } from '@/shared/api';
import { avisarError, avisarExito } from '@/shared/model';
import { claseBoton, Icon } from '@/shared/ui';
import { validarStock, type AccionesProductos } from '../model';

export interface FilaProductoProps {
  producto: Producto;
  acciones: AccionesProductos;
  /** Producto recién creado: la fila se resalta un momento. */
  esNuevo: boolean;
  onEditar: (producto: Producto) => void;
  onEliminar: (producto: Producto) => void;
}

/** «Hamburguesas · Veganas · 5 ingredientes»: principal primero, el resto de categorías y la cantidad de ingredientes. */
function detalleDeProducto(producto: Producto): string {
  const principal = categoriaPrincipal(producto);
  const otras = producto.categorias.filter((c) => c.id !== principal?.id).map((c) => c.nombre);
  const cantidad = producto.ingredientes.length;
  const ingredientes = cantidad === 0 ? 'sin ingredientes' : `${cantidad} ${cantidad === 1 ? 'ingrediente' : 'ingredientes'}`;
  return [principal?.nombre, ...otras, ingredientes].filter((parte) => parte !== undefined).join(' · ');
}

/** Fila de un producto: datos, stock con «Guardar» (absoluto), interruptor «Disponible» (no optimista) y acciones de ADMIN. */
export function FilaProducto({ producto, acciones, esNuevo, onEditar, onEliminar }: FilaProductoProps) {
  const idStock = useId();
  const fijarStock = useFijarStock();
  const fijarDisponibilidad = useFijarDisponibilidad();
  // Lo escrito se anota contra el stock del servidor con el que se escribió: si el servidor informa otro, el campo lo muestra.
  const [escrito, setEscrito] = useState<{ base: number; texto: string } | null>(null);
  const valor = escrito !== null && escrito.base === producto.stock_cantidad ? escrito.texto : String(producto.stock_cantidad);
  const [errorStock, setErrorStock] = useState<string | null>(null);
  const cambiado = valor.trim() !== String(producto.stock_cantidad);
  const cantidadAlergenos = alergenos(producto).length;

  const guardarStock = async (evento: FormEvent): Promise<void> => {
    evento.preventDefault();
    const error = validarStock(valor);
    setErrorStock(error ?? null);
    if (error !== undefined || !cambiado) return;
    try {
      const actualizado = await fijarStock.mutateAsync({ id: producto.id, stock: Number(valor) });
      avisarExito('Stock actualizado', `«${producto.nombre}» · ${actualizado.stock_cantidad} ${actualizado.stock_cantidad === 1 ? 'unidad' : 'unidades'}`);
    } catch (fallo) {
      setErrorStock(aApiError(fallo).detail);
    }
  };

  const cambiarDisponibilidad = async (disponible: boolean): Promise<void> => {
    try {
      await fijarDisponibilidad.mutateAsync({ id: producto.id, disponible });
      avisarExito(disponible ? `${producto.nombre} vuelve a ofrecerse en el catálogo` : `${producto.nombre} ya no se ofrece en el catálogo`);
    } catch (fallo) {
      avisarError('No pudimos cambiar la disponibilidad', aApiError(fallo).detail);
    }
  };

  const guardando = fijarStock.isPending;
  const ocupado = fijarDisponibilidad.isPending;
  const idError = `${idStock}-error`;
  const clase = ['prow', acciones.gestionar ? '' : 'prow-stock', producto.disponible ? '' : 'is-off', esNuevo ? 'is-new' : ''].filter(Boolean).join(' ');

  return (
    <div className={clase} role="group" aria-label={producto.nombre}>
      <div className="pname">
        <div className="iname-top">
          <strong>{producto.nombre}</strong>
          {esNuevo ? <span className="meta-txt">Nuevo</span> : null}
          {cantidadAlergenos === 0 ? null : (
            <span className="al">
              <Icon name="alergeno" />
              {cantidadAlergenos} {cantidadAlergenos === 1 ? 'alérgeno' : 'alérgenos'}
            </span>
          )}
        </div>
        <small>{detalleDeProducto(producto)}</small>
      </div>
      <div className="pprice">{formatearPrecio(producto.precio_base)}</div>
      <div className="pstock">
        <label className="sr-only" htmlFor={idStock}>
          Stock de {producto.nombre}
        </label>
        <span className="stock-tag" aria-hidden="true">
          Stock
        </span>
        <form className="stock-edit" noValidate onSubmit={(evento) => void guardarStock(evento)}>
          <input
            id={idStock}
            className="input input-sm"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={valor}
            disabled={guardando}
            {...(errorStock === null ? {} : { 'aria-invalid': true, 'aria-describedby': idError })}
            onChange={(evento) => {
              setEscrito({ base: producto.stock_cantidad, texto: evento.target.value });
              setErrorStock(null);
            }}
          />
          <button
            type="submit"
            className={claseBoton(cambiado ? 'primario' : 'secundario', { compacto: true })}
            aria-label={`Guardar stock de ${producto.nombre}`}
            disabled={!cambiado || guardando}
          >
            <Icon name="guardar" />
            <span className="lbl">{guardando ? 'Guardando…' : 'Guardar'}</span>
          </button>
        </form>
        {errorStock === null ? (
          <span className="pmark">
            <MarcaStock stock={producto.stock_cantidad} />
          </span>
        ) : (
          <span className="err" id={idError}>
            {errorStock}
          </span>
        )}
      </div>
      <div className="pdisp">
        <label className={ocupado ? 'switch is-busy' : 'switch'}>
          <input
            type="checkbox"
            role="switch"
            checked={producto.disponible}
            disabled={ocupado}
            aria-label={`Disponible: ${producto.nombre}`}
            onChange={(evento) => void cambiarDisponibilidad(evento.target.checked)}
          />
          <span>{ocupado ? 'Guardando…' : producto.disponible ? 'Disponible' : 'No disponible'}</span>
        </label>
      </div>
      {acciones.gestionar ? (
        <div className="crow-actions">
          <button type="button" className={claseBoton('fantasma', { compacto: true })} aria-label={`Editar ${producto.nombre}`} data-foco={`editar-${producto.id}`} onClick={() => onEditar(producto)}>
            <Icon name="editar" />
            <span className="lbl">Editar</span>
          </button>
          <button type="button" className={claseBoton('fantasmaPeligro', { compacto: true })} aria-label={`Eliminar ${producto.nombre}`} onClick={() => onEliminar(producto)}>
            <Icon name="basura" />
            <span className="lbl">Eliminar</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
