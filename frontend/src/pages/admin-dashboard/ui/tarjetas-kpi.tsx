import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatearCantidad, type ResumenVentas } from '@/entities/estadistica';
import { formatearPrecio } from '@/entities/producto';
import { aApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { EstadoError, Icon, type IconName } from '@/shared/ui';

interface TarjetaProps {
  icono: IconName;
  titulo: string;
  valor: string;
  nota: string;
}

function Tarjeta({ icono, titulo, valor, nota }: TarjetaProps) {
  return (
    <div className="kpi">
      <span className="kpi-ico" aria-hidden="true">
        <Icon name={icono} />
      </span>
      <span className="kpi-tit">{titulo}</span>
      <span className="kpi-val">{valor}</span>
      <span className="kpi-nota">{nota}</span>
    </div>
  );
}

function EsqueletoTarjetas() {
  return (
    <div className="kpis" role="status" aria-busy="true" aria-label="Cargando indicadores">
      {[0, 1, 2, 3].map((indice) => (
        <div key={indice} className="kpi">
          <span className="skel sk-ico" />
          <span className="skel skel-line" style={{ width: '50%' }} />
          <span className="skel sk-val" />
          <span className="skel skel-line" style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

export interface TarjetasKpiProps {
  consulta: UseQueryResult<ResumenVentas>;
}

/** Cuatro indicadores del resumen: ventas, ingresos y ticket del período, y los pedidos activos de ahora (enlace a la gestión de pedidos). */
export function TarjetasKpi({ consulta }: TarjetasKpiProps) {
  const { data } = consulta;
  if (data === undefined) {
    return consulta.isError ? (
      <EstadoError titulo="No pudimos cargar los indicadores" detalle={aApiError(consulta.error).detail} onReintentar={() => void consulta.refetch()} />
    ) : (
      <EsqueletoTarjetas />
    );
  }
  return (
    <div className="kpis" role="group" aria-label="Indicadores del período">
      <Tarjeta icono="pedidos" titulo="Ventas" valor={formatearCantidad(data.ventas)} nota="pedidos vendidos en el período" />
      <Tarjeta icono="efectivo" titulo="Ingresos" valor={formatearPrecio(data.ingresos)} nota="facturado en el período" />
      <Tarjeta icono="ticket" titulo="Ticket promedio" valor={formatearPrecio(data.ticket_promedio)} nota="por pedido vendido" />
      <Link to={RUTAS.gestionPedidos} className="kpi kpi-link">
        <span className="kpi-ico" aria-hidden="true">
          <Icon name="gestion" />
        </span>
        <span className="kpi-tit">Pedidos activos</span>
        <span className="kpi-val">{formatearCantidad(data.pedidos_activos)}</span>
        <span className="kpi-nota">ahora, sin importar el período</span>
        <span className="kpi-go">
          Ver pedidos
          <Icon name="flecha" />
        </span>
      </Link>
    </div>
  );
}
