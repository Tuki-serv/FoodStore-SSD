import { delay, http, HttpResponse } from 'msw';
import { respuestaError } from './admin-catalogo';
import { API } from './server';

export interface RolDto {
  codigo: string;
  nombre: string;
}

/** Usuario tal como lo devuelve `UserPublicAdminPanel` del backend. */
export interface UsuarioAdminDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  celular: string | null;
  roles: RolDto[];
}

/** Pedido recibido: método, ruta relativa a `/api/v1`, cuerpo (JSON o `null`) y query string. */
export interface PedidoUsuarios {
  metodo: string;
  ruta: string;
  cuerpo: unknown;
  busqueda: string;
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Estado en memoria que replica el listado de `/admin/usuarios`; lo mutan los handlers. */
export interface EstadoUsuarios {
  usuarios: UsuarioAdminDto[];
  pedidos: PedidoUsuarios[];
  /** Demora (ms) por método, para ver esqueletos y pedidos en curso. */
  demoras: Partial<Record<Metodo, number>>;
}

const NOMBRES_ROL: Readonly<Record<string, string>> = {
  ADMIN: 'Administrador',
  STOCK: 'Gestor de stock',
  PEDIDOS: 'Gestor de pedidos',
  CLIENT: 'Cliente',
};

/** Roles válidos del backend sembrado (`COCINA` no existe → 400). */
const CODIGOS_VALIDOS = Object.keys(NOMBRES_ROL);

export const rolesDto = (codigos: readonly string[]): RolDto[] => codigos.map((codigo) => ({ codigo, nombre: NOMBRES_ROL[codigo] ?? codigo }));

export const usuarioAdminDto = (id: number, nombre: string, apellido: string, roles: readonly string[], celular: string | null = null): UsuarioAdminDto => ({
  id,
  nombre,
  apellido,
  email: `${nombre.toLowerCase()}.${apellido.toLowerCase()}@example.com`,
  celular,
  roles: rolesDto(roles),
});

/** Ana (id 1) es la sesión de prueba de `renderApp`: aparece primero, con ADMIN y CLIENT. */
export const usuariosSeed: UsuarioAdminDto[] = [
  { ...usuarioAdminDto(1, 'Ana', 'Gómez', ['ADMIN', 'CLIENT'], '+54 9 11 5555-0101'), email: 'ana@example.com' },
  { ...usuarioAdminDto(2, 'Carla', 'Gómez', ['PEDIDOS', 'STOCK']), email: 'carla@example.com' },
  usuarioAdminDto(3, 'Diego', 'Fernández', ['STOCK'], '+54 9 351 555-0142'),
  usuarioAdminDto(4, 'Lucía', 'Martínez', ['CLIENT'], '+54 9 261 555-0177'),
  usuarioAdminDto(5, 'Marcos', 'Peralta', ['ADMIN', 'PEDIDOS']),
];

export function crearEstadoUsuarios(iniciales: readonly UsuarioAdminDto[] = usuariosSeed): EstadoUsuarios {
  return { usuarios: iniciales.map((u) => ({ ...u, roles: [...u.roles] })), pedidos: [], demoras: {} };
}

/** Pedidos registrados de un método y ruta (relativa a `/api/v1`). */
export function pedidosUsuarios(estado: EstadoUsuarios, metodo: string, ruta: string): PedidoUsuarios[] {
  return estado.pedidos.filter((pedido) => pedido.metodo === metodo && pedido.ruta === ruta);
}

/** Pedidos que escriben (POST/PATCH/DELETE). */
export const escriturasUsuarios = (estado: EstadoUsuarios): PedidoUsuarios[] => estado.pedidos.filter((pedido) => pedido.metodo !== 'GET');

interface CuerpoUsuario {
  nombre?: string;
  apellido?: string;
  email?: string;
  celular?: string | null;
  roles_codigos?: string[];
}

/**
 * `/admin/usuarios` con las reglas del backend que la UI ve: filtro por un rol (desconocido → 400), email repetido en el alta
 * (409 sin `field`), rol inexistente (400), 404 de un usuario ya desactivado y 204 en la baja. Las protecciones de propia cuenta y
 * de último administrador se inyectan por test con `server.use` y `respuestaError`.
 */
export function handlersUsuarios(estado: EstadoUsuarios) {
  const registrar = async (request: Request, cuerpo: unknown): Promise<void> => {
    const url = new URL(request.url);
    estado.pedidos.push({ metodo: request.method, ruta: url.pathname.replace(/^\/api\/v1/, ''), cuerpo, busqueda: url.search });
    const demora = estado.demoras[request.method as Metodo];
    if (demora !== undefined) await delay(demora);
  };
  const noActivo = () => respuestaError(404, 'HTTP_404', 'Usuario no encontrado');
  const rolInvalido = (codigos: readonly string[]) => codigos.some((codigo) => !CODIGOS_VALIDOS.includes(codigo));
  const rolInexistente = () => respuestaError(400, 'HTTP_400', 'Uno o más roles no existen');

  return [
    http.get(`${API}/admin/usuarios/`, async ({ request }) => {
      await registrar(request, null);
      const parametros = new URL(request.url).searchParams;
      const page = Number(parametros.get('page') ?? '1');
      const size = Number(parametros.get('size') ?? '20');
      const rol = parametros.get('rol_codigo');
      if (rol !== null && !CODIGOS_VALIDOS.includes(rol)) return respuestaError(400, 'HTTP_400', `El rol '${rol}' no existe`);
      const filtrados = estado.usuarios.filter((u) => rol === null || u.roles.some((r) => r.codigo === rol));
      return HttpResponse.json({ items: filtrados.slice((page - 1) * size, page * size), total: filtrados.length, page, size, pages: Math.ceil(filtrados.length / size) });
    }),
    http.post(`${API}/admin/usuarios/createUser`, async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoUsuario;
      await registrar(request, cuerpo);
      if (estado.usuarios.some((u) => u.email.toLowerCase() === (cuerpo.email ?? '').trim().toLowerCase())) {
        return respuestaError(409, 'HTTP_409', 'El email ya está registrado');
      }
      if (rolInvalido(cuerpo.roles_codigos ?? [])) return rolInexistente();
      const nuevo: UsuarioAdminDto = {
        id: estado.usuarios.reduce((maximo, u) => Math.max(maximo, u.id), 0) + 1,
        nombre: cuerpo.nombre ?? '',
        apellido: cuerpo.apellido ?? '',
        email: (cuerpo.email ?? '').trim().toLowerCase(),
        celular: cuerpo.celular ?? null,
        roles: rolesDto(cuerpo.roles_codigos ?? []),
      };
      estado.usuarios.push(nuevo);
      return HttpResponse.json(nuevo, { status: 201 });
    }),
    http.patch(`${API}/admin/usuarios/:id`, async ({ request, params }) => {
      const cuerpo = (await request.json()) as CuerpoUsuario;
      await registrar(request, cuerpo);
      const objetivo = estado.usuarios.find((u) => u.id === Number(params.id));
      if (objetivo === undefined) return noActivo();
      if (rolInvalido(cuerpo.roles_codigos ?? [])) return rolInexistente();
      const { roles_codigos: roles, ...datos } = cuerpo;
      Object.assign(objetivo, datos);
      if (roles !== undefined) objetivo.roles = rolesDto(roles);
      return HttpResponse.json(objetivo);
    }),
    http.delete(`${API}/admin/usuarios/:id`, async ({ request, params }) => {
      await registrar(request, null);
      const id = Number(params.id);
      if (!estado.usuarios.some((u) => u.id === id)) return noActivo();
      estado.usuarios = estado.usuarios.filter((u) => u.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
