import { Cell, Pie, PieChart } from 'recharts';
import { aNumero } from '@/entities/estadistica';
import { formatearPrecio } from '@/entities/producto';
import { useMediaQuery } from '@/shared/lib';
import { MOVIMIENTO_REDUCIDO } from './estilo-grafico';

/** Fila ya calculada de una forma de pago: nombre visible, importe, porcentaje entero y color. */
export interface FilaFormaPago {
  codigo: string;
  nombre: string;
  total: string;
  porcentaje: number;
}

/** Color de cada forma de pago (tokens del design system); un código desconocido usa el gris neutro. */
const COLOR_FORMA_PAGO: Readonly<Record<string, string>> = {
  MERCADOPAGO: 'var(--color-primary)',
  EFECTIVO: 'var(--color-accent)',
  TRANSFERENCIA: 'var(--color-info)',
};

export const colorFormaPago = (codigo: string): string => COLOR_FORMA_PAGO[codigo] ?? 'var(--color-text-muted)';

const LADO = 176;

export interface GraficoFormasPagoProps {
  filas: readonly FilaFormaPago[];
  /** Total del período ya formateado («$ 2.000»), que va en el centro de la dona. */
  totalFormateado: string;
}

/** Ingresos por forma de pago: dona con el total al centro y leyenda con importe y porcentaje. */
export function GraficoFormasPago({ filas, totalFormateado }: GraficoFormasPagoProps) {
  const sinAnimacion = useMediaQuery(MOVIMIENTO_REDUCIDO);
  const sectores = filas.filter((fila) => aNumero(fila.total) > 0).map((fila) => ({ ...fila, valor: aNumero(fila.total) }));
  return (
    <div className="pagos">
      <div className="dona-box">
        <PieChart width={LADO} height={LADO}>
          <Pie data={sectores} dataKey="valor" nameKey="nombre" innerRadius={52} outerRadius={80} paddingAngle={sectores.length > 1 ? 2 : 0} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={!sinAnimacion}>
            {sectores.map((sector) => (
              <Cell key={sector.codigo} fill={colorFormaPago(sector.codigo)} />
            ))}
          </Pie>
        </PieChart>
        <div className="dona-centro">
          <span>Total</span>
          <strong>{totalFormateado}</strong>
        </div>
      </div>
      <ul className="leyenda">
        {filas.map((fila) => (
          <li key={fila.codigo}>
            <span className="sw" style={{ background: colorFormaPago(fila.codigo) }} />
            <span className="ln">
              <strong>{fila.nombre}</strong>
              <small>{formatearPrecio(fila.total)}</small>
            </span>
            <span className="pct">{`${String(fila.porcentaje)} %`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
