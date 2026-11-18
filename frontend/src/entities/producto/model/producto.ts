export interface CategoriaDeProducto {
  id: number;
  nombre: string;
  es_principal: boolean;
}

export interface IngredienteProducto {
  id: number;
  nombre: string;
  es_alergeno: boolean;
  es_removible: boolean;
  /** Decimal del backend como string (`"1.000"`). */
  cantidad: string;
  unidad_medida_id: number | null;
}

/** `ProductoReadFull` del backend: los decimales viajan como string. */
export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  unidad_venta_id: number | null;
  /** Decimal con dos decimales (`"1500.00"`). */
  precio_base: string;
  imagenes_url: string[] | null;
  imagenes_public_id: string[] | null;
  stock_cantidad: number;
  disponible: boolean;
  categorias: CategoriaDeProducto[];
  ingredientes: IngredienteProducto[];
}

export type EstadoStock = 'agotado' | 'pocas' | 'normal';

/** Hasta cuántas unidades el catálogo avisa «Quedan N» (decisión del usuario, OQ-4). */
export const UMBRAL_POCAS_UNIDADES = 5;

const REGEX_DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/** «1250.50» → «$ 1.250,50»; «12000.00» → «$ 12.000». Trabaja sobre el string (sin `parseFloat`) para no redondear. */
export function formatearPrecio(decimal: string): string {
  const coincidencia = REGEX_DECIMAL.exec(decimal);
  if (coincidencia === null) return decimal;
  const entero = (coincidencia[1] ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = (coincidencia[2] ?? '').padEnd(2, '0');
  return /^0*$/.test(centavos) ? `$ ${entero}` : `$ ${entero},${centavos}`;
}

export function estadoStock(stock: number): EstadoStock {
  if (stock <= 0) return 'agotado';
  return stock <= UMBRAL_POCAS_UNIDADES ? 'pocas' : 'normal';
}

/** Ingredientes marcados como alérgenos, en el orden del servidor. */
export function alergenos(producto: Pick<Producto, 'ingredientes'>): IngredienteProducto[] {
  return producto.ingredientes.filter((ingrediente) => ingrediente.es_alergeno);
}

/** La categoría `es_principal`; si ninguna lo es, la primera; sin categorías, `null`. */
export function categoriaPrincipal(producto: Pick<Producto, 'categorias'>): CategoriaDeProducto | null {
  return producto.categorias.find((categoria) => categoria.es_principal) ?? producto.categorias[0] ?? null;
}

/** Primera URL de imagen, o `null` si el producto no tiene. */
export function imagenPrincipal(producto: Pick<Producto, 'imagenes_url'>): string | null {
  return producto.imagenes_url?.[0] ?? null;
}

/**
 * Forma que espera el carrito. Se declara acá (y no se importa de `@/entities/cart`) porque una entidad no puede importar
 * otra; el tipo es estructuralmente igual a `ProductoParaCarrito`, así que `agregar` lo acepta sin conversión.
 */
export interface DatosParaCarrito {
  productoId: number;
  nombre: string;
  precioUnitario: string;
  imagenUrl: string | null;
}

export function aProductoParaCarrito(producto: Producto): DatosParaCarrito {
  return {
    productoId: producto.id,
    nombre: producto.nombre,
    precioUnitario: producto.precio_base,
    imagenUrl: imagenPrincipal(producto),
  };
}
