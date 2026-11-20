import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { PedidosEstado } from '@/entities/estadistica';
import { colorEstado, etiquetaEstado } from '@/entities/pedido';
import { useMediaQuery } from '@/shared/lib';
import { MOVIMIENTO_REDUCIDO, PANTALLA_ANGOSTA, TICK_CATEGORIA, TICK_EJE } from './estilo-grafico';

interface BarraEstado {
  codigo: string;
  nombre: string;
  cantidad: number;
}

function DetalleEstado({ active, payload }: TooltipProps<number, string>) {
  const barra = (payload?.[0] as { payload?: BarraEstado } | undefined)?.payload;
  if (active !== true || barra === undefined) return null;
  return (
    <div className="tip">
      <strong>{barra.nombre}</strong>
      <span>{`${String(barra.cantidad)} ${barra.cantidad === 1 ? 'pedido' : 'pedidos'}`}</span>
    </div>
  );
}

/** Pedidos por estado: barras con el color del distintivo de cada estado; verticales en pantallas anchas y horizontales en las angostas. */
export function GraficoEstados({ estados }: { estados: readonly PedidosEstado[] }) {
  const sinAnimacion = useMediaQuery(MOVIMIENTO_REDUCIDO);
  const angosta = useMediaQuery(PANTALLA_ANGOSTA);
  const barras: BarraEstado[] = estados.map(({ estado_codigo, cantidad }) => ({ codigo: estado_codigo, nombre: etiquetaEstado(estado_codigo), cantidad }));
  const celdas = barras.map((barra) => <Cell key={barra.codigo} fill={colorEstado(barra.codigo)} />);
  const etiquetaValor = { fontSize: 12, fontWeight: 700, fill: 'var(--color-text)' } as const;

  return angosta ? (
    <ResponsiveContainer width="100%" height={barras.length * 38 + 8}>
      <BarChart data={barras} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nombre" width={112} tickLine={false} axisLine={false} tick={TICK_CATEGORIA} interval={0} />
        <Tooltip content={<DetalleEstado />} cursor={{ fill: 'var(--color-surface-alt)' }} />
        <Bar dataKey="cantidad" radius={4} barSize={20} isAnimationActive={!sinAnimacion}>
          {celdas}
          <LabelList dataKey="cantidad" position="right" style={etiquetaValor} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={barras} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="nombre" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} tick={TICK_EJE} interval={0} />
        <YAxis hide />
        <Tooltip content={<DetalleEstado />} cursor={{ fill: 'var(--color-surface-alt)' }} />
        <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={52} minPointSize={3} isAnimationActive={!sinAnimacion}>
          {celdas}
          <LabelList dataKey="cantidad" position="top" style={etiquetaValor} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
