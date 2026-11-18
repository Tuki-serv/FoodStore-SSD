/** Producto que usa un ingrediente (`ProductoBasicRead`). */
export interface ProductoDeIngrediente {
  id: number;
  nombre: string;
}

/**
 * Ingrediente de `GET /ingredientes/` (`IngredienteReadFull`).
 * `unidad_medida_id` es opcional a propósito: el contrato de lectura actual del backend no lo expone (solo lo acepta el alta),
 * así que la UI muestra la unidad cuando llega y funciona sin ella.
 */
export interface Ingrediente {
  id: number;
  nombre: string;
  descripcion: string | null;
  es_alergeno: boolean;
  imagen_url: string | null;
  imagen_public_id: string | null;
  unidad_medida_id?: number | null;
  productos: ProductoDeIngrediente[];
}

/** Cuerpo de `POST /ingredientes/` (`IngredienteCreate`). */
export interface IngredienteDatos {
  nombre: string;
  descripcion: string | null;
  es_alergeno: boolean;
  unidad_medida_id: number;
}

/** Cuerpo de `PATCH /ingredientes/{id}`: solo los campos que cambian. */
export type IngredienteCambios = Partial<IngredienteDatos>;

const MAXIMO_NOMBRES = 3;

/**
 * Aviso de uso de un ingrediente («Lo usan 5 productos: A, B, C y 2 más»): hasta tres nombres y el resto como «y N más».
 * `null` si ningún producto lo usa.
 */
export function resumenUso(productos: readonly ProductoDeIngrediente[]): string | null {
  if (productos.length === 0) return null;
  const nombres = productos.slice(0, MAXIMO_NOMBRES).map((producto) => producto.nombre);
  const restantes = productos.length - nombres.length;
  const lista = restantes > 0 ? `${nombres.join(', ')} y ${restantes} más` : nombres.join(', ');
  const verbo = productos.length === 1 ? 'Lo usa 1 producto' : `Lo usan ${productos.length} productos`;
  return `${verbo}: ${lista}`;
}

/** Lo que se usa de la respuesta del alta (`IngredienteRead`): el id sirve para resaltar la fila nueva. */
export interface IngredienteCreado {
  id: number;
  nombre: string;
}
