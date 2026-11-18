import type { CategoriaCambios, CategoriaDatos, CategoriaNodo } from '@/entities/categoria';
import { errorDeNombre, textoONulo } from '@/shared/lib';

/** Valores del formulario: siempre texto (`''` = vacío), como los entrega un control; el padre viaja como id en texto. */
export interface ValoresCategoria {
  nombre: string;
  descripcion: string;
  /** Id del padre elegido; `''` = categoría raíz. */
  parent_id: string;
  imagen_url: string;
}

export type CampoCategoria = keyof ValoresCategoria;

export type ErroresCategoria = Partial<Record<CampoCategoria, string>>;

/** Error del nombre (único campo con reglas locales: obligatorio y hasta 100 caracteres), o `undefined`. */
export function validarNombreCategoria(valor: string): string | undefined {
  return errorDeNombre(valor);
}

/** Errores del formulario; vacío si no hay ninguno. Acepta valores parciales (solo valida lo que llega). */
export function validarCategoria(valores: Partial<ValoresCategoria>): ErroresCategoria {
  const nombre = errorDeNombre(valores.nombre);
  return nombre === undefined ? {} : { nombre };
}

/** Cuerpo para el backend: recortado, opcionales vacíos como `null` y `imagen_url` vacía como `''` (obligatoria en la API; D5). */
export function aCuerpoCategoria(valores: ValoresCategoria): CategoriaDatos {
  return {
    nombre: valores.nombre.trim(),
    parent_id: valores.parent_id === '' ? null : Number(valores.parent_id),
    descripcion: textoONulo(valores.descripcion),
    imagen_url: valores.imagen_url.trim(),
  };
}

/** Solo los campos del cuerpo que difieren entre `inicial` y `actual` (ya normalizados); `{}` si no cambió nada. */
export function cambiosCategoria(inicial: ValoresCategoria, actual: ValoresCategoria): CategoriaCambios {
  const antes = aCuerpoCategoria(inicial);
  const despues = aCuerpoCategoria(actual);
  const cambios: CategoriaCambios = {};
  if (antes.nombre !== despues.nombre) cambios.nombre = despues.nombre;
  if (antes.parent_id !== despues.parent_id) cambios.parent_id = despues.parent_id;
  if (antes.descripcion !== despues.descripcion) cambios.descripcion = despues.descripcion;
  if (antes.imagen_url !== despues.imagen_url) cambios.imagen_url = despues.imagen_url;
  return cambios;
}

/** Valores de partida: vacíos (alta, con el padre ya elegido si se agrega una subcategoría) o los de la categoría (edición). */
export function valoresInicialesCategoria(categoria?: CategoriaNodo, padreId?: number): ValoresCategoria {
  if (categoria === undefined) {
    return { nombre: '', descripcion: '', parent_id: padreId === undefined ? '' : String(padreId), imagen_url: '' };
  }
  return {
    nombre: categoria.nombre,
    descripcion: categoria.descripcion ?? '',
    parent_id: categoria.parent_id === null ? '' : String(categoria.parent_id),
    imagen_url: categoria.imagen_url ?? '',
  };
}
