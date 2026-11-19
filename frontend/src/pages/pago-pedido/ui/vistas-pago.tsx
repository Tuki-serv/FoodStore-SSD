import type { ReactNode, Ref } from 'react';
import { Link } from 'react-router-dom';
import { formatearPrecio } from '@/entities/producto';
import type { PedidoDetalle } from '@/entities/pedido';
import { rutaPedidoCreado, RUTAS } from '@/shared/config';
import { claseBoton, Icon, type IconName } from '@/shared/ui';

export const CONTENEDOR = 'mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6';

type TonoCabecera = 'normal' | 'ok' | 'bad' | 'warn' | 'wait';

/** Cabecera de la página: el único `h1`, enfocable para anunciar cada cambio de vista. */
export function CabeceraPago({ tono, icono, titulo, texto, foco }: { tono: TonoCabecera; icono: IconName; titulo: string; texto?: ReactNode; foco: Ref<HTMLHeadingElement> }) {
  return (
    <div className={`pay-head ${tono}`}>
      <span className="badge-ico" aria-hidden="true">
        <Icon name={icono} />
      </span>
      <div>
        <h1 ref={foco} tabIndex={-1}>
          {titulo}
        </h1>
        {texto === undefined ? null : <p>{texto}</p>}
      </div>
    </div>
  );
}

export function TarjetaPago({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="pcard" aria-labelledby="pago-tarjeta-titulo">
      <h2 id="pago-tarjeta-titulo">{titulo}</h2>
      {children}
    </section>
  );
}

export function EnlaceVerPedido({ pedidoId }: { pedidoId: number }) {
  return (
    <Link className={claseBoton('secundario')} to={rutaPedidoCreado(pedidoId)}>
      <Icon name="pedidos" />
      Ver mi pedido
    </Link>
  );
}

export function EnlaceSeguirComprando() {
  return (
    <Link className={claseBoton('fantasma')} to={RUTAS.catalogo}>
      Seguir comprando
    </Link>
  );
}

/** Pantalla de un solo mensaje (no corresponde pagar / no encontrado): `h1` + texto + acciones. */
export function EstadoUnico({ icono, titulo, texto, foco, children }: { icono: IconName; titulo: string; texto: string; foco: Ref<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <div className={CONTENEDOR}>
      <section className="state empty" aria-labelledby="pago-estado-titulo">
        <span className="badge-ico" aria-hidden="true">
          <Icon name={icono} className="h-[30px] w-[30px]" />
        </span>
        <h1 id="pago-estado-titulo" ref={foco} tabIndex={-1} className="text-xl">
          {titulo}
        </h1>
        <p>{texto}</p>
        <div className="done-actions">{children}</div>
      </section>
    </div>
  );
}

export function PagoPendiente({ pedido }: { pedido: PedidoDetalle }) {
  return (
    <TarjetaPago titulo="Pago en proceso">
      <p>
        Mercado Pago todavía no confirmó el pago. Esta pantalla no se actualiza sola: podés ver el estado de tu pedido desde «Ver mi pedido».
      </p>
      <div className="info-box" role="status">
        <Icon name="info" />
        <div>
          <strong>No lo pagues de nuevo</strong>
          Si el pago se aprueba, el pedido se confirma solo.
        </div>
      </div>
      <div className="pay-actions">
        <EnlaceVerPedido pedidoId={pedido.id} />
      </div>
    </TarjetaPago>
  );
}

export function PagoADevolver({ pedido }: { pedido: PedidoDetalle }) {
  return (
    <TarjetaPago titulo="¿Qué pasa con tu dinero?">
      <p>{`Te devolvemos los ${formatearPrecio(pedido.total)}. La devolución la gestiona el equipo del local de forma manual, por eso puede demorar unos días.`}</p>
      <div className="info-box" role="status">
        <Icon name="info" />
        <div>
          <strong>No tenés que hacer nada</strong>
          No vuelvas a pagar este pedido: ya no se puede cobrar.
        </div>
      </div>
      <div className="pay-actions">
        <EnlaceVerPedido pedidoId={pedido.id} />
        <EnlaceSeguirComprando />
      </div>
    </TarjetaPago>
  );
}

export function PagoAprobado({ pedido, numeroOperacion }: { pedido: PedidoDetalle; numeroOperacion: string | null }) {
  return (
    <TarjetaPago titulo="Pago">
      <dl className="kv">
        <dt>Estado del pago</dt>
        <dd>
          <span className="badge b-aprobado">Aprobado</span>
        </dd>
        <dt>Monto</dt>
        <dd>{formatearPrecio(pedido.total)}</dd>
        <dt>Medio</dt>
        <dd>
          <span className="pay-lbl">
            <Icon name="tarjeta" />
            Tarjeta (Mercado Pago)
          </span>
        </dd>
        {numeroOperacion === null ? null : (
          <>
            <dt>N.º de operación</dt>
            <dd>{numeroOperacion}</dd>
          </>
        )}
      </dl>
      <div className="pay-actions">
        <EnlaceVerPedido pedidoId={pedido.id} />
        <EnlaceSeguirComprando />
      </div>
    </TarjetaPago>
  );
}

export function MotivoRechazo({ motivo }: { motivo: string }) {
  return (
    <div className="reason" role="alert">
      <Icon name="alerta" />
      <div>
        <strong>Motivo</strong>
        <p>{motivo}</p>
      </div>
    </div>
  );
}

export function AvisoErrorPago({ titulo, texto, reintentar, children }: { titulo: string; texto?: string; reintentar?: () => void; children?: ReactNode }) {
  return (
    <div className="form-alert" role="alert">
      <Icon name="alerta" />
      <div>
        <strong>{titulo}</strong>
        {texto === undefined ? null : <p>{texto}</p>}
        <div className="alert-actions">
          {reintentar === undefined ? null : (
            <button type="button" className={claseBoton('primario', { compacto: true })} onClick={reintentar}>
              Reintentar
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
