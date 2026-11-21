import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { selectLineas, selectTotalPrecio, useCartStore } from '@/entities/cart';
import { direccionQueries } from '@/entities/direccion';
import { clasificarErrorCreacion, FORMAS_PAGO, totalEstimado, useCrearPedido, type FormaPagoCodigo } from '@/entities/pedido';
import { esApiError } from '@/shared/api';
import { RUTAS, rutaPedidoCreado } from '@/shared/config';
import { useUiStore } from '@/shared/model';
import { Icon } from '@/shared/ui';
import { armarPedido } from '../model';
import { AvisoErrorPedido } from './aviso-error-pedido';
import { CampoNotas } from './campo-notas';
import { PasoEntrega } from './paso-entrega';
import { PasoFormaPago } from './paso-forma-pago';
import { ResumenPedido } from './resumen-pedido';

const ERROR_FORMA_PAGO = 'Elegí una forma de pago.';
const ERROR_ENTREGA = 'Elegí dónde lo recibís.';

/** Primer error de texto de un campo, solo después de tocarlo (o de intentar enviar). */
const errorVisible = (meta: { isTouched: boolean; errors: readonly unknown[] }): string | undefined =>
  meta.isTouched ? meta.errors.find((error): error is string => typeof error === 'string') : undefined;

/**
 * Finalizar compra (US-017): elegir entrega y forma de pago, ver el total estimado y crear el pedido `PENDIENTE` con un
 * único `POST /pedidos/`. Ante un rechazo conserva el carrito y las elecciones; al crearlo vacía el carrito y navega a la confirmación.
 */
