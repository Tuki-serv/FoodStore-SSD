import { errorDeCelular, errorDeNombrePersona, esEmailValido } from '@/shared/lib';

/** Campos de texto del formulario de usuario (los roles se validan aparte). */
export type CampoTextoUsuario = 'nombre' | 'apellido' | 'email' | 'celular' | 'password';

/** Campos que el servidor puede nombrar en un error: los de texto y los roles. */
export type CampoUsuario = CampoTextoUsuario | 'roles';

const MINIMO_PASSWORD = 8;

/** Error de un campo de texto (o `undefined` si es válido). Reusa las reglas de persona y email de C-14. */
export function validarCampoUsuario(campo: CampoTextoUsuario, valor: string): string | undefined {
  switch (campo) {
    case 'nombre':
      return errorDeNombrePersona(valor, 'Ingresá el nombre');
    case 'apellido':
      return errorDeNombrePersona(valor, 'Ingresá el apellido');
    case 'email':
      return esEmailValido(valor) ? undefined : 'Ingresá un email válido';
    case 'celular':
      return errorDeCelular(valor);
    case 'password':
      return valor.length < MINIMO_PASSWORD ? `Usá al menos ${MINIMO_PASSWORD} caracteres` : undefined;
  }
}

/** Error de la lista de roles: al menos uno. */
export function validarRolesUsuario(roles: readonly string[]): string | undefined {
  return roles.length === 0 ? 'Elegí al menos un rol.' : undefined;
}
