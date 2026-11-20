import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { ProductoTop } from '@/entities/estadistica';
import { formatearPrecio } from '@/entities/producto';
import { useMediaQuery } from '@/shared/lib';
import { MOVIMIENTO_REDUCIDO, TICK_CATEGORIA } from './estilo-grafico';

const ALTO_FILA = 52;
const MAX_CARACTERES = 22;

const abreviar = (nombre: string): string => (nombre.length > MAX_CARACTERES ? `${nombre.slice(0, MAX_CARACTERES - 1)}…` : nombre);

function DetalleProducto({ active, payload }: TooltipProps<number, string>) {
  const producto = (payload?.[0] as { payload?: ProductoTop } | undefined)?.payload;
  if (active !== true || producto === undefined) return null;
  return (
    <div className="tip">
      <strong>{producto.nombre}</strong>
      <span>{`${String(producto.cantidad_vendida)} vendidos`}</span>
      <span>{`Facturado: ${formatearPrecio(producto.ingresos)}`}</span>
    </div>
  );
}

/** Top de productos: barras horizontales por cantidad vendida; los ingresos («facturado en el producto») van en el detalle y en la tabla. */
export function GraficoProductos({ productos }: { productos: readonly ProductoTop[] }) {
  const sinAnimacion = useMediaQuery(MOVIMIENTO_REDUCIDO);
  return (
    <ResponsiveContainer width="100%" height={productos.length * ALTO_FILA + 8}>
      <BarChart data={[...productos]} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nombre" width={150} tickLine={false} axisLine={false} tick={TICK_CATEGORIA} tickFormatter={abreviar} interval={0} />
        <Tooltip content={<DetalleProducto />} cursor={{ fill: 'var(--color-surface-alt)' }} />
        <Bar dataKey="cantidad_vendida" fill="var(--color-primary)" radius={4} barSize={16} isAnimationActive={!sinAnimacion}>
          <LabelList dataKey="cantidad_vendida" position="right" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--color-text)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
