import { useForm } from '@tanstack/react-form';
import { useRef, useState } from 'react';
import { useActualizarPerfil, useCerrarSesion, useCerrarTodasLasSesiones, useSesion } from '@/entities/session';
import { esApiError } from '@/shared/api';
import type { UsuarioSesion } from '@/shared/auth';
import { nombreDeRol } from '@/shared/config';
import { useUiStore } from '@/shared/model';
import { Campo, claseBoton, EncabezadoPagina, Icon } from '@/shared/ui';
import { aDatosPerfil, erroresDePerfil, validarCampo, valoresIniciales, type CampoPerfil, type ErroresServidorPerfil } from '../model';


/** Base compartida de los dos botones de la tarjeta «Sesiones» (design system: `.btn-danger-outline` / `.btn-neutral`). */
const BASE_BOTON_SESIONES =
  'btn-sesiones inline-flex min-h-tap items-center justify-center gap-2 rounded-md border-2 bg-surface px-5 font-bold ' +
  'cursor-pointer transition-[background-color,transform] duration-fast ease-out active:scale-[.97] focus-visible:outline-none focus-visible:shadow-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

/** Secundario neutro: borde y texto oscuros sobre fondo de superficie. */
const CLASE_BOTON_CERRAR = `${BASE_BOTON_SESIONES} border-text-muted text-text hover:bg-surface-alt`;
/** Secundario de peligro: borde y texto de peligro sobre fondo de superficie. */
const CLASE_BOTON_CERRAR_TODAS = `${BASE_BOTON_SESIONES} border-danger text-danger hover:bg-danger-bg`;

interface DefinicionCampo {
  nombre: CampoPerfil;
  etiqueta: string;
  tipo: 'text' | 'tel';
  autoComplete: string;
  opcional: boolean;
}

const CAMPOS: readonly DefinicionCampo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', autoComplete: 'given-name', opcional: false },
  { nombre: 'apellido', etiqueta: 'Apellido', tipo: 'text', autoComplete: 'family-name', opcional: false },
  { nombre: 'celular', etiqueta: 'Celular', tipo: 'tel', autoComplete: 'tel', opcional: true },
];

const SIN_ERRORES_SERVIDOR: ErroresServidorPerfil = { campos: {} };

/** Perfil propio (US-004/US-005): datos editables, email y roles de solo lectura, y cierre de sesión (este dispositivo o todos). */
export function MiCuentaPage() {
  const { usuario } = useSesion();
  if (usuario === null) return null;
  return <PerfilDe usuario={usuario} />;
}

function PerfilDe({ usuario }: { usuario: UsuarioSesion }) {
  const actualizar = useActualizarPerfil();
  const cerrarSesion = useCerrarSesion();
  const cerrarTodas = useCerrarTodasLasSesiones();
  const [servidor, setServidor] = useState<ErroresServidorPerfil>(SIN_ERRORES_SERVIDOR);
  const enviando = useRef(false);
  const formularioRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: valoresIniciales(usuario),
    onSubmit: async ({ value }) => {
      // Guarda síncrona: dos clics seguidos llegan antes de que el botón se deshabilite.
      if (enviando.current) return;
      enviando.current = true;
      setServidor(SIN_ERRORES_SERVIDOR);
      try {
        const guardado = await actualizar.mutateAsync(aDatosPerfil(value));
        form.reset({ nombre: guardado.nombre, apellido: guardado.apellido, celular: guardado.celular ?? '' });
        useUiStore.getState().notificar({ tipo: 'success', titulo: 'Datos guardados' });
      } catch (error) {
        if (!esApiError(error)) throw error;
        setServidor(erroresDePerfil(error));
      } finally {
        enviando.current = false;
      }
    },
    onSubmitInvalid: () => {
      formularioRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    },
  });

  const pedirCierreTotal = (): void => {
    useUiStore.getState().pedirConfirmacion({
      titulo: '¿Cerrar todas las sesiones?',
      mensaje: 'Vas a salir en este y en todos tus dispositivos. Para volver a entrar vas a necesitar tu email y tu contraseña.',
      textoConfirmar: 'Cerrar todas',
      variante: 'peligro',
      onConfirmar: () => cerrarTodas.mutate(),
    });
  };

  const pendiente = actualizar.isPending;

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoPagina eyebrow="Tu cuenta" titulo="Mi cuenta" subtitulo="Revisá y actualizá tus datos personales." />
      <div className="page-body">
      <div className="account">
        <form
          ref={formularioRef}
          className="form-card"
          aria-labelledby="titulo-datos"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <div className="card-head">
            <h2 id="titulo-datos">Tus datos</h2>
            <p>Así te vamos a nombrar en tus pedidos.</p>
          </div>
          {servidor.alerta === undefined ? null : (
            <div className="form-alert" role="alert">
              <Icon name="alerta" />
              <div>
                No pudimos guardar los cambios
                <p>{servidor.alerta}</p>
              </div>
            </div>
          )}
          <div className="form-grid">
            {CAMPOS.map(({ nombre, etiqueta, tipo, autoComplete, opcional }) => (
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
                  const errorLocal = campo.state.meta.isTouched ? campo.state.meta.errors.find((e): e is string => typeof e === 'string') : undefined;
                  const error = servidor.campos[nombre] ?? errorLocal;
                  return (
                    <Campo etiqueta={etiqueta} opcional={opcional} className="c-3" {...(error === undefined ? {} : { error })}>
                      {(control) => (
                        <input
                          {...control}
                          className="input"
                          name={campo.name}
                          type={tipo}
                          autoComplete={autoComplete}
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
            ))}
          </div>
          <dl className="ro-list">
            <dt>Email</dt>
            <dd>
              {usuario.email}
              <small>El email no se puede cambiar.</small>
            </dd>
            <dt>{usuario.roles.length > 1 ? 'Roles' : 'Rol'}</dt>
            <dd>
              {usuario.roles.map((rol) => (
                <span key={rol} className="rol-txt">
                  {nombreDeRol(rol)}
                </span>
              ))}
            </dd>
          </dl>
          <div className="form-actions">
            <button type="submit" className={claseBoton('primario')} disabled={pendiente}>
              {pendiente ? (
                <>
                  <span className="spinner-sm" aria-hidden="true" />
                  Guardando…
                </>
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        </form>
        <section className="form-card danger-zone" aria-labelledby="titulo-sesiones">
          <div className="row">
            <div>
              <h2 id="titulo-sesiones">Sesiones</h2>
              <p>Cerrá la sesión en este dispositivo o en todos tus dispositivos. Un acceso ya abierto en otro dispositivo puede seguir activo hasta 30 minutos.</p>
            </div>
            <div className="sesiones-actions">
              <button type="button" className={CLASE_BOTON_CERRAR} disabled={cerrarSesion.isPending} onClick={() => cerrarSesion.mutate()}>
                <Icon name="salir" />
                Cerrar sesión
              </button>
              <button type="button" className={CLASE_BOTON_CERRAR_TODAS} disabled={cerrarTodas.isPending} onClick={pedirCierreTotal}>
                <Icon name="salir" />
                Cerrar todas las sesiones
              </button>
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
