import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { aNumero, importeCorto, rotuloPeriodo, type Agrupacion, type PuntoVentas } from '@/entities/estadistica';
import { formatearPrecio } from '@/entities/producto';
import { useMediaQuery } from '@/shared/lib';
import { MOVIMIENTO_REDUCIDO, TICK_EJE } from './estilo-grafico';

interface PuntoGrafico {
  rotulo: string;
  total: number;
  /** Importe completo para el detalle del punto. */
  ingresos: string;
  pedidos: number;
}

function DetallePunto({ active, payload }: TooltipProps<number, string>) {
  const punto = (payload?.[0] as { payload?: PuntoGrafico } | undefined)?.payload;
  if (active !== true || punto === undefined) return null;
  return (
    <div className="tip">
      <strong>{punto.rotulo}</strong>
      <span>{`Ingresos: ${punto.ingresos}`}</span>
      <span>{`${String(punto.pedidos)} ${punto.pedidos === 1 ? 'pedido' : 'pedidos'}`}</span>
    </div>
  );
}

export interface GraficoVentasProps {
  puntos: readonly PuntoVentas[];
  agrupacion: Agrupacion;
}

/** Ventas por período: área con un punto por período (los de 0 incluidos), eje temporal según la agrupación e ingresos en el eje de valores. */
export function GraficoVentas({ puntos, agrupacion }: GraficoVentasProps) {
  const sinAnimacion = useMediaQuery(MOVIMIENTO_REDUCIDO);
  const datos: PuntoGrafico[] = puntos.map((punto) => ({
    rotulo: rotuloPeriodo(punto.fecha, agrupacion),
    total: aNumero(punto.total_ventas),
    ingresos: formatearPrecio(punto.total_ventas),
    pedidos: punto.cantidad_pedidos,
  }));
  return (
    <ResponsiveContainer width="100%" height={264}>
      <AreaChart data={datos} margin={{ top: 14, right: 14, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={TICK_EJE} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tickFormatter={importeCorto} width={62} tickLine={false} axisLine={false} tick={TICK_EJE} />
        <Tooltip content={<DetallePunto />} cursor={{ stroke: 'var(--color-text-muted)', strokeDasharray: '2 3' }} />
        <Area
          type="linear"
          dataKey="total"
          stroke="var(--color-primary)"
          strokeWidth={2.5}
          fill="var(--color-primary)"
          fillOpacity={0.12}
          dot={datos.length <= 16 ? { r: 3.5, fill: 'var(--color-surface)', stroke: 'var(--color-primary)', strokeWidth: 2 } : false}
          isAnimationActive={!sinAnimacion}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
