import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { almacenamientoSeguro } from '@/shared/lib';

/** Línea del carrito: producto + ingredientes excluidos. El precio es el decimal del backend como string (`"1250.50"`). */
export interface LineaCarrito {
  productoId: number;
  nombre: string;
  precioUnitario: string;
  imagenUrl: string | null;
  cantidad: number;
  /** Ids de ingredientes excluidos, ordenados y sin repetir. */
  personalizacion: number[];
  /** Nombres de los excluidos (snapshot al agregar), en el mismo orden que `personalizacion`; vacío en líneas migradas de v1. */
  personalizacionNombres: string[];
}

/** Ingrediente que la persona quitó de un producto al agregarlo. */
export interface IngredienteExcluido {
  id: number;
  nombre: string;
}

export type ProductoParaCarrito = Pick<LineaCarrito, 'productoId' | 'nombre' | 'precioUnitario' | 'imagenUrl'>;

/** Estado de cliente del carrito (CE-14: sobrevive a recargas y al cierre de sesión). No guarda datos del servidor. */
export interface CartState {
  lineas: LineaCarrito[];
  /** Suma `cantidad` unidades; mismo producto y misma personalización (sin importar el orden) comparten línea. */
  agregar: (producto: ProductoParaCarrito, cantidad?: number, excluidos?: readonly IngredienteExcluido[]) => void;
  /** Cantidad entera >= 1; 0 o menos quita la línea; una no entera se rechaza sin cambios. */
  fijarCantidad: (clave: string, cantidad: number) => void;
  quitar: (clave: string) => void;
  vaciar: () => void;
  reset: () => void;
}

export const CLAVE_CART_STORAGE = 'foodstore.cart';

const REGEX_DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Excluidos sin repetir por id y ordenados por id. */
function normalizarExcluidos(excluidos: readonly IngredienteExcluido[]): IngredienteExcluido[] {
  const porId = new Map<number, IngredienteExcluido>();
  for (const excluido of excluidos) if (!porId.has(excluido.id)) porId.set(excluido.id, excluido);
  return [...porId.values()].sort((a, b) => a.id - b.id);
}

const normalizarPersonalizacion = (ids: readonly number[]): number[] => [...new Set(ids)].sort((a, b) => a - b);

/** Clave de línea: `<productoId>:<ids excluidos ordenados>`. */
export function claveLinea(productoId: number, personalizacion: readonly number[]): string {
  return `${productoId}:${normalizarPersonalizacion(personalizacion).join(',')}`;
}

const claveDe = (linea: LineaCarrito): string => claveLinea(linea.productoId, linea.personalizacion);

const esEnteroPositivo = (valor: number): boolean => Number.isInteger(valor) && valor >= 1;

/** Centavos de un decimal con hasta 2 decimales; `null` si no es un importe válido. */
function aCentavos(decimal: string): number | null {
  const coincidencia = REGEX_DECIMAL.exec(decimal);
  if (coincidencia === null) return null;
  return Number(coincidencia[1]) * 100 + Number((coincidencia[2] ?? '').padEnd(2, '0'));
}

function esLineaValida(valor: unknown): valor is LineaCarrito {
  if (typeof valor !== 'object' || valor === null) return false;
  const linea = valor as Record<string, unknown>;
  return (
    Number.isInteger(linea.productoId) &&
    typeof linea.nombre === 'string' &&
    typeof linea.precioUnitario === 'string' &&
    aCentavos(linea.precioUnitario) !== null &&
    (linea.imagenUrl === null || typeof linea.imagenUrl === 'string') &&
    typeof linea.cantidad === 'number' &&
    esEnteroPositivo(linea.cantidad) &&
    Array.isArray(linea.personalizacion) &&
    linea.personalizacion.every((id) => Number.isInteger(id)) &&
    Array.isArray(linea.personalizacionNombres) &&
    linea.personalizacionNombres.every((nombre) => typeof nombre === 'string') &&
    (linea.personalizacionNombres.length === 0 || linea.personalizacionNombres.length === linea.personalizacion.length)
  );
}

