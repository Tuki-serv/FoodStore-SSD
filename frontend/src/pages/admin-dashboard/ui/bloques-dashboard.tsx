import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  aNumero,
  formatearCantidad,
  porcentajes,
  rotuloPeriodo,
  type Agrupacion,
  type IngresoFormaPago,
  type PedidosEstado,
  type ProductoTop,
  type PuntoVentas,
  type RangoEstadisticas,
} from '@/entities/estadistica';
import { BadgeEstado, esEstadoPedido, FORMAS_PAGO } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { RUTAS } from '@/shared/config';
import { BloqueGrafico } from './bloque-grafico';
import { GraficoEstados } from './grafico-estados';
import { GraficoFormasPago, type FilaFormaPago } from './grafico-formas-pago';
import { GraficoProductos } from './grafico-productos';
import { GraficoVentas } from './grafico-ventas';

const NOMBRE_AGRUPACION: Readonly<Record<Agrupacion, string>> = { day: 'día', week: 'semana', month: 'mes' };

const textoError = (que: string): string => `Hubo un problema al pedir ${que}. Los demás gráficos siguen funcionando.`;

/** `dd/mm – dd/mm` del rango, para los subtítulos. */
const rotuloRango = ({ desde, hasta }: RangoEstadisticas): string => `${rotuloPeriodo(desde, 'day')} – ${rotuloPeriodo(hasta, 'day')}`;

/** Forma de pago con su nombre visible y su porcentaje (suman 100); un código que no se conoce se muestra tal cual. */
function filasFormaPago(ingresos: readonly IngresoFormaPago[]): FilaFormaPago[] {
  const porcentaje = porcentajes(ingresos.map((ingreso) => ingreso.total));
  return ingresos.map(({ forma_pago_codigo, total }, indice) => ({
    codigo: forma_pago_codigo,
    nombre: FORMAS_PAGO.find((forma) => forma.codigo === forma_pago_codigo)?.etiqueta ?? forma_pago_codigo,
    total,
    porcentaje: porcentaje[indice] ?? 0,
  }));
}

export function BloqueVentas({ consulta, rango, agrupacion }: { consulta: UseQueryResult<PuntoVentas[]>; rango: RangoEstadisticas; agrupacion: Agrupacion }) {
  return (
    <BloqueGrafico
      titulo="Ventas por período"
      subtitulo={`Ingresos ${rotuloRango(rango)} · por ${NOMBRE_AGRUPACION[agrupacion]}`}
      consulta={consulta}
      estaVacio={(puntos) => puntos.every((punto) => punto.cantidad_pedidos === 0)}
      vacio={{ titulo: 'Sin ventas en este período', texto: 'Probá con otro rango de fechas.' }}
      textoError={textoError('las ventas por período')}
      renderGrafico={(puntos) => <GraficoVentas puntos={puntos} agrupacion={agrupacion} />}
      renderTabla={(puntos) => ({
        columnas: ['Período', 'Ingresos', 'Pedidos'],
        filas: puntos.map((punto) => [rotuloPeriodo(punto.fecha, agrupacion), formatearPrecio(punto.total_ventas), formatearCantidad(punto.cantidad_pedidos)]),
      })}
    />
  );
}

export function BloqueProductos({ consulta }: { consulta: UseQueryResult<ProductoTop[]> }) {
  return (
    <BloqueGrafico
      titulo="Productos más vendidos"
      subtitulo="Top 5 por cantidad · ingresos = facturado en el producto"
      consulta={consulta}
      estaVacio={(productos) => productos.length === 0}
      vacio={{ titulo: 'Sin ventas en este período', texto: 'Cuando haya pedidos vendidos van a aparecer acá.' }}
      textoError={textoError('los productos más vendidos')}
      renderGrafico={(productos) => <GraficoProductos productos={productos} />}
      renderTabla={(productos) => ({
        columnas: ['Producto', 'Cantidad', 'Ingresos'],
        filas: productos.map((producto) => [producto.nombre, formatearCantidad(producto.cantidad_vendida), formatearPrecio(producto.ingresos)]),
      })}
    />
  );
}

export function BloqueEstados({ consulta, rango }: { consulta: UseQueryResult<PedidosEstado[]>; rango: RangoEstadisticas }) {
  return (
    <BloqueGrafico
      titulo="Pedidos por estado"
      subtitulo={`Pedidos creados en el período · ${rotuloRango(rango)}`}
      consulta={consulta}
      estaVacio={(estados) => estados.every((estado) => estado.cantidad === 0)}
      vacio={{ titulo: 'Sin pedidos en este período', texto: 'No se creó ningún pedido en estas fechas.' }}
      textoError={textoError('los pedidos por estado')}
      renderGrafico={(estados) => <GraficoEstados estados={estados} />}
      renderTabla={(estados) => ({
        columnas: ['Estado', 'Pedidos'],
        filas: estados.map(({ estado_codigo, cantidad }) => [
          esEstadoPedido(estado_codigo) ? (
            <Link key={estado_codigo} className="tlink" to={`${RUTAS.gestionPedidos}?estado=${estado_codigo}`}>
              <BadgeEstado codigo={estado_codigo} />
            </Link>
          ) : (
            <BadgeEstado key={estado_codigo} codigo={estado_codigo} />
          ),
          formatearCantidad(cantidad),
        ]),
      })}
    />
  );
}

export function BloqueFormasPago({ consulta }: { consulta: UseQueryResult<IngresoFormaPago[]> }) {
  return (
    <BloqueGrafico
      titulo="Ingresos por forma de pago"
      subtitulo="Participación sobre los ingresos del período"
      consulta={consulta}
      estaVacio={(ingresos) => ingresos.every((ingreso) => aNumero(ingreso.total) === 0)}
      vacio={{ titulo: 'Sin ventas en este período', texto: 'Cuando haya ingresos vas a ver cómo se reparten.' }}
      textoError={textoError('los ingresos por forma de pago')}
      renderGrafico={(ingresos) => (
        <GraficoFormasPago filas={filasFormaPago(ingresos)} totalFormateado={formatearPrecio(ingresos.reduce((suma, ingreso) => suma + aNumero(ingreso.total), 0).toFixed(2))} />
      )}
      renderTabla={(ingresos) => ({
        columnas: ['Forma de pago', 'Ingresos', 'Porcentaje'],
        filas: filasFormaPago(ingresos).map(({ nombre, total, porcentaje }) => [nombre, formatearPrecio(total), `${String(porcentaje)} %`]),
      })}
    />
  );
}
