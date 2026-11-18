import { delay, http, HttpResponse } from 'msw';
import { API } from './server';

export interface DireccionDto {
  id: number;
  usuario_id: number;
  alias: string | null;
  linea1: string;
  linea2: string | null;
  ciudad: string;
  provincia: string | null;
  codigo_postal: string | null;
  es_principal: boolean;
}

/** Dirección tal como la devuelve el backend; sin datos opcionales salvo los dados. */
export function direccionDto(datos: Partial<DireccionDto> & Pick<DireccionDto, 'id'>): DireccionDto {
  return {
    usuario_id: 1,
    alias: null,
    linea1: 'Av. San Martín 1234',
    linea2: null,
    ciudad: 'Mendoza',
    provincia: null,
    codigo_postal: null,
    es_principal: false,
    ...datos,
  };
}

/** Pedido recibido por el handler, para afirmar método, ruta, cuerpo y credencial. */
export interface PedidoRegistrado {
  metodo: string;
  ruta: string;
  cuerpo: unknown;
  authorization: string | null;
  busqueda: string;
}

/** Estado en memoria que replica al backend (`backend/app/modules/direcciones`): lo lee y lo muta cada handler. */
export interface EstadoDirecciones {
  direcciones: DireccionDto[];
  pedidos: PedidoRegistrado[];
  /** Demora (ms) de cada respuesta por método HTTP, para ver estados de carga y pedidos en curso. */
  demoras: Partial<Record<'GET' | 'POST' | 'PATCH' | 'DELETE', number>>;
}

export function crearEstadoDirecciones(iniciales: DireccionDto[] = []): EstadoDirecciones {
  return { direcciones: iniciales.map((d) => ({ ...d })), pedidos: [], demoras: {} };
}

/** Pedidos registrados de un método y ruta (relativa a `/direcciones`). */
export function pedidosDe(estado: EstadoDirecciones, metodo: string, ruta: string): PedidoRegistrado[] {
  return estado.pedidos.filter((pedido) => pedido.metodo === metodo && pedido.ruta === ruta);
}

const noEncontrada = () => HttpResponse.json({ detail: 'Dirección no encontrada', code: 'HTTP_404', field: null }, { status: 404 });

/** Los seis endpoints de `/direcciones` con las reglas del backend: primera principal, principal primero, paginación, 204 y 404. */
export function handlersDirecciones(estado: EstadoDirecciones) {
  const registrar = async (request: Request, cuerpo: unknown): Promise<void> => {
    const url = new URL(request.url);
    estado.pedidos.push({
      metodo: request.method,
      ruta: url.pathname.replace(/^.*\/direcciones/, '') || '/',
      cuerpo,
      authorization: request.headers.get('authorization'),
      busqueda: url.search,
    });
    const demora = estado.demoras[request.method as 'GET' | 'POST' | 'PATCH' | 'DELETE'];
    if (demora !== undefined) await delay(demora);
  };
  const buscar = (id: string): DireccionDto | undefined => estado.direcciones.find((d) => d.id === Number(id));

  return [
    http.get(`${API}/direcciones/`, async ({ request }) => {
      await registrar(request, (await request.text()) || null);
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const size = Number(url.searchParams.get('size') ?? '20');
      const ordenadas = [...estado.direcciones].sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || a.id - b.id);
      const total = ordenadas.length;
      return HttpResponse.json({
        items: ordenadas.slice((page - 1) * size, page * size),
        total,
        page,
        size,
        pages: Math.ceil(total / size),
      });
    }),
    http.post(`${API}/direcciones/`, async ({ request }) => {
      const cuerpo = (await request.json()) as Partial<DireccionDto>;
      await registrar(request, cuerpo);
      const id = estado.direcciones.reduce((maximo, d) => Math.max(maximo, d.id), 0) + 1;
      const nueva = direccionDto({ ...cuerpo, id, es_principal: estado.direcciones.length === 0 });
      estado.direcciones.push(nueva);
      return HttpResponse.json(nueva, { status: 201 });
    }),
    http.patch(`${API}/direcciones/:id/principal`, async ({ request, params }) => {
      await registrar(request, (await request.text()) || null);
      const objetivo = buscar(String(params.id));
      if (objetivo === undefined) return noEncontrada();
      estado.direcciones.forEach((d) => {
        d.es_principal = d.id === objetivo.id;
      });
      return HttpResponse.json(objetivo);
    }),
    http.patch(`${API}/direcciones/:id`, async ({ request, params }) => {
      const cuerpo = (await request.json()) as Partial<DireccionDto>;
      await registrar(request, cuerpo);
      const objetivo = buscar(String(params.id));
      if (objetivo === undefined) return noEncontrada();
      Object.assign(objetivo, cuerpo);
      return HttpResponse.json(objetivo);
    }),
    http.delete(`${API}/direcciones/:id`, async ({ request, params }) => {
      await registrar(request, (await request.text()) || null);
      const objetivo = buscar(String(params.id));
      if (objetivo === undefined) return noEncontrada();
      estado.direcciones = estado.direcciones.filter((d) => d.id !== objetivo.id);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
