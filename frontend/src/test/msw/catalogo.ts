import { delay, http, HttpResponse } from 'msw';
import type { CategoriaDeProducto, IngredienteProducto, Producto } from '@/entities/producto';
import { API } from './server';

export type ProductoDto = Producto;
export type { CategoriaDeProducto, IngredienteProducto };

/** Producto tal como lo devuelve `GET /productos/`: disponible, con stock y sin categorías ni ingredientes salvo los dados. */
export function productoDto(datos: Partial<ProductoDto> & Pick<ProductoDto, 'id'>): ProductoDto {
  return {
    nombre: `Producto ${datos.id}`,
    descripcion: null,
    unidad_venta_id: null,
    precio_base: '1000.00',
    imagenes_url: null,
    imagenes_public_id: null,
    stock_cantidad: 10,
    disponible: true,
    categorias: [],
    ingredientes: [],
    ...datos,
  };
}

/** Nodo de `GET /categorias/arbol` (`CategoriaTreeNode`). */
export interface CategoriaNodoDto {
  id: number;
  parent_id: number | null;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  imagen_public_id: string | null;
  subcategorias: CategoriaNodoDto[];
}

export function categoriaNodoDto(datos: Partial<CategoriaNodoDto> & Pick<CategoriaNodoDto, 'id' | 'nombre'>): CategoriaNodoDto {
  return { parent_id: null, descripcion: null, imagen_url: null, imagen_public_id: null, subcategorias: [], ...datos };
}

/** Árbol del seed del backend: ordenado por nombre en cada nivel. */
export const arbolSeed: CategoriaNodoDto[] = [
  categoriaNodoDto({ id: 2, nombre: 'Bebidas', subcategorias: [categoriaNodoDto({ id: 6, nombre: 'Gaseosas', parent_id: 2 })] }),
  categoriaNodoDto({
    id: 1,
    nombre: 'Hamburguesas',
    subcategorias: [categoriaNodoDto({ id: 5, nombre: 'Sin TACC', parent_id: 1 }), categoriaNodoDto({ id: 4, nombre: 'Veganas', parent_id: 1 })],
  }),
  categoriaNodoDto({ id: 3, nombre: 'Postres' }),
];

const HAMBURGUESAS: CategoriaDeProducto = { id: 1, nombre: 'Hamburguesas', es_principal: true };
const BEBIDAS: CategoriaDeProducto = { id: 2, nombre: 'Bebidas', es_principal: true };

const ingrediente = (id: number, nombre: string, esAlergeno: boolean, esRemovible: boolean): IngredienteProducto => ({
  id,
  nombre,
  es_alergeno: esAlergeno,
  es_removible: esRemovible,
  cantidad: '1.000',
  unidad_medida_id: 1,
});

/** Los seis productos del seed (de $ 700 a $ 1.900); «Burger Vegana» y «Burger Sin TACC» están en dos categorías. */
export const productosSeed: ProductoDto[] = [
  productoDto({
    id: 1,
    nombre: 'Hamburguesa Clásica',
    descripcion: 'La de siempre, perfecta de siempre.',
    precio_base: '1500.00',
    stock_cantidad: 50,
    categorias: [HAMBURGUESAS],
    ingredientes: [ingrediente(1, 'Pan Brioche', true, false), ingrediente(2, 'Lechuga', false, true), ingrediente(3, 'Mayonesa', true, true)],
  }),
  productoDto({ id: 2, nombre: 'Burger BBQ Bacon', precio_base: '1900.00', stock_cantidad: 30, categorias: [HAMBURGUESAS] }),
  productoDto({
    id: 3,
    nombre: 'Burger Vegana',
    precio_base: '1800.00',
    stock_cantidad: 20,
    categorias: [HAMBURGUESAS, { id: 4, nombre: 'Veganas', es_principal: false }],
  }),
  productoDto({
    id: 4,
    nombre: 'Burger Sin TACC',
    precio_base: '1700.00',
    stock_cantidad: 20,
    categorias: [HAMBURGUESAS, { id: 5, nombre: 'Sin TACC', es_principal: false }],
  }),
  productoDto({ id: 5, nombre: 'Coca-Cola 500ml', precio_base: '800.00', stock_cantidad: 100, categorias: [BEBIDAS] }),
  productoDto({ id: 6, nombre: 'Limonada Natural', precio_base: '700.00', stock_cantidad: 60, categorias: [BEBIDAS] }),
];

