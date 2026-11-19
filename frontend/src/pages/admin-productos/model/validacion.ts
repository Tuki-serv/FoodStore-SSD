import type { Producto, ProductoCambios, ProductoDatos } from '@/entities/producto';
import { textoONulo } from '@/shared/lib';

export const MAXIMO_NOMBRE_PRODUCTO = 150;

/** Una fila de ingrediente del formulario; los ids viajan como texto (valor de un `<select>`). */
export interface IngredienteValores {
  ingrediente_id: string;
  cantidad: string;
  unidad_medida_id: string;
  es_removible: boolean;
}

/** Valores del formulario: texto salvo las casillas y las categorías (ids marcados + la principal). */
export interface ValoresProducto {
  nombre: string;
  descripcion: string;
  precio_base: string;
  stock_cantidad: string;
  disponible: boolean;
  /** Ids marcados, en el orden en que se marcaron. */
  categoria_ids: number[];
  /** Id de la principal entre las marcadas; `null` sin categorías. */
  categoria_principal: number | null;
  ingredientes: IngredienteValores[];
}

export interface ErroresIngrediente {
  ingrediente_id?: string;
  cantidad?: string;
}

export interface ErroresProducto {
  nombre?: string;
  precio_base?: string;
  stock_cantidad?: string;
  categorias?: string;
  /** Por fila (mismo índice que `ValoresProducto.ingredientes`); las filas válidas quedan `undefined`. */
  ingredientes?: (ErroresIngrediente | undefined)[];
}

const MENSAJE_STOCK = 'Ingresá un número entero desde 0.';
const MENSAJE_PRECIO = 'Ingresá un precio desde 0 con hasta 2 decimales.';
const MENSAJE_CANTIDAD = 'Ingresá una cantidad mayor que 0, con hasta 3 decimales.';

/** Acepta la coma decimal: «1500,5» pasa a «1500.5». */
const conPunto = (texto: string): string => texto.trim().replace(',', '.');

/** Error del stock (entero desde 0, sin signo ni decimales), o `undefined`. Sirve para el alta y para cada fila. */
export function validarStock(texto: string): string | undefined {
  return /^\d+$/.test(texto.trim()) ? undefined : MENSAJE_STOCK;
}

export function validarNombreProducto(valor: string): string | undefined {
  const texto = valor.trim();
  if (texto === '') return 'Ingresá un nombre.';
  return texto.length > MAXIMO_NOMBRE_PRODUCTO ? `Máximo ${MAXIMO_NOMBRE_PRODUCTO} caracteres.` : undefined;
}

export function validarPrecio(texto: string): string | undefined {
  return /^\d+(\.\d{1,2})?$/.test(conPunto(texto)) ? undefined : MENSAJE_PRECIO;
}

export function validarCantidad(texto: string): string | undefined {
  const normalizado = conPunto(texto);
  return /^\d+(\.\d{1,3})?$/.test(normalizado) && Number(normalizado) > 0 ? undefined : MENSAJE_CANTIDAD;
}

/** Errores del formulario; `{}` si no hay ninguno. El stock inicial solo se valida en el alta. */
export function validarProducto(valores: ValoresProducto, { alta }: { alta: boolean }): ErroresProducto {
  const errores: ErroresProducto = {};
  const nombre = validarNombreProducto(valores.nombre);
  if (nombre !== undefined) errores.nombre = nombre;
  const precio = validarPrecio(valores.precio_base);
  if (precio !== undefined) errores.precio_base = precio;
  if (alta) {
    const stock = validarStock(valores.stock_cantidad);
    if (stock !== undefined) errores.stock_cantidad = stock;
  }
  if (valores.categoria_ids.length === 0) errores.categorias = 'Elegí al menos una categoría.';

  const vistos = new Set<string>();
  const filas = valores.ingredientes.map((fila): ErroresIngrediente | undefined => {
    const error: ErroresIngrediente = {};
    if (fila.ingrediente_id === '') error.ingrediente_id = 'Elegí un ingrediente.';
    else if (vistos.has(fila.ingrediente_id)) error.ingrediente_id = 'Este ingrediente ya está en la lista.';
    vistos.add(fila.ingrediente_id);
    const cantidad = validarCantidad(fila.cantidad);
    if (cantidad !== undefined) error.cantidad = cantidad;
    return Object.keys(error).length === 0 ? undefined : error;
  });
  if (filas.some((fila) => fila !== undefined)) errores.ingredientes = filas;
  return errores;
}

/** «1500,5» pasa a «1500.50» y «2500» a «2500.00» (decimal como string, sin `Number`). */
function aPrecioDecimal(texto: string): string {
  const [entero = '0', centavos = ''] = conPunto(texto).split('.');
  return `${entero}.${centavos.padEnd(2, '0')}`;
}