/** v1 no guardaba los nombres de los excluidos: cada línea recibe `personalizacionNombres: []`. */
function migrarDeV1(guardado: unknown): unknown {
  const lineas = (guardado as { lineas?: unknown } | undefined)?.lineas;
  if (!Array.isArray(lineas)) return guardado;
  return { ...(guardado as object), lineas: lineas.map((linea) => (typeof linea === 'object' && linea !== null ? { personalizacionNombres: [], ...linea } : linea)) };
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lineas: [],
      agregar: (producto, cantidad = 1, excluidos = []) => {
        if (!esEnteroPositivo(cantidad) || aCentavos(producto.precioUnitario) === null) return;
        const normalizados = normalizarExcluidos(excluidos);
        const ids = normalizados.map((excluido) => excluido.id);
        const clave = claveLinea(producto.productoId, ids);
        set(({ lineas }) =>
          lineas.some((linea) => claveDe(linea) === clave)
            ? { lineas: lineas.map((linea) => (claveDe(linea) === clave ? { ...linea, cantidad: linea.cantidad + cantidad } : linea)) }
            : { lineas: [...lineas, { ...producto, cantidad, personalizacion: ids, personalizacionNombres: normalizados.map((excluido) => excluido.nombre) }] },
        );
      },
      fijarCantidad: (clave, cantidad) => {
        if (!Number.isInteger(cantidad)) return;
        set(({ lineas }) => ({
          lineas:
            cantidad <= 0
              ? lineas.filter((linea) => claveDe(linea) !== clave)
              : lineas.map((linea) => (claveDe(linea) === clave ? { ...linea, cantidad } : linea)),
        }));
      },
      quitar: (clave) => set(({ lineas }) => ({ lineas: lineas.filter((linea) => claveDe(linea) !== clave) })),
      vaciar: () => set({ lineas: [] }),
      reset: () => {
        set({ lineas: [] });
        useCartStore.persist.clearStorage();
      },
    }),
    {
      name: CLAVE_CART_STORAGE,
      version: 2,
      // Solo v1 sabe migrarse; cualquier otra versión distinta de la actual se descarta (carrito vacío).
      migrate: (guardado, version) => (version === 1 ? migrarDeV1(guardado) : { lineas: [] }) as CartState,
      storage: createJSONStorage(() => almacenamientoSeguro),
      partialize: ({ lineas }) => ({ lineas }),
      // Datos guardados con otra forma (o a mano) se descartan enteros: el carrito arranca vacío.
      merge: (guardado, actual) => {
        const lineas = (guardado as { lineas?: unknown } | undefined)?.lineas;
        return { ...actual, lineas: Array.isArray(lineas) && lineas.every(esLineaValida) ? lineas : [] };
      },
    },
  ),
);

/** Importe de la línea (`precioUnitario × cantidad`) con dos decimales, en centavos enteros. */
export function subtotalLinea(linea: Pick<LineaCarrito, 'precioUnitario' | 'cantidad'>): string {
  return formatearCentavos((aCentavos(linea.precioUnitario) ?? 0) * linea.cantidad);
}

const formatearCentavos = (centavos: number): string => `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;

export const selectLineas = (estado: CartState): LineaCarrito[] => estado.lineas;
export const selectTotalItems = (estado: CartState): number => estado.lineas.reduce((total, linea) => total + linea.cantidad, 0);

/** Importe total con dos decimales, sumado en centavos enteros (sin `parseFloat` acumulado). */
export const selectTotalPrecio = (estado: CartState): string => {
  const centavos = estado.lineas.reduce((total, linea) => total + (aCentavos(linea.precioUnitario) ?? 0) * linea.cantidad, 0);
  return formatearCentavos(centavos);
};

export const selectLinea =
  (clave: string) =>
  (estado: CartState): LineaCarrito | undefined =>
    estado.lineas.find((linea) => claveDe(linea) === clave);
