import type { ItemPedidoCrear } from './pedido';

/** Forma mínima de una línea del carrito (las entidades no se importan entre sí: la página pasa las líneas del carrito). */
export interface LineaParaPedido {
  productoId: number;
  cantidad: number;
  personalizacion: readonly number[];
}

/** Items del cuerpo de `POST /pedidos/`: una por línea, en el mismo orden, con los ids excluidos ordenados (`[]` si no hay). */
export function itemsDesdeCarrito(lineas: readonly LineaParaPedido[]): ItemPedidoCrear[] {
  return lineas.map((linea) => ({
    producto_id: linea.productoId,
    cantidad: linea.cantidad,
    personalizacion: [...linea.personalizacion].sort((a, b) => a - b),
  }));
}
