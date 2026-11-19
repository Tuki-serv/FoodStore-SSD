import { delay, http, HttpResponse } from 'msw';
import type { Producto } from '@/entities/producto';
import { crearEstadoAdminCatalogo, handlersAdminCatalogo, respuestaError, type EstadoAdminCatalogo, type PedidoAdmin } from './admin-catalogo';
import { productosSeed } from './catalogo';
import { API } from './server';

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Entrada de ingrediente en el cuerpo de `POST`/`PUT /productos/` (`ProductoIngredienteInput`). */
export interface IngredienteEntradaDto {
  ingrediente_id: number;
  cantidad: string;
  unidad_medida_id: number;
  es_removible: boolean;
}

/** Cuerpo de `POST`/`PUT /productos/` (en `PUT`, parcial). */
export interface ProductoEntradaDto {
  nombre?: string;
  descripcion?: string | null;
  precio_base?: string;
  stock_cantidad?: number;
  disponible?: boolean;
  categoria_ids?: number[];
  ingredientes?: IngredienteEntradaDto[];
}

/**
 * Los seis productos del seed tal como los ve un ADMIN o STOCK: «Limonada Natural» está sin stock y no disponible,
 * así que solo aparece en la gestión (no en el catálogo público).
 */
export const productosGestionSeed: Producto[] = productosSeed.map((producto) =>
  producto.id === 6 ? { ...producto, stock_cantidad: 0, disponible: false } : { ...producto },
);

/** Estado en memoria que replica al backend de productos (visibilidad de gestión); lo muta cada handler. */
export interface EstadoAdminProductos {
  productos: Producto[];
  /** Categorías, ingredientes y unidades: el mismo estado que usan las pantallas de C-17a. */
  catalogo: EstadoAdminCatalogo;
  pedidos: PedidoAdmin[];
  /** Demora (ms) por método, para ver estados de carga y pedidos en curso. */
  demoras: Partial<Record<Metodo, number>>;
}

export function crearEstadoAdminProductos(productos: Producto[] = productosGestionSeed): EstadoAdminProductos {
  return {
    productos: productos.map((p) => ({ ...p, categorias: [...p.categorias], ingredientes: [...p.ingredientes] })),
    catalogo: crearEstadoAdminCatalogo(),
    pedidos: [],
    demoras: {},
  };
}

/** Pedidos de productos registrados para un método y una ruta (relativa a `/api/v1`). */
export const pedidosProductos = (estado: EstadoAdminProductos, metodo: string, ruta: string): PedidoAdmin[] =>
  estado.pedidos.filter((pedido) => pedido.metodo === metodo && pedido.ruta === ruta);

/** Pedidos de escritura sobre productos, para afirmar que un permiso denegado o un error de validación no manda nada. */
export const escriturasProductos = (estado: EstadoAdminProductos): PedidoAdmin[] => estado.pedidos.filter((pedido) => pedido.metodo !== 'GET');

/** Query strings de los pedidos de listado. */
export const busquedasProductos = (estado: EstadoAdminProductos): string[] =>
  estado.pedidos.filter((pedido) => pedido.metodo === 'GET' && pedido.ruta === '/productos/').map((pedido) => pedido.busqueda);

const noEncontrado = () => respuestaError(404, 'HTTP_404', 'Producto no encontrado');

/**
 * `GET /productos/` (filtros `q`, `categoria_ids` repetido, `disponible`, paginación, orden por id), `GET /productos/:id`,
 * `POST`, `PUT` parcial (reemplaza categorías e ingredientes si vienen), `DELETE` (204) y los `PATCH` de stock y disponibilidad,
 * con las reglas del backend: nombre único (409 `DUPLICATE_VALUE`), 404 en inexistentes y principal = primera categoría.
 * Incluye también los handlers de C-17a (árbol, ingredientes y unidades). Cada test sobrescribe un caso con `server.use`.
 */