/** Principal primero, como espera el backend (la primera categoría queda `es_principal`). */
function categoriasConPrincipalPrimero({ categoria_ids, categoria_principal }: ValoresProducto): number[] {
  if (categoria_principal === null) return [...categoria_ids];
  return [categoria_principal, ...categoria_ids.filter((id) => id !== categoria_principal)];
}

function aIngredientesCuerpo(valores: ValoresProducto): ProductoDatos['ingredientes'] {
  return valores.ingredientes.map((fila) => ({
    ingrediente_id: Number(fila.ingrediente_id),
    cantidad: conPunto(fila.cantidad),
    unidad_medida_id: Number(fila.unidad_medida_id),
    es_removible: fila.es_removible,
  }));
}

/** Cuerpo de `POST /productos/`: recortado, decimales como string y descripción vacía como `null`. */
export function aCuerpoProducto(valores: ValoresProducto): ProductoDatos {
  return {
    nombre: valores.nombre.trim(),
    descripcion: textoONulo(valores.descripcion),
    precio_base: aPrecioDecimal(valores.precio_base),
    stock_cantidad: Number(valores.stock_cantidad),
    disponible: valores.disponible,
    categoria_ids: categoriasConPrincipalPrimero(valores),
    ingredientes: aIngredientesCuerpo(valores),
  };
}

const ordenados = (ids: readonly number[]): string => [...ids].sort((a, b) => a - b).join(',');

/** Huella de la lista de ingredientes sin importar el orden de las filas ni los ceros finales de la cantidad. */
const huellaIngredientes = (lista: ProductoDatos['ingredientes']): string =>
  JSON.stringify(
    [...lista]
      .sort((a, b) => a.ingrediente_id - b.ingrediente_id)
      .map((i) => [i.ingrediente_id, Number(i.cantidad), i.unidad_medida_id, i.es_removible]),
  );

/**
 * Cuerpo de `PUT /productos/{id}`: solo lo que cambió. `categoria_ids` si cambió el conjunto o la principal;
 * `ingredientes` (completa, el backend reemplaza) si cambió algo de la lista. `{}` si no cambió nada.
 */
export function cambiosProducto(inicial: ValoresProducto, actual: ValoresProducto): ProductoCambios {
  const antes = aCuerpoProducto(inicial);
  const despues = aCuerpoProducto(actual);
  const cambios: ProductoCambios = {};
  if (antes.nombre !== despues.nombre) cambios.nombre = despues.nombre;
  if (antes.descripcion !== despues.descripcion) cambios.descripcion = despues.descripcion;
  if (antes.precio_base !== despues.precio_base) cambios.precio_base = despues.precio_base;
  if (antes.categoria_ids[0] !== despues.categoria_ids[0] || ordenados(antes.categoria_ids) !== ordenados(despues.categoria_ids)) {
    cambios.categoria_ids = despues.categoria_ids;
  }
  if (huellaIngredientes(antes.ingredientes) !== huellaIngredientes(despues.ingredientes)) cambios.ingredientes = despues.ingredientes;
  return cambios;
}

/** «2.000» pasa a «2» y «2.500» a «2.5» (el backend devuelve tres decimales; el formulario los muestra sin ceros finales). */
function cantidadParaFormulario(cantidad: string): string {
  return cantidad.includes('.') ? cantidad.replace(/\.?0+$/, '') : cantidad;
}

/** Valores de partida: vacíos (alta; «Disponible» activo) o los del producto (edición, con la principal primero). */
export function valoresInicialesProducto(producto?: Producto): ValoresProducto {
  if (producto === undefined) {
    return {
      nombre: '',
      descripcion: '',
      precio_base: '',
      stock_cantidad: '0',
      disponible: true,
      categoria_ids: [],
      categoria_principal: null,
      ingredientes: [],
    };
  }
  const principal = producto.categorias.find((c) => c.es_principal) ?? producto.categorias[0];
  const ids = producto.categorias.map((c) => c.id).filter((id) => id !== principal?.id);
  return {
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? '',
    precio_base: producto.precio_base,
    stock_cantidad: String(producto.stock_cantidad),
    disponible: producto.disponible,
    categoria_ids: principal === undefined ? ids : [principal.id, ...ids],
    categoria_principal: principal?.id ?? null,
    ingredientes: producto.ingredientes.map((i) => ({
      ingrediente_id: String(i.id),
      cantidad: cantidadParaFormulario(i.cantidad),
      unidad_medida_id: i.unidad_medida_id === null ? '' : String(i.unidad_medida_id),
      es_removible: i.es_removible,
    })),
  };
}
