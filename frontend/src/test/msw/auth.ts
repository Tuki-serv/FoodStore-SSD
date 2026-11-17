import { http, HttpResponse } from 'msw';
import { API } from './server';

export interface UsuarioDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  celular: string | null;
  roles: { codigo: string; nombre: string }[];
}

const NOMBRES_ROL: Readonly<Record<string, string>> = {
  CLIENT: 'Cliente',
  PEDIDOS: 'Gestor de pedidos',
  STOCK: 'Gestor de stock',
  ADMIN: 'Administrador',
};

/** Usuario tal como lo devuelve `GET /auth/me`, con los roles dados. */
export function usuarioDto(roles: readonly string[], datos: Partial<Omit<UsuarioDto, 'roles'>> = {}): UsuarioDto {
  return {
    id: 1,
    nombre: 'Ana',
    apellido: 'Gómez',
    email: 'ana@example.com',
    celular: null,
    ...datos,
    roles: roles.map((codigo) => ({ codigo, nombre: NOMBRES_ROL[codigo] ?? codigo })),
  };
}

export const respuestaRefresh = (access: string) => HttpResponse.json({ access_token: access, token_type: 'bearer', expires_in: 1800 });

/** `POST /auth/refresh` responde 200 con `access` (un access nuevo por defecto `A1`). */
export const handlerRefreshOk = (access = 'A1') => http.post(`${API}/auth/refresh`, () => respuestaRefresh(access));

/** `GET /auth/me` responde el usuario con los roles dados. */
export const handlerMe = (roles: readonly string[], datos: Partial<Omit<UsuarioDto, 'roles'>> = {}) =>
  http.get(`${API}/auth/me`, () => HttpResponse.json(usuarioDto(roles, datos)));
