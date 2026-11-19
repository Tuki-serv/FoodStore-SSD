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

/** Pedido recibido por un handler de auth: sirve para afirmar cuerpo, tipo de contenido y credencial. */
export interface PedidoAuth {
  /** Cuerpo tal cual llegó (texto). */
  texto: string;
  /** Cuerpo interpretado: JSON, o los pares de un formulario `x-www-form-urlencoded`. */
  cuerpo: unknown;
  contentType: string | null;
  authorization: string | null;
}

/** Lo que responde un handler: se evalúa en cada pedido (puede demorar con `delay`). */
export type RespuestaAuth = () => Response | Promise<Response>;

async function leerPedido(request: Request): Promise<PedidoAuth> {
  const texto = await request.text();
  const contentType = request.headers.get('content-type');
  let cuerpo: unknown = null;
  if (texto !== '') {
    cuerpo = contentType?.includes('application/x-www-form-urlencoded') === true ? Object.fromEntries(new URLSearchParams(texto)) : (JSON.parse(texto) as unknown);
  }
  return { texto, cuerpo, contentType, authorization: request.headers.get('authorization') };
}

function handlerAuth(metodo: 'post' | 'patch', ruta: string, respuesta: RespuestaAuth, registro: PedidoAuth[]) {
  return http[metodo](`${API}${ruta}`, async ({ request }) => {
    registro.push(await leerPedido(request));
    return respuesta();
  });
}

/** `POST /auth/login` (form OAuth2). `registro` recibe cada pedido. */
export const handlerLogin = (respuesta: RespuestaAuth, registro: PedidoAuth[] = []) => handlerAuth('post', '/auth/login', respuesta, registro);
/** `POST /auth/register` (JSON). */
export const handlerRegister = (respuesta: RespuestaAuth, registro: PedidoAuth[] = []) => handlerAuth('post', '/auth/register', respuesta, registro);
/** `PATCH /usuarios/me` (JSON). */
export const handlerPatchPerfil = (respuesta: RespuestaAuth, registro: PedidoAuth[] = []) => handlerAuth('patch', '/usuarios/me', respuesta, registro);
/** `POST /auth/logout` (sin cuerpo). */
export const handlerLogout = (respuesta: RespuestaAuth, registro: PedidoAuth[] = []) => handlerAuth('post', '/auth/logout', respuesta, registro);
/** `POST /auth/logout-all` (sin cuerpo). */
export const handlerLogoutAll = (respuesta: RespuestaAuth, registro: PedidoAuth[] = []) => handlerAuth('post', '/auth/logout-all', respuesta, registro);

/** 200 de login con el access dado. */
export const loginOk = (access = 'A1'): RespuestaAuth => () => HttpResponse.json({ access_token: access, token_type: 'bearer', expires_in: 1800 });

/** `UserPublic` del backend: el usuario sin roles. */
function usuarioPublico(datos: Partial<Omit<UsuarioDto, 'roles'>>): Omit<UsuarioDto, 'roles'> {
  return { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, ...datos };
}

/** 201 de registro: `UserPublic`. */
export const registroOk = (datos: Partial<Omit<UsuarioDto, 'roles'>> = {}): RespuestaAuth => () => HttpResponse.json(usuarioPublico(datos), { status: 201 });

/** 200 del `PATCH /usuarios/me`: `UserPublic` (sin roles). */
export const perfilOk = (datos: Partial<Omit<UsuarioDto, 'roles'>> = {}): RespuestaAuth => () => HttpResponse.json(usuarioPublico(datos));

/** Error con el formato unificado del backend (`detail`, `code`, `field`). */
export const errorApi =
  (status: number, code: string, detail: string, field: string | null = null, headers: Record<string, string> = {}): RespuestaAuth =>
  () =>
    HttpResponse.json({ detail, code, field }, { status, headers });

/** 204 sin cuerpo. */
export const sinContenido: RespuestaAuth = () => new HttpResponse(null, { status: 204 });
