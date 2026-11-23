import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { estadisticaQueries, hoyUtc } from '@/entities/estadistica';
import { EncabezadoPagina, MarcaActualizacion } from '@/shared/ui';
import { aParametros, leerPeriodo, type PeriodoDashboard } from '../model';
import { BloqueEstados, BloqueFormasPago, BloqueProductos, BloqueVentas } from './bloques-dashboard';
import { SelectorPeriodo } from './selector-periodo';
import { TarjetasKpi } from './tarjetas-kpi';

/** Dashboard de métricas (US-028, solo ADMIN): período en la URL, tarjetas KPI y gráficos; cada reporte carga por su cuenta. */
export function AdminDashboardPage() {
  const [parametros, setParametros] = useSearchParams();
  const hoy = hoyUtc();
  const periodo = leerPeriodo(parametros, hoy);
  const { rango, agrupacion } = periodo;
  const resumen = useQuery(estadisticaQueries.resumen(rango));
  const ventas = useQuery(estadisticaQueries.ventas(rango, agrupacion));
  const productos = useQuery(estadisticaQueries.productosTop(rango));
  const estados = useQuery(estadisticaQueries.pedidosPorEstado(rango));
  const ingresos = useQuery(estadisticaQueries.ingresos(rango));

  const consultas = [resumen, ventas, productos, estados, ingresos];
  const actualizando = consultas.some((consulta) => consulta.isFetching);
  const hayDatos = consultas.some((consulta) => consulta.data !== undefined);
  // Cuándo llegó lo último: 0 mientras ningún reporte del período llegó (la marca no muestra la hora antes de la primera respuesta).
  const actualizadoEn = Math.max(...consultas.map((consulta) => consulta.dataUpdatedAt));
  const actualizar = (): void => {
    for (const consulta of consultas) void consulta.refetch();
  };

  const cambiarPeriodo = (siguiente: PeriodoDashboard): void => setParametros(aParametros(siguiente, hoy));

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoPagina
        fijo
        herramientasColapsables
        eyebrow="Administración"
        titulo="Dashboard"
        subtitulo="Cómo viene el negocio: ventas, productos y pedidos del período."
        acciones={<MarcaActualizacion actualizadoEn={actualizadoEn} actualizando={actualizando} onActualizar={actualizar} />}
        herramientas={<SelectorPeriodo periodo={periodo} hoy={hoy} onCambiar={cambiarPeriodo} />}
      />
      <div className="page-body flex flex-col gap-5">
        <TarjetasKpi consulta={resumen} />
        <div className={actualizando && hayDatos ? 'grilla is-stale' : 'grilla'} aria-busy={actualizando}>
          <BloqueVentas consulta={ventas} rango={rango} agrupacion={agrupacion} />
          <BloqueProductos consulta={productos} />
          <BloqueEstados consulta={estados} rango={rango} />
          <BloqueFormasPago consulta={ingresos} />
        </div>
      </div>
    </div>
  );
}
