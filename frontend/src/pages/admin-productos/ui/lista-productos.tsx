import type { Producto } from '@/entities/producto';
import type { AccionesProductos } from '../model';
import { FilaProducto } from './fila-producto';

export interface ListaProductosProps {
  productos: readonly Producto[];
  acciones: AccionesProductos;
  nuevoId: number | null;
  onEditar: (producto: Producto) => void;
  onEliminar: (producto: Producto) => void;
}

/** Listado de gestión: encabezado de columnas (solo desktop) y una fila por producto. */
export function ListaProductos({ productos, acciones, nuevoId, onEditar, onEliminar }: ListaProductosProps) {
  return (
    <ul className="plist" aria-label="Productos">
      <li className={acciones.gestionar ? 'prow phead' : 'prow prow-stock phead'} aria-hidden="true">
        <span>Producto</span>
        <span>Precio</span>
        <span>Stock</span>
        <span>Disponibilidad</span>
        {acciones.gestionar ? <span /> : null}
      </li>
      {productos.map((producto) => (
        <li key={producto.id}>
          <FilaProducto producto={producto} acciones={acciones} esNuevo={producto.id === nuevoId} onEditar={onEditar} onEliminar={onEliminar} />
        </li>
      ))}
    </ul>
  );
}