export function FinalizarCompraPage() {
  const lineas = useCartStore(selectLineas);
  const subtotal = useCartStore(selectTotalPrecio);
  const navigate = useNavigate();
  const crear = useCrearPedido();
  const cliente = useQueryClient();
  const pasoEntregaRef = useRef<HTMLElement>(null);
  const grupoPagoRef = useRef<HTMLFieldSetElement>(null);
  // `enviando` evita un doble envío; con el pedido creado (`crear.isSuccess`) el carrito vacío es a propósito, no «volver al carrito».
  const enviando = useRef(false);
  // Tras rechazar la dirección no se preselecciona otra: el cliente tiene que elegir una a propósito. La marca va en un ref
  // (síncrona, se escribe antes de tocar el formulario) y en estado (para apagar el selector): así ninguna preselección
  // automática puede colarse entre el rechazo y el próximo render, sin depender del orden en que React aplique las actualizaciones.
  const entregaRechazada = useRef(false);
  const [eligeElCliente, setEligeElCliente] = useState(false);

  const form = useForm({
    defaultValues: {
      direccionId: undefined as number | null | undefined,
      formaPago: '' as FormaPagoCodigo | '',
      notas: '',
    },
    onSubmit: async ({ value }) => {
      const { direccionId, formaPago, notas } = value;
      if (enviando.current || entregaRechazada.current || direccionId === undefined || formaPago === '') return;
      enviando.current = true;
      try {
        const pedido = await crear.mutateAsync(armarPedido({ direccionId, formaPago, notas }, lineas));
        // Primero navegar y después vaciar: así la guarda «carrito vacío → /carrito» no se adelanta a la confirmación.
        void navigate(rutaPedidoCreado(pedido.id), { state: { totalEstimado: totalEstimado(subtotal) } });
        useCartStore.getState().vaciar();
        useUiStore.getState().notificar({ tipo: 'success', titulo: `Pedido #${pedido.id} creado` });
      } catch (error) {
        // El rechazo queda en `crear.error` y lo dibuja el aviso; cualquier otra cosa es un bug.
        if (!esApiError(error)) throw error;
        // La dirección ya no es del cliente (o fue dada de baja): se vuelven a pedir, se limpia la elección y no se
        // preselecciona otra en silencio; el aviso queda hasta que el cliente elija una entrega.
        if (clasificarErrorCreacion(error) === 'entrega') {
          entregaRechazada.current = true;
          setEligeElCliente(true);
          form.setFieldValue('direccionId', undefined, { dontValidate: true });
          void cliente.invalidateQueries({ queryKey: direccionQueries.todas() });
        }
      } finally {
        enviando.current = false;
      }
    },
    onSubmitInvalid: () => {
      if (form.getFieldValue('direccionId') === undefined) pasoEntregaRef.current?.focus();
      else if (form.getFieldValue('formaPago') === '') grupoPagoRef.current?.focus();
    },
  });

  if (lineas.length === 0 && !crear.isSuccess) return <Navigate to={RUTAS.carrito} replace />;

  const errorCrear = crear.isError && esApiError(crear.error) ? crear.error : null;
  const formaPagoRechazada = errorCrear !== null && clasificarErrorCreacion(errorCrear) === 'forma-pago';
  const pendiente = crear.isPending;
  const olvidarError = (): void => {
    if (crear.isError) crear.reset();
  };

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6">
      <Link className="back-link" to={RUTAS.carrito}>
        <Icon name="volver" />
        Volver al carrito
      </Link>
      <header className="page-head">
        <h1 className="text-2xl">Finalizar compra</h1>
        <p>Elegí cómo lo recibís y cómo pagás.</p>
      </header>
      <form
        className="checkout"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="steps">
          {errorCrear === null || pendiente ? null : (
            <AvisoErrorPedido
              error={errorCrear}
              onReintentar={() => void form.handleSubmit()}
              onElegirOtraFormaPago={() => grupoPagoRef.current?.focus()}
              onElegirOtraEntrega={() => pasoEntregaRef.current?.focus()}
            />
          )}
          <fieldset className="steps-campos" disabled={pendiente}>
            <form.Field
              name="direccionId"
              validators={{
                onMount: ({ value }) => (value === undefined ? ERROR_ENTREGA : undefined),
                onChange: ({ value }) => (value === undefined ? ERROR_ENTREGA : undefined),
                // Tras un rechazo de la dirección se limpia la elección (sin validar, para no duplicar el aviso) y el envío debe volver a pedirla.
                onSubmit: ({ value }) => (value === undefined ? ERROR_ENTREGA : undefined),
              }}
            >
              {(campo) => {
                const error = errorVisible(campo.state.meta);
                return (
                  <PasoEntrega
                    seccionRef={pasoEntregaRef}
                    valor={campo.state.value}
                    autoSeleccionar={!eligeElCliente}
                    onCambiar={(valor, origen) => {
                      // Solo la elección del usuario descarta el aviso; la preselección automática no, y mientras la
                      // entrega está rechazada se ignora por completo: confirmar exige una elección explícita.
                      if (origen === 'automatico' && entregaRechazada.current) return;
                      if (origen === 'usuario') {
                        entregaRechazada.current = false;
                        olvidarError();
                        setEligeElCliente(false);
                      }
                      campo.handleChange(valor);
                    }}
                    {...(error === undefined ? {} : { error })}
                  />
                );
              }}
            </form.Field>
            <form.Field
              name="formaPago"
              validators={{
                onMount: ({ value }) => (value === '' ? ERROR_FORMA_PAGO : undefined),
                onChange: ({ value }) => (value === '' ? ERROR_FORMA_PAGO : undefined),
              }}
            >
              {(campo) => {
                const rechazada = formaPagoRechazada
                  ? `${FORMAS_PAGO.find((forma) => forma.codigo === campo.state.value)?.etiqueta ?? 'La forma de pago elegida'} no está disponible ahora. Elegí otra forma de pago.`
                  : undefined;
                const error = rechazada ?? errorVisible(campo.state.meta);
                return (
                  <PasoFormaPago
                    valor={campo.state.value}
                    grupoRef={grupoPagoRef}
                    onCambiar={(codigo) => {
                      olvidarError();
                      campo.handleChange(codigo);
                    }}
                    {...(error === undefined ? {} : { error })}
                  />
                );
              }}
            </form.Field>
            <form.Field name="notas">
              {(campo) => (
                <CampoNotas
                  valor={campo.state.value}
                  onCambiar={(valor) => {
                    olvidarError();
                    campo.handleChange(valor);
                  }}
                />
              )}
            </form.Field>
          </fieldset>
        </div>
        <form.Subscribe selector={(estado) => estado.values.direccionId === null}>
          {(retiro) => <ResumenPedido lineas={lineas} subtotal={subtotal} retiro={retiro} pendiente={pendiente} />}
        </form.Subscribe>
      </form>
    </div>
  );
}
