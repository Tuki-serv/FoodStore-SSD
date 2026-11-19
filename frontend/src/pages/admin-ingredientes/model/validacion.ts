import type { Ingrediente, IngredienteCambios, IngredienteDatos } from '@/entities/ingrediente';
import { errorDeNombre, textoONulo } from '@/shared/lib';

/** Valores del formulario; la unidad viaja como id en texto (valor de un `<select>`). */
export interface ValoresIngrediente {
  nombre: string;
  descripcion: string;
  unidad_medida_id: string;
  es_alergeno: boolean;
}

export type CampoIngrediente = keyof ValoresIngrediente;

export type ErroresIngrediente = Partial<Record<CampoIngrediente, string>>;

/** Error del nombre (obligatorio, hasta 100 caracteres), o `undefined`. */
export function validarNombreIngrediente(valor: string): string | undefined {
  return errorDeNombre(valor);
}

/** Errores del formulario; vacío si no hay ninguno. Acepta valores parciales (solo valida lo que llega). */
export function validarIngrediente(valores: Partial<ValoresIngrediente>): ErroresIngrediente {
  const nombre = errorDeNombre(valores.nombre);
  return nombre === undefined ? {} : { nombre };
}

/** Cuerpo para el backend: recortado y descripción vacía como `null`. */
export function aCuerpoIngrediente(valores: ValoresIngrediente): IngredienteDatos {
  return {
    nombre: valores.nombre.trim(),
    descripcion: textoONulo(valores.descripcion),
    es_alergeno: valores.es_alergeno,
    unidad_medida_id: Number(valores.unidad_medida_id),
  };
}

/** Solo los campos del cuerpo que difieren entre `inicial` y `actual` (ya normalizados); `{}` si no cambió nada. */
export function cambiosIngrediente(inicial: ValoresIngrediente, actual: ValoresIngrediente): IngredienteCambios {
  const antes = aCuerpoIngrediente(inicial);
  const despues = aCuerpoIngrediente(actual);
  const cambios: IngredienteCambios = {};
  if (antes.nombre !== despues.nombre) cambios.nombre = despues.nombre;
  if (antes.descripcion !== despues.descripcion) cambios.descripcion = despues.descripcion;
  if (antes.es_alergeno !== despues.es_alergeno) cambios.es_alergeno = despues.es_alergeno;
  if (antes.unidad_medida_id !== despues.unidad_medida_id) cambios.unidad_medida_id = despues.unidad_medida_id;
  return cambios;
}

/** Valores de partida: vacíos con la unidad por defecto (alta) o los del ingrediente (edición, con su unidad actual). */
export function valoresInicialesIngrediente(unidadPorDefecto: string, ingrediente?: Ingrediente): ValoresIngrediente {
  if (ingrediente === undefined) return { nombre: '', descripcion: '', unidad_medida_id: unidadPorDefecto, es_alergeno: false };
  return {
    nombre: ingrediente.nombre,
    descripcion: ingrediente.descripcion ?? '',
    unidad_medida_id: String(ingrediente.unidad_medida_id),
    es_alergeno: ingrediente.es_alergeno,
  };
}
