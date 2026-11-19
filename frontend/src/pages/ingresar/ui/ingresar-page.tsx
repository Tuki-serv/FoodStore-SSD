import { useForm } from '@tanstack/react-form';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIniciarSesion } from '@/entities/session';
import { esApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { Campo, claseBoton, Icon, TarjetaAuth } from '@/shared/ui';
import { avisoDeErrorIngreso, validarCampo, type AvisoIngreso, type CampoIngreso } from '../model';

/** Estado que `/registrarse` deja al llevar a `/ingresar` cuando la cuenta se creó pero el login automático falló (DU-1). */
interface EstadoCuentaCreada {
  email: string;
}

function leerCuentaCreada(state: unknown): EstadoCuentaCreada | null {
  if (typeof state !== 'object' || state === null) return null;
  const { cuentaCreada, email } = state as { cuentaCreada?: unknown; email?: unknown };
  return cuentaCreada === true && typeof email === 'string' ? { email } : null;
}

interface DefinicionCampo {
  nombre: CampoIngreso;
  etiqueta: string;
  tipo: 'email' | 'password';
  autoComplete: string;
  placeholder?: string;
}

const CAMPOS: readonly DefinicionCampo[] = [
  { nombre: 'email', etiqueta: 'Email', tipo: 'email', autoComplete: 'email', placeholder: 'nombre@ejemplo.com' },
  { nombre: 'password', etiqueta: 'Contraseña', tipo: 'password', autoComplete: 'current-password' },
];

/** Reloj del navegador (ms): fuera del componente, porque se lee al responder un pedido y no al dibujar. */
const ahora = (): number => Date.now();

/** Ingreso con email y contraseña (US-001): formulario con TanStack Form; la navegación posterior la resuelve el guard de rutas anónimas. */
export function IngresarPage() {
  const location = useLocation();
  const cuentaCreada = leerCuentaCreada(location.state);
  const iniciar = useIniciarSesion();
  const [aviso, setAviso] = useState<AvisoIngreso | null>(null);
  const [bloqueoHasta, setBloqueoHasta] = useState<number | null>(null);
  const enviando = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formularioRef = useRef<HTMLFormElement>(null);

  // El bloqueo termina solo cuando se cumple el tiempo de espera: «Ingresar» vuelve a estar habilitado.
  useEffect(() => {
    if (bloqueoHasta === null) return undefined;
    const espera = Math.max(0, bloqueoHasta - Date.now());
    const temporizador = setTimeout(() => setBloqueoHasta(null), espera);
    return () => clearTimeout(temporizador);
  }, [bloqueoHasta]);

  // Tras registrarse (login automático fallido) el email ya está y falta solo la contraseña.
  useEffect(() => {
    if (cuentaCreada !== null) passwordRef.current?.focus();
  }, [cuentaCreada]);

  const form = useForm({
    defaultValues: { email: cuentaCreada?.email ?? '', password: '' },
    onSubmit: async ({ value }) => {
      // Guarda síncrona: dos clics seguidos llegan antes de que el botón se deshabilite.
      if (enviando.current) return;
      enviando.current = true;
      setAviso(null);
      setBloqueoHasta(null);
      try {
        await iniciar.mutateAsync(value);
      } catch (error) {
        if (!esApiError(error)) throw error;
        const siguiente = avisoDeErrorIngreso(error, ahora());
        setAviso(siguiente);
        setBloqueoHasta(siguiente.bloqueoHasta);
        if (siguiente.limpiarPassword) form.resetField('password');
      } finally {
        enviando.current = false;
      }
    },
    onSubmitInvalid: () => {
      formularioRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    },
  });

  const pendiente = iniciar.isPending;
  const bloqueado = bloqueoHasta !== null;

  return (
    <TarjetaAuth
      titulo="Ingresar"
      descripcion="Entrá con tu email para hacer pedidos y seguir su estado."
      pie={
        <>
          ¿No tenés cuenta?{' '}
          <Link to={RUTAS.registrarse} {...(location.state === null ? {} : { state: location.state })}>
            Registrate
          </Link>
        </>
      }
    >
      <form
        ref={formularioRef}
        className="auth-form"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {cuentaCreada === null ? null : (
          <div className="ok-box" role="status">
            <Icon name="exito" />
            <div>
              Tu cuenta se creó.
              <p>Ingresá para continuar.</p>
            </div>
          </div>
        )}
        {aviso === null ? null : aviso.tipo === 'bloqueo' ? (
          <div className="notice" role="alert">
            <Icon name="reloj" />
            <div>
              {aviso.titulo}
              {aviso.detalle === undefined ? null : <p>{aviso.detalle}</p>}
            </div>
          </div>
        ) : (
          <div className="form-alert" role="alert">
            <Icon name="alerta" />
            <div>
              {aviso.titulo}
              {aviso.detalle === undefined ? null : <p>{aviso.detalle}</p>}
            </div>
          </div>
        )}
        {CAMPOS.map(({ nombre, etiqueta, tipo, autoComplete, placeholder }) => (
          <form.Field
            key={nombre}
            name={nombre}
            validators={{
              // Siempre al día (también al montar): `handleSubmit` no envía con campos inválidos y, al intentarlo, los marca como tocados.
              onMount: ({ value }) => validarCampo(nombre, value),
              onChange: ({ value }) => validarCampo(nombre, value),
              onBlur: ({ value }) => validarCampo(nombre, value),
            }}
          >
            {(campo) => {
              const error = campo.state.meta.isTouched ? campo.state.meta.errors.find((e): e is string => typeof e === 'string') : undefined;
              return (
                <Campo etiqueta={etiqueta} {...(error === undefined ? {} : { error })}>
                  {(control) => (
                    <input
                      {...control}
                      ref={nombre === 'password' ? passwordRef : undefined}
                      className="input"
                      name={campo.name}
                      type={tipo}
                      autoComplete={autoComplete}
                      {...(placeholder === undefined ? {} : { placeholder })}
                      disabled={pendiente}
                      value={campo.state.value}
                      onBlur={campo.handleBlur}
                      onChange={(evento) => campo.handleChange(evento.target.value)}
                    />
                  )}
                </Campo>
              );
            }}
          </form.Field>
        ))}
        <button type="submit" className={`${claseBoton('primario')} btn-block`} disabled={pendiente || bloqueado}>
          {pendiente ? (
            <>
              <span className="spinner-sm" aria-hidden="true" />
              Ingresando…
            </>
          ) : (
            'Ingresar'
          )}
        </button>
      </form>
    </TarjetaAuth>
  );
}
