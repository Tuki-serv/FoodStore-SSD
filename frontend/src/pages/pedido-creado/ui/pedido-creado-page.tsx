import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { textoPersonalizacion } from '@/entities/cart';
import { LineaEstadoPago, pagoQueries, PagoEnConfirmacion, TraspasoPago, vistaPagoDelPedido } from '@/entities/payment';
import { BadgeEstado, EtiquetaFormaPago, esConfirmacionManual, pedidoQueries, type PedidoDetalle } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { aCentavos } from '@/shared/lib';
import { RUTAS } from '@/shared/config';
import { claseBoton, EstadoError, Icon } from '@/shared/ui';
import { EntregaPedido } from './entrega-pedido';
import { PasosConfirmacionManual } from './pasos-confirmacion-manual';

const CONTENEDOR = 'mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6';

/** Total estimado que el checkout dejó en el estado de navegación (no sobrevive a una recarga); `null` si no está. */
function totalEstimadoDe(estado: unknown): string | null {
  if (typeof estado !== 'object' || estado === null) return null;
  const { totalEstimado } = estado as { totalEstimado?: unknown };
  return typeof totalEstimado === 'string' ? totalEstimado : null;
}

/** Subtítulo de la cabecera: qué falta según el pago (solo `MERCADOPAGO` pendiente de cobro). */
function textoCabecera(esperandoPago: boolean, estadoPago: string | null): string {
  if (!esperandoPago) return 'Lo vas a poder seguir desde «Mis pedidos».';
  if (estadoPago === 'pendiente') return 'Estamos esperando la confirmación de Mercado Pago.';
  if (estadoPago === 'aprobado' || estadoPago === 'a_devolver') return 'Lo vas a poder seguir desde «Mis pedidos».';
  return 'Falta un paso: pagalo con tarjeta para que se confirme.';
}

function PedidoNoEncontrado() {
  return (
    <div className={CONTENEDOR}>
      <section className="state empty" aria-labelledby="no-encontrado-titulo">
        <span className="badge-ico" aria-hidden="true">
          <Icon name="pedidos" className="h-[30px] w-[30px]" />
        </span>
        <h1 id="no-encontrado-titulo" className="text-xl">
          No encontramos este pedido
        </h1>
        <p>Puede que el enlace esté mal o que el pedido no sea de tu cuenta.</p>
        <div className="done-actions">
          <Link className={claseBoton('primario')} to={RUTAS.catalogo}>
            Ver catálogo
          </Link>
          <Link className={claseBoton('secundario')} to={RUTAS.misPedidos}>
            Ver mis pedidos
          </Link>
        </div>
      </section>
    </div>
  );
}