/** Pedido recibido por un handler del catálogo: ruta relativa a `/api/v1` y query string tal cual llegó. */
export interface PedidoCatalogo {
  ruta: string;
  busqueda: string;
  authorization: string | null;
}

export type OperacionCatalogo = 'lista' | 'detalle' | 'arbol';

/** Estado en memoria que replica al backend (`productos` y `categorias/arbol` con C-16a aplicado). */
export interface EstadoCatalogo {
  productos: ProductoDto[];
  arbol: CategoriaNodoDto[];
  pedidos: PedidoCatalogo[];
  /** Demora (ms) de cada operación, para ver estados de carga. */
  demoras: Partial<Record<OperacionCatalogo, number>>;
}

export function crearEstadoCatalogo(productos: ProductoDto[] = productosSeed, arbol: CategoriaNodoDto[] = arbolSeed): EstadoCatalogo {
  return { productos: productos.map((p) => ({ ...p })), arbol, pedidos: [], demoras: {} };
}

/** Query strings (`?page=1&…`) de los pedidos de listado. */
export const busquedasDeLista = (estado: EstadoCatalogo): string[] =>
  estado.pedidos.filter((pedido) => pedido.ruta === '/productos/').map((pedido) => pedido.busqueda);

/** Pedidos de producto (listado o detalle). */
export const pedidosDeProductos = (estado: EstadoCatalogo): PedidoCatalogo[] => estado.pedidos.filter((pedido) => pedido.ruta.startsWith('/productos'));

const enteroONulo = (valor: string | null): number | null => (valor === null || valor === '' ? null : Number(valor));

/**
 * Handlers de `GET /productos/`, `GET /productos/:id` y `GET /categorias/arbol`: filtran por `q` (nombre), `categoria_ids`,
 * `precio_min`/`precio_max`, `con_stock` y `disponible`; paginan; ordenan por id; y no duplican productos (contrato de C-16a).
 */
export function handlersCatalogo(estado: EstadoCatalogo) {
  const registrar = async (request: Request, operacion: OperacionCatalogo): Promise<void> => {
    const url = new URL(request.url);
    estado.pedidos.push({
      ruta: url.pathname.replace(/^\/api\/v1/, ''),
      busqueda: url.search,
      authorization: request.headers.get('authorization'),
    });
    const demora = estado.demoras[operacion];
    if (demora !== undefined) await delay(demora);
  };

  return [
    http.get(`${API}/productos/`, async ({ request }) => {
      await registrar(request, 'lista');
      const params = new URL(request.url).searchParams;
      const page = Number(params.get('page') ?? '1');
      const size = Number(params.get('size') ?? '20');
      const q = params.get('q')?.toLowerCase() ?? null;
      const categorias = params.getAll('categoria_ids').map(Number);
      const min = enteroONulo(params.get('precio_min'));
      const max = enteroONulo(params.get('precio_max'));
      const filtrados = estado.productos
        .filter((p) => params.get('disponible') !== 'true' || p.disponible)
        .filter((p) => q === null || p.nombre.toLowerCase().includes(q))
        .filter((p) => categorias.length === 0 || p.categorias.some((c) => categorias.includes(c.id)))
        .filter((p) => min === null || Number(p.precio_base) >= min)
        .filter((p) => max === null || Number(p.precio_base) <= max)
        .filter((p) => params.get('con_stock') !== 'true' || p.stock_cantidad > 0)
        .sort((a, b) => a.id - b.id);
      return HttpResponse.json({
        items: filtrados.slice((page - 1) * size, page * size),
        total: filtrados.length,
        page,
        size,
        pages: Math.ceil(filtrados.length / size),
      });
    }),
    http.get(`${API}/productos/:id`, async ({ request, params }) => {
      await registrar(request, 'detalle');
      const producto = estado.productos.find((p) => p.id === Number(params.id) && p.disponible);
      if (producto === undefined) return HttpResponse.json({ detail: 'Producto no encontrado', code: 'HTTP_404', field: null }, { status: 404 });
      return HttpResponse.json(producto);
    }),
    http.get(`${API}/categorias/arbol`, async ({ request }) => {
      await registrar(request, 'arbol');
      return HttpResponse.json({ data: estado.arbol, total: estado.arbol.length });
    }),
  ];
}
