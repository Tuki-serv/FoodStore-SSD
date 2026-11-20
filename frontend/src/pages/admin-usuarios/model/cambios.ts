import type { CambiosUsuario } from '@/entities/usuario';
import { textoONulo } from '@/shared/lib';
import { codigosOrdenados, type ValoresUsuario } from './valores-usuario';

/** Solo los campos que difieren entre `inicial` y `actual` (ya normalizados); los roles, como la lista completa; `{}` si no cambió nada. */
export function cambiosUsuario(inicial: ValoresUsuario, actual: ValoresUsuario): CambiosUsuario {
  const cambios: CambiosUsuario = {};
  if (inicial.nombre.trim() !== actual.nombre.trim()) cambios.nombre = actual.nombre.trim();
  if (inicial.apellido.trim() !== actual.apellido.trim()) cambios.apellido = actual.apellido.trim();
  if (textoONulo(inicial.celular) !== textoONulo(actual.celular)) cambios.celular = textoONulo(actual.celular);
  const rolesAntes = codigosOrdenados(inicial.roles);
  const rolesDespues = codigosOrdenados(actual.roles);
  if (rolesAntes.join(',') !== rolesDespues.join(',')) cambios.roles_codigos = rolesDespues;
  return cambios;
}