function Contenido({ pedido, totalEstimado }: { pedido: PedidoDetalle; totalEstimado: string | null }) {
  const pendiente = pedido.estado_codigo === 'PENDIENTE';
  const pagaConTarjeta = pedido.forma_pago_codigo === 'MERCADOPAGO';
  const preciosCambiaron = totalEstimado !== null && aCentavos(totalEstimado) !== aCentavos(pedido.total);
  // Último intento de pago (US-026): solo para tarjeta; sin polling, la página de pago es la que sigue el pendiente.
  const consultaPago = useQuery({ ...pagoQueries.estado(pedido.id), enabled: pagaConTarjeta });
  const pago = consultaPago.data;
  const estadoPago = pago?.estado ?? null;
  const vistaPago = vistaPagoDelPedido(pedido, pago ?? null, { consultando: pagaConTarjeta && consultaPago.isPending });

  return (
    <div className={CONTENEDOR}>
      <div className="done">
        <div className="done-head">
          <span className="badge-ico" aria-hidden="true">
            <Icon name="exito" />
          </span>
          <div>
            <h1>{`Pedido #${pedido.id} recibido`}</h1>
            <p>{textoCabecera(pagaConTarjeta && pendiente, estadoPago)}</p>
          </div>
        </div>
        {preciosCambiaron ? (
          <div className="info-box warn" role="status">
            <Icon name="alerta" />
            <div>
              <strong>Los precios se actualizaron</strong>
              {`El total quedó en ${formatearPrecio(pedido.total)} (estimado: ${formatearPrecio(totalEstimado)}) porque algún producto cambió de precio. Si no te sirve, podés cancelar el pedido desde «Mis pedidos» mientras esté pendiente.`}
            </div>
          </div>
        ) : null}
        <div className="done-grid">
          <div className="done-col">
            {vistaPago === 'traspaso' || vistaPago === 'reintento' ? <TraspasoPago pedidoId={pedido.id} total={formatearPrecio(pedido.total)} reintento={vistaPago === 'reintento'} /> : null}
            {vistaPago === 'en-confirmacion' ? <PagoEnConfirmacion pedidoId={pedido.id} /> : null}
            {esConfirmacionManual(pedido.forma_pago_codigo) && pendiente ? <PasosConfirmacionManual formaPago={pedido.forma_pago_codigo} /> : null}
            <section className="pcard" aria-labelledby="detalle-titulo">
              <h2 id="detalle-titulo">Detalle</h2>
              <dl className="kv">
                <dt>Estado</dt>
                <dd>
                  <BadgeEstado codigo={pedido.estado_codigo} />
                </dd>
                {pago !== undefined && pago.estado !== null ? <LineaEstadoPago pago={{ ...pago, estado: pago.estado }} /> : null}
                <dt>Entrega</dt>
                <dd>
                  <EntregaPedido direccionId={pedido.direccion_id} />
                </dd>
                <dt>Forma de pago</dt>
                <dd>
                  <EtiquetaFormaPago codigo={pedido.forma_pago_codigo} />
                </dd>
                {pedido.notas === null ? null : (
                  <>
                    <dt>Notas</dt>
                    <dd>{pedido.notas}</dd>
                  </>
                )}
              </dl>
            </section>
          </div>
          <aside className="summary" aria-labelledby="pedido-resumen-titulo">
            <h2 id="pedido-resumen-titulo">{`Pedido #${pedido.id}`}</h2>
            <ul className="sum-items" aria-label="Productos del pedido">
              {pedido.items.map((item) => {
                const personalizacion = textoPersonalizacion({
                  personalizacion: item.personalizacion ?? [],
                  personalizacionNombres: item.personalizacion_snapshot ?? [],
                });
                return (
                  <li key={`${item.producto_id}:${(item.personalizacion ?? []).join(',')}`}>
                    <span className="q">{item.cantidad} ×</span>
                    <span className="n">
                      {item.nombre_snapshot}
                      {personalizacion === null ? null : <small>{personalizacion}</small>}
                    </span>
                    <span>{formatearPrecio(item.subtotal_snapshot)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="line">
              <span>Subtotal</span>
              <span>{formatearPrecio(pedido.subtotal)}</span>
            </div>
            <div className="line">
              <span>Costo de envío</span>
              <span>{formatearPrecio(pedido.costo_envio)}</span>
            </div>
            <div className="line">
              <span>Descuento</span>
              <span>{formatearPrecio(pedido.descuento)}</span>
            </div>
            <div className="total">
              <span>Total</span>
              <span>{formatearPrecio(pedido.total)}</span>
            </div>
            <p className="sum-note">
              <Icon name="alerta" />
              <span>Si algún producto se agota antes de que se confirme, el pedido puede cancelarse por falta de stock.</span>
            </p>
          </aside>
        </div>
        <div className="done-actions">
          <Link className={claseBoton('secundario')} to={RUTAS.misPedidos}>
            <Icon name="pedidos" />
            Ver mis pedidos
          </Link>
          <Link className={claseBoton('fantasma')} to={RUTAS.catalogo}>
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmación del pedido creado (`/finalizar-compra/pedido/:pedidoId`). Lee el pedido de la caché que sembró la creación
 * (sin pedirlo de nuevo) o, al recargar, de `GET /pedidos/{id}`. Según la forma de pago explica la confirmación manual (DD-22)
 * o entrega el pedido al pago con tarjeta (C-20).
 */
export function PedidoCreadoPage() {
  const { pedidoId } = useParams();
  const { state } = useLocation();
  const id = Number(pedidoId);
  const idValido = Number.isInteger(id) && id > 0;
  const consulta = useQuery({ ...pedidoQueries.detalle(id), enabled: idValido });

  if (!idValido) return <PedidoNoEncontrado />;
  if (consulta.data !== undefined) return <Contenido pedido={consulta.data} totalEstimado={totalEstimadoDe(state)} />;
  if (consulta.isError) {
    if (consulta.error.status === 403 || consulta.error.status === 404) return <PedidoNoEncontrado />;
    return (
      <div className={CONTENEDOR}>
        <EstadoError titulo="No pudimos cargar el pedido" detalle={consulta.error.detail} onReintentar={() => void consulta.refetch()} />
      </div>
    );
  }
  return (
    <div className={CONTENEDOR}>
      <div role="status" aria-busy="true" aria-label="Cargando el pedido" className="grid gap-3">
        <div className="skel h-[56px]" />
        <div className="skel h-[180px]" />
      </div>
    </div>
  );
}