export function handlersAdminProductos(estado: EstadoAdminProductos) {
  const registrar = async (request: Request, cuerpo: unknown): Promise<void> => {
    const url = new URL(request.url);
    estado.pedidos.push({ metodo: request.method, ruta: url.pathname.replace(/^\/api\/v1/, ''), cuerpo, busqueda: url.search });
    const demora = estado.demoras[request.method as Metodo];
    if (demora !== undefined) await delay(demora);
  };
  const cuerpoDe = async <T,>(request: Request): Promise<T> => (await request.json()) as T;
  const buscar = (id: unknown): Producto | undefined => estado.productos.find((p) => p.id === Number(id));
  const hayNombre = (nombre: string, excepto?: number): boolean =>
    estado.productos.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase() && p.id !== excepto);
  const duplicado = () => respuestaError(409, 'DUPLICATE_VALUE', "El valor de 'nombre' ya está en uso (producto)", 'nombre');
  const categoriasDe = (ids: number[]): Producto['categorias'] =>
    ids.map((id, indice) => ({ id, nombre: estado.catalogo.categorias.find((c) => c.id === id)?.nombre ?? `Categoría ${id}`, es_principal: indice === 0 }));
  const ingredientesDe = (entradas: IngredienteEntradaDto[]): Producto['ingredientes'] =>
    entradas.map((entrada) => {
      const base = estado.catalogo.ingredientes.find((i) => i.id === entrada.ingrediente_id);
      return {
        id: entrada.ingrediente_id,
        nombre: base?.nombre ?? `Ingrediente ${entrada.ingrediente_id}`,
        es_alergeno: base?.es_alergeno ?? false,
        es_removible: entrada.es_removible,
        cantidad: entrada.cantidad,
        unidad_medida_id: entrada.unidad_medida_id,
      };
    });

  return [
    ...handlersAdminCatalogo(estado.catalogo),
    http.get(`${API}/productos/`, async ({ request }) => {
      await registrar(request, null);
      const parametros = new URL(request.url).searchParams;
      const page = Number(parametros.get('page') ?? '1');
      const size = Number(parametros.get('size') ?? '20');
      const q = parametros.get('q')?.toLowerCase();
      const categorias = parametros.getAll('categoria_ids').map(Number);
      const disponible = parametros.get('disponible');
      const filtrados = estado.productos.filter(
        (p) =>
          (q === undefined || p.nombre.toLowerCase().includes(q)) &&
          (categorias.length === 0 || p.categorias.some((c) => categorias.includes(c.id))) &&
          (disponible === null || p.disponible === (disponible === 'true')),
      );
      return HttpResponse.json({
        items: filtrados.slice((page - 1) * size, page * size),
        total: filtrados.length,
        page,
        size,
        pages: Math.ceil(filtrados.length / size),
      });
    }),
    http.get(`${API}/productos/:id`, async ({ request, params }) => {
      await registrar(request, null);
      const producto = buscar(params.id);
      return producto === undefined ? noEncontrado() : HttpResponse.json(producto);
    }),
    http.post(`${API}/productos/`, async ({ request }) => {
      const cuerpo = await cuerpoDe<ProductoEntradaDto>(request);
      await registrar(request, cuerpo);
      if (hayNombre(cuerpo.nombre ?? '')) return duplicado();
      const nuevo: Producto = {
        id: estado.productos.reduce((maximo, p) => Math.max(maximo, p.id), 0) + 1,
        nombre: cuerpo.nombre ?? '',
        descripcion: cuerpo.descripcion ?? null,
        unidad_venta_id: null,
        precio_base: cuerpo.precio_base ?? '0.00',
        imagenes_url: null,
        imagenes_public_id: null,
        stock_cantidad: cuerpo.stock_cantidad ?? 0,
        disponible: cuerpo.disponible ?? true,
        categorias: categoriasDe(cuerpo.categoria_ids ?? []),
        ingredientes: ingredientesDe(cuerpo.ingredientes ?? []),
      };
      estado.productos.push(nuevo);
      return HttpResponse.json(nuevo, { status: 201 });
    }),
    http.put(`${API}/productos/:id`, async ({ request, params }) => {
      const cuerpo = await cuerpoDe<ProductoEntradaDto>(request);
      await registrar(request, cuerpo);
      const objetivo = buscar(params.id);
      if (objetivo === undefined) return noEncontrado();
      if (cuerpo.nombre !== undefined && hayNombre(cuerpo.nombre, objetivo.id)) return duplicado();
      const { categoria_ids, ingredientes, ...simples } = cuerpo;
      Object.assign(objetivo, simples);
      if (categoria_ids !== undefined) objetivo.categorias = categoriasDe(categoria_ids);
      if (ingredientes !== undefined) objetivo.ingredientes = ingredientesDe(ingredientes);
      return HttpResponse.json(objetivo);
    }),
    http.delete(`${API}/productos/:id`, async ({ request, params }) => {
      await registrar(request, null);
      if (buscar(params.id) === undefined) return noEncontrado();
      estado.productos = estado.productos.filter((p) => p.id !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch(`${API}/productos/:id/stock`, async ({ request, params }) => {
      const cuerpo = await cuerpoDe<{ stock_cantidad: number }>(request);
      await registrar(request, cuerpo);
      const objetivo = buscar(params.id);
      if (objetivo === undefined) return noEncontrado();
      objetivo.stock_cantidad = cuerpo.stock_cantidad;
      return HttpResponse.json(objetivo);
    }),
    http.patch(`${API}/productos/:id/disponibilidad`, async ({ request, params }) => {
      const cuerpo = await cuerpoDe<{ disponible: boolean }>(request);
      await registrar(request, cuerpo);
      const objetivo = buscar(params.id);
      if (objetivo === undefined) return noEncontrado();
      objetivo.disponible = cuerpo.disponible;
      return HttpResponse.json(objetivo);
    }),
  ];
}
