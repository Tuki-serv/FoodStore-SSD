import { delay, http, HttpResponse } from 'msw';
import type { CategoriaNodoDto } from './catalogo';
import { API } from './server';

/** Categoría plana (`CategoriaRead`) tal como la guarda el backend. */
export interface CategoriaDto {
  id: number;
  parent_id: number | null;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  imagen_public_id: string | null;
}

export interface UnidadMedidaDto {
  id: number;
  nombre: string;
  simbolo: string;
  tipo: string;
}

export interface IngredienteDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  es_alergeno: boolean;
  imagen_url: string | null;
  imagen_public_id: string | null;
  unidad_medida_id: number;
  productos: { id: number; nombre: string }[];
}

/** Pedido recibido: ruta relativa a `/api/v1`, cuerpo (JSON o `null`) y query string. */
export interface PedidoAdmin {
  metodo: string;
  ruta: string;
  cuerpo: unknown;
  busqueda: string;
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Estado en memoria que replica al backend (`categorias`, `ingredientes` y `unidades-medida`); lo muta cada handler. */
export interface EstadoAdminCatalogo {
  categorias: CategoriaDto[];
  ingredientes: IngredienteDto[];
  unidades: UnidadMedidaDto[];
  /** Ids de categorías con productos activos: `DELETE` responde 409 `CATEGORY_HAS_PRODUCTS`. */
  categoriasConProductos: Set<number>;
  pedidos: PedidoAdmin[];
  /** Demora (ms) por método, para ver estados de carga y pedidos en curso. */
  demoras: Partial<Record<Metodo, number>>;
}

const categoria = (id: number, nombre: string, parent_id: number | null, descripcion: string | null): CategoriaDto => ({
  id,
  parent_id,
  nombre,
  descripcion,
  imagen_url: null,
  imagen_public_id: null,
});

/** Las seis categorías del seed del backend. */
export const categoriasSeed: CategoriaDto[] = [
  categoria(1, 'Hamburguesas', null, 'Nuestras burgers artesanales'),
  categoria(2, 'Bebidas', null, 'Frías y calientes'),
  categoria(3, 'Postres', null, 'Para cerrar con dulzura'),
  categoria(4, 'Veganas', 1, '100% plant-based'),
  categoria(5, 'Sin TACC', 1, 'Libres de gluten'),
  categoria(6, 'Gaseosas', 2, 'Bebidas con gas'),
];

/** Las siete unidades del seed (la «u» es la 5, no la 1). */
export const unidadesSeed: UnidadMedidaDto[] = [
  { id: 1, nombre: 'Kilogramo', simbolo: 'kg', tipo: 'peso' },
  { id: 2, nombre: 'Gramo', simbolo: 'g', tipo: 'peso' },
  { id: 3, nombre: 'Litro', simbolo: 'L', tipo: 'volumen' },
  { id: 4, nombre: 'Mililitro', simbolo: 'mL', tipo: 'volumen' },
  { id: 5, nombre: 'Unidad', simbolo: 'u', tipo: 'unidad' },
  { id: 6, nombre: 'Docena', simbolo: 'doc', tipo: 'unidad' },
  { id: 7, nombre: 'Metro cuadrado', simbolo: 'm²', tipo: 'superficie' },
];

const CLASICA = { id: 1, nombre: 'Hamburguesa Clásica' };
const BBQ = { id: 2, nombre: 'Burger BBQ Bacon' };
const VEGANA = { id: 3, nombre: 'Burger Vegana' };
const TACC = { id: 4, nombre: 'Burger Sin TACC' };

const ingrediente = (id: number, nombre: string, descripcion: string, es_alergeno: boolean, productos: IngredienteDto['productos']): IngredienteDto => ({
  id,
  nombre,
  descripcion,
  es_alergeno,
  imagen_url: null,
  imagen_public_id: null,
  unidad_medida_id: 5,
  productos,
});

/** Los doce ingredientes del seed (todos en «u»), con los productos que los usan. */
export const ingredientesSeed: IngredienteDto[] = [
  ingrediente(1, 'Pan Brioche', 'Pan suave y esponjoso', true, [CLASICA, BBQ, VEGANA]),
  ingrediente(2, 'Pan Sin TACC', 'Pan libre de gluten', false, [TACC]),
  ingrediente(3, 'Carne Vacuna 250g', 'Medallón de res premium', false, [CLASICA, BBQ, TACC]),
  ingrediente(4, 'Medallón Vegano', 'Base de legumbres y avena', false, [VEGANA]),
  ingrediente(5, 'Queso Cheddar', 'Cheddar fundido americano', true, [CLASICA, BBQ, TACC]),
  ingrediente(6, 'Queso Vegano', 'Alternativa plant-based', false, [VEGANA]),
  ingrediente(7, 'Lechuga', 'Lechuga fresca', false, [CLASICA, VEGANA, TACC]),
  ingrediente(8, 'Tomate', 'Tomate perita en rodajas', false, [CLASICA, VEGANA, TACC]),
  ingrediente(9, 'Cebolla Caramelizada', 'Cebolla dulce', false, [BBQ]),
  ingrediente(10, 'Bacon Crocante', 'Panceta ahumada', false, [BBQ]),
  ingrediente(11, 'Salsa BBQ', 'Salsa ahumada casera', false, [BBQ]),
  ingrediente(12, 'Mayonesa', 'Mayo artesanal', true, [CLASICA]),
];

export function crearEstadoAdminCatalogo(
  iniciales: { categorias?: CategoriaDto[]; ingredientes?: IngredienteDto[]; unidades?: UnidadMedidaDto[] } = {},
): EstadoAdminCatalogo {
  return {
    categorias: (iniciales.categorias ?? categoriasSeed).map((c) => ({ ...c })),
    ingredientes: (iniciales.ingredientes ?? ingredientesSeed).map((i) => ({ ...i, productos: [...i.productos] })),
    unidades: (iniciales.unidades ?? unidadesSeed).map((u) => ({ ...u })),
    categoriasConProductos: new Set(),
    pedidos: [],
    demoras: {},
  };
}

/** Pedidos registrados de un método y ruta (relativa a `/api/v1`). */
export function pedidosAdmin(estado: EstadoAdminCatalogo, metodo: string, ruta: string): PedidoAdmin[] {
  return estado.pedidos.filter((pedido) => pedido.metodo === metodo && pedido.ruta === ruta);
}

/** Pedidos que escriben (POST/PATCH/DELETE), para afirmar que un permiso denegado no manda nada. */
export const pedidosDeEscritura = (estado: EstadoAdminCatalogo): PedidoAdmin[] => estado.pedidos.filter((pedido) => pedido.metodo !== 'GET');

/** Respuesta de error con el formato del backend (`detail`, `code`, `field`). */
export function respuestaError(status: number, code: string, detail: string, field: string | null = null): Response {
  return HttpResponse.json({ detail, code, field }, { status });
}

/** Árbol anidado (`GET /categorias/arbol`): se arma desde las planas, ordenado por nombre en cada nivel. */
export function armarArbol(categorias: readonly CategoriaDto[], padre: number | null = null): CategoriaNodoDto[] {
  return categorias
    .filter((c) => c.parent_id === padre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((c) => ({ ...c, subcategorias: armarArbol(categorias, c.id) }));
}

const noEncontrado = (que: string) => respuestaError(404, 'HTTP_404', `${que} no encontrada`);

/**
 * Endpoints de administración del catálogo con las reglas del backend: nombre único (409 `DUPLICATE_VALUE`), padre existente (404),
 * sin ciclos (400), baja con hijas (409 `CATEGORY_HAS_CHILDREN`) o con productos (409 `CATEGORY_HAS_PRODUCTS`, prioritario), 204 y 404.
 * Cada test sobrescribe un caso puntual con `server.use` (por ejemplo, `respuestaError(409, …)` o `HttpResponse.error()` para red caída).
 */
export function handlersAdminCatalogo(estado: EstadoAdminCatalogo) {
  const registrar = async (request: Request, cuerpo: unknown): Promise<void> => {
    const url = new URL(request.url);
    estado.pedidos.push({ metodo: request.method, ruta: url.pathname.replace(/^\/api\/v1/, ''), cuerpo, busqueda: url.search });
    const demora = estado.demoras[request.method as Metodo];
    if (demora !== undefined) await delay(demora);
  };
  const cuerpoDe = async <T,>(request: Request): Promise<T> => (await request.json()) as T;
  const siguienteId = (ids: number[]): number => ids.reduce((maximo, id) => Math.max(maximo, id), 0) + 1;
  const hayNombre = (nombres: string[], nombre: string, excepto?: string): boolean =>
    nombres.some((n) => n.toLowerCase() === nombre.toLowerCase() && n !== excepto);
  const duplicado = (que: string) => respuestaError(409, 'DUPLICATE_VALUE', `El valor de 'nombre' ya está en uso (${que})`, 'nombre');
  const descendientes = (id: number): number[] => estado.categorias.filter((c) => c.parent_id === id).flatMap((c) => [c.id, ...descendientes(c.id)]);

  return [
    // ── Categorías ──
    http.get(`${API}/categorias/arbol`, async ({ request }) => {
      await registrar(request, null);
      const arbol = armarArbol(estado.categorias);
      return HttpResponse.json({ data: arbol, total: arbol.length });
    }),
    http.post(`${API}/categorias/`, async ({ request }) => {
      const cuerpo = await cuerpoDe<Partial<CategoriaDto>>(request);
      await registrar(request, cuerpo);
      if (hayNombre(estado.categorias.map((c) => c.nombre), cuerpo.nombre ?? '')) return duplicado('categoría');
      const padre = cuerpo.parent_id ?? null;
      if (padre !== null && !estado.categorias.some((c) => c.id === padre)) return noEncontrado('Categoría padre');
      const nueva: CategoriaDto = {
        id: siguienteId(estado.categorias.map((c) => c.id)),
        parent_id: padre,
        nombre: cuerpo.nombre ?? '',
        descripcion: cuerpo.descripcion ?? null,
        imagen_url: cuerpo.imagen_url ?? null,
        imagen_public_id: null,
      };
      estado.categorias.push(nueva);
      return HttpResponse.json(nueva, { status: 201 });
    }),
    http.patch(`${API}/categorias/:id`, async ({ request, params }) => {
      const cuerpo = await cuerpoDe<Partial<CategoriaDto>>(request);
      await registrar(request, cuerpo);
      const objetivo = estado.categorias.find((c) => c.id === Number(params.id));
      if (objetivo === undefined) return noEncontrado('Categoría');
      if (cuerpo.nombre !== undefined && hayNombre(estado.categorias.map((c) => c.nombre), cuerpo.nombre, objetivo.nombre)) return duplicado('categoría');
      if (cuerpo.parent_id !== undefined && cuerpo.parent_id !== null) {
        if (cuerpo.parent_id === objetivo.id || descendientes(objetivo.id).includes(cuerpo.parent_id)) {
          return respuestaError(400, 'HTTP_400', 'La categoría no puede ser su propio padre ni descendiente de sí misma');
        }
        if (!estado.categorias.some((c) => c.id === cuerpo.parent_id)) return noEncontrado('Categoría padre');
      }
      Object.assign(objetivo, cuerpo);
      return HttpResponse.json(objetivo);
    }),
    http.delete(`${API}/categorias/:id`, async ({ request, params }) => {
      await registrar(request, null);
      const id = Number(params.id);
      const objetivo = estado.categorias.find((c) => c.id === id);
      if (objetivo === undefined) return noEncontrado('Categoría');
      if (estado.categoriasConProductos.has(id)) {
        return respuestaError(409, 'CATEGORY_HAS_PRODUCTS', 'La categoría tiene productos activos asociados');
      }
      if (estado.categorias.some((c) => c.parent_id === id)) {
        return respuestaError(409, 'CATEGORY_HAS_CHILDREN', 'La categoría tiene subcategorías activas');
      }
      estado.categorias = estado.categorias.filter((c) => c.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),

    // ── Ingredientes ──
    http.get(`${API}/ingredientes/`, async ({ request }) => {
      await registrar(request, null);
      const parametros = new URL(request.url).searchParams;
      const page = Number(parametros.get('page') ?? '1');
      const size = Number(parametros.get('size') ?? '20');
      const filtro = parametros.get('is_alergeno');
      const filtrados = estado.ingredientes.filter((i) => filtro === null || i.es_alergeno === (filtro === 'true'));
      return HttpResponse.json({
        items: filtrados.slice((page - 1) * size, page * size),
        total: filtrados.length,
        page,
        size,
        pages: Math.ceil(filtrados.length / size),
      });
    }),
    http.post(`${API}/ingredientes/`, async ({ request }) => {
      const cuerpo = await cuerpoDe<Partial<IngredienteDto>>(request);
      await registrar(request, cuerpo);
      if (hayNombre(estado.ingredientes.map((i) => i.nombre), cuerpo.nombre ?? '')) return duplicado('ingrediente');
      const nuevo: IngredienteDto = {
        id: siguienteId(estado.ingredientes.map((i) => i.id)),
        nombre: cuerpo.nombre ?? '',
        descripcion: cuerpo.descripcion ?? null,
        es_alergeno: cuerpo.es_alergeno ?? false,
        imagen_url: null,
        imagen_public_id: null,
        unidad_medida_id: cuerpo.unidad_medida_id ?? 1,
        productos: [],
      };
      estado.ingredientes.push(nuevo);
      return HttpResponse.json(nuevo, { status: 201 });
    }),
    http.patch(`${API}/ingredientes/:id`, async ({ request, params }) => {
      const cuerpo = await cuerpoDe<Partial<IngredienteDto>>(request);
      await registrar(request, cuerpo);
      const objetivo = estado.ingredientes.find((i) => i.id === Number(params.id));
      if (objetivo === undefined) return noEncontrado('Ingrediente');
      if (cuerpo.nombre !== undefined && hayNombre(estado.ingredientes.map((i) => i.nombre), cuerpo.nombre, objetivo.nombre)) return duplicado('ingrediente');
      Object.assign(objetivo, cuerpo);
      return HttpResponse.json(objetivo);
    }),
    http.delete(`${API}/ingredientes/:id`, async ({ request, params }) => {
      await registrar(request, null);
      const id = Number(params.id);
      if (!estado.ingredientes.some((i) => i.id === id)) return noEncontrado('Ingrediente');
      estado.ingredientes = estado.ingredientes.filter((i) => i.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),

    // ── Unidades de medida ──
    http.get(`${API}/unidades-medida/`, async ({ request }) => {
      await registrar(request, null);
      const parametros = new URL(request.url).searchParams;
      const page = Number(parametros.get('page') ?? '1');
      const size = Number(parametros.get('size') ?? '20');
      return HttpResponse.json({
        items: estado.unidades.slice((page - 1) * size, page * size),
        total: estado.unidades.length,
        page,
        size,
        pages: Math.ceil(estado.unidades.length / size),
      });
    }),
  ];
}
