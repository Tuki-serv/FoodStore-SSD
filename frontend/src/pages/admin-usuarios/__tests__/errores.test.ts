import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { clasificarErrorUsuario } from '../model';

const error = (status: number | null, code: string, detail: string, field: string | null = null) => new ApiError({ status, code, detail, field });

describe('clasificarErrorUsuario', () => {
  it('un 409 del alta es el email repetido y se muestra en su campo', () => {
    expect(clasificarErrorUsuario(error(409, 'HTTP_409', 'El email ya está registrado'), 'alta')).toEqual({
      tipo: 'campo',
      campo: 'email',
      mensaje: 'Ya existe un usuario con ese email.',
    });
  });

  it('un 422 con field conocido va a ese campo con el texto del servidor', () => {
    expect(clasificarErrorUsuario(error(422, 'VALIDATION_ERROR', 'Debe tener al menos 8 caracteres', 'password'), 'alta')).toEqual({
      tipo: 'campo',
      campo: 'password',
      mensaje: 'Debe tener al menos 8 caracteres',
    });
    expect(clasificarErrorUsuario(error(422, 'VALIDATION_ERROR', 'Lista vacía', 'roles_codigos'), 'edicion')).toEqual({ tipo: 'campo', campo: 'roles', mensaje: 'Lista vacía' });
  });

  it('un 422 con field desconocido o sin field es un error general', () => {
    expect(clasificarErrorUsuario(error(422, 'VALIDATION_ERROR', 'Dato inválido', 'otro'), 'alta')).toEqual({ tipo: 'general', mensaje: 'Dato inválido' });
    expect(clasificarErrorUsuario(error(422, 'VALIDATION_ERROR', 'Dato inválido'), 'edicion')).toEqual({ tipo: 'general', mensaje: 'Dato inválido' });
  });

  it('SELF_ACTION_NOT_ALLOWED explica según la operación: quitarse el rol o desactivarse', () => {
    const self = error(409, 'SELF_ACTION_NOT_ALLOWED', 'texto del servidor');

    expect(clasificarErrorUsuario(self, 'edicion')).toEqual({ tipo: 'general', mensaje: 'No podés quitarte tu propio rol de administrador.' });
    expect(clasificarErrorUsuario(self, 'baja')).toEqual({ tipo: 'general', mensaje: 'No podés desactivar tu propia cuenta.' });
  });

  it('LAST_ADMIN muestra la explicación del último administrador en edición y en baja', () => {
    const ultimo = error(409, 'LAST_ADMIN', 'otro texto');

    expect(clasificarErrorUsuario(ultimo, 'edicion')).toEqual({ tipo: 'general', mensaje: 'Tiene que quedar al menos un administrador activo.' });
    expect(clasificarErrorUsuario(ultimo, 'baja')).toEqual({ tipo: 'general', mensaje: 'Tiene que quedar al menos un administrador activo.' });
  });

  it('un 409 de edición con otro código no es el email repetido: usa el detalle', () => {
    expect(clasificarErrorUsuario(error(409, 'HTTP_409', 'Conflicto'), 'edicion')).toEqual({ tipo: 'general', mensaje: 'Conflicto' });
  });

  it('un 400 (rol inválido) es un error general con el detalle del servidor', () => {
    expect(clasificarErrorUsuario(error(400, 'HTTP_400', 'Uno o más roles no existen'), 'alta')).toEqual({ tipo: 'general', mensaje: 'Uno o más roles no existen' });
  });

  it('sin respuesta del servidor es un error de conexión', () => {
    expect(clasificarErrorUsuario(error(null, 'NETWORK_ERROR', 'No pudimos conectar con el servidor.'), 'alta')).toEqual({
      tipo: 'conexion',
      mensaje: 'No pudimos conectar con el servidor.',
    });
  });

  it('un 404 de edición o baja es «ya no estaba activo»', () => {
    expect(clasificarErrorUsuario(error(404, 'HTTP_404', 'Usuario no encontrado'), 'edicion')).toEqual({ tipo: 'ya-no-activo' });
    expect(clasificarErrorUsuario(error(404, 'HTTP_404', 'Usuario no encontrado'), 'baja')).toEqual({ tipo: 'ya-no-activo' });
  });

  it('un 500 es un error general con el detalle', () => {
    expect(clasificarErrorUsuario(error(500, 'HTTP_500', 'Ocurrió un error inesperado. Probá de nuevo.'), 'baja')).toEqual({
      tipo: 'general',
      mensaje: 'Ocurrió un error inesperado. Probá de nuevo.',
    });
  });
});
