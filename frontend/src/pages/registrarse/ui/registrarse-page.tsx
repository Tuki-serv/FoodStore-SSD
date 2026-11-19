import { useForm } from '@tanstack/react-form';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRegistrarse } from '@/entities/session';
import { esApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { Campo, claseBoton, Icon, TarjetaAuth } from '@/shared/ui';
import { aDatosRegistro, erroresDeRegistro, validarCampo, type CampoRegistro, type ErroresServidorRegistro, type ValoresRegistro } from '../model';

interface DefinicionCampo {
  nombre: CampoRegistro;
  etiqueta: string;
  tipo: 'text' | 'email' | 'tel' | 'password';
  autoComplete: string;
  opcional?: boolean;
  ayuda?: string;
  placeholder?: string;
}

/** Nombre y apellido comparten fila en desktop (`.auth-grid`); el resto va a una columna. */
const FILA_NOMBRES: readonly DefinicionCampo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', autoComplete: 'given-name' },
  { nombre: 'apellido', etiqueta: 'Apellido', tipo: 'text', autoComplete: 'family-name' },
];

const CAMPOS_RESTO: readonly DefinicionCampo[] = [
  { nombre: 'email', etiqueta: 'Email', tipo: 'email', autoComplete: 'email', placeholder: 'nombre@ejemplo.com' },
  { nombre: 'celular', etiqueta: 'Celular', tipo: 'tel', autoComplete: 'tel', opcional: true, ayuda: 'Para avisarte sobre tus pedidos.' },
  { nombre: 'password', etiqueta: 'Contraseña', tipo: 'password', autoComplete: 'new-password', ayuda: 'Al menos 8 caracteres.' },
  { nombre: 'confirmacion', etiqueta: 'Repetir contraseña', tipo: 'password', autoComplete: 'new-password' },
];

const VALORES_INICIALES: ValoresRegistro = { nombre: '', apellido: '', email: '', celular: '', password: '', confirmacion: '' };

const SIN_ERRORES_SERVIDOR: ErroresServidorRegistro = { campos: {}, emailDuplicado: false };

/** Registro de cliente (US-002): crea la cuenta y, con el 201, inicia sesión con las mismas credenciales (DU-1). */
export function RegistrarsePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const registrar = useRegistrarse();
  const [servidor, setServidor] = useState<ErroresServidorRegistro>(SIN_ERRORES_SERVIDOR);
  const enviando = useRef(false);
  const formularioRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: VALORES_INICIALES,
    onSubmit: async ({ value }) => {
      // Guarda síncrona: dos clics seguidos llegan antes de que el botón se deshabilite.
      if (enviando.current) return;
      enviando.current = true;
      setServidor(SIN_ERRORES_SERVIDOR);
      try {
        const resultado = await registrar.mutateAsync(aDatosRegistro(value));
        if (resultado.tipo === 'cuentaCreadaSinSesion') {
          const previo = typeof location.state === 'object' && location.state !== null ? (location.state as Record<string, unknown>) : {};
          void navigate(RUTAS.ingresar, { replace: true, state: { ...previo, email: resultado.email, cuentaCreada: true } });
        }
        // Con la sesión abierta, el guard de las rutas para visitantes lleva a la ruta recordada o al catálogo.
      } catch (error) {
        if (!esApiError(error)) throw error;
        setServidor(erroresDeRegistro(error));
      } finally {
        enviando.current = false;
      }
    },
    onSubmitInvalid: () => {
      formularioRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    },
  });

  const pendiente = registrar.isPending;

  const dibujarCampo = ({ nombre, etiqueta, tipo, autoComplete, opcional = false, ayuda, placeholder }: DefinicionCampo) => (
    <form.Field
      key={nombre}
      name={nombre}
      validators={{
        // Siempre al día (también al montar): `handleSubmit` no envía con campos inválidos y, al intentarlo, los marca como tocados.
        onMount: ({ value, fieldApi }) => validarCampo(nombre, value, fieldApi.form.state.values),
        onChange: ({ value, fieldApi }) => validarCampo(nombre, value, fieldApi.form.state.values),
        onBlur: ({ value, fieldApi }) => validarCampo(nombre, value, fieldApi.form.state.values),
        // La repetición se vuelve a medir cuando cambia la contraseña.
        ...(nombre === 'confirmacion' ? { onChangeListenTo: ['password' as const] } : {}),
      }}
    >
      {(campo) => {
        const errorLocal = campo.state.meta.isTouched ? campo.state.meta.errors.find((e): e is string => typeof e === 'string') : undefined;
        const errorServidor = servidor.campos[nombre];
        const mensaje = errorServidor ?? errorLocal;
        const error =
          mensaje === undefined ? undefined : errorServidor !== undefined && nombre === 'email' && servidor.emailDuplicado ? (
            <>
              {mensaje} <Link to={RUTAS.ingresar}>Ingresar</Link>
            </>
          ) : (
            mensaje
          );
        return (
          <Campo
            etiqueta={etiqueta}
            opcional={opcional}
            {...(ayuda === undefined ? {} : { ayuda })}
            {...(error === undefined ? {} : { error })}
          >
            {(control) => (
              <input
                {...control}
                className="input"
                name={campo.name}
                type={tipo}
                autoComplete={autoComplete}
                {...(placeholder === undefined ? {} : { placeholder })}
                disabled={pendiente}
                value={campo.state.value}
                onBlur={campo.handleBlur}
                onChange={(evento) => {
                  if (servidor.campos[nombre] !== undefined) setServidor(SIN_ERRORES_SERVIDOR);
                  campo.handleChange(evento.target.value);
                }}
              />
            )}
          </Campo>
        );
      }}
    </form.Field>
  );

  return (
    <TarjetaAuth
      titulo="Crear cuenta"
      descripcion="Registrate para hacer pedidos. Al terminar, entrás directo."
      ancha
      pie={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to={RUTAS.ingresar} {...(location.state === null ? {} : { state: location.state })}>
            Ingresá
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
        {servidor.alerta === undefined ? null : (
          <div className="form-alert" role="alert">
            <Icon name="alerta" />
            <div>
              No pudimos crear la cuenta
              <p>{servidor.alerta}</p>
            </div>
          </div>
        )}
        <div className="auth-grid">{FILA_NOMBRES.map(dibujarCampo)}</div>
        {CAMPOS_RESTO.map(dibujarCampo)}
        <button type="submit" className={`${claseBoton('primario')} btn-block`} disabled={pendiente}>
          {pendiente ? (
            <>
              <span className="spinner-sm" aria-hidden="true" />
              Creando cuenta…
            </>
          ) : (
            'Crear cuenta'
          )}
        </button>
      </form>
    </TarjetaAuth>
  );
}
