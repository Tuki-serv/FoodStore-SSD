import { useForm } from '@tanstack/react-form';
import { useEffect, useRef, useState } from 'react';
import { useRefrescarSesion } from '@/entities/session';
import { nombreCompleto, useActualizarUsuario, useCrearUsuario, type UsuarioAdmin } from '@/entities/usuario';
import { aApiError } from '@/shared/api';
import { NOMBRE_ROL, ROLES } from '@/shared/config';
import { avisarError, avisarExito } from '@/shared/model';
import { Campo, claseBoton, Icon } from '@/shared/ui';
import {
  aCuerpoAlta,
  cambiosUsuario,
  clasificarErrorUsuario,
  codigosOrdenados,
  DESCRIPCION_ROL,
  listaDeRoles,
  resumenRolesNuevos,
  validarCampoUsuario,
  validarRolesUsuario,
  valoresInicialesUsuario,
  type CampoTextoUsuario,
  type CampoUsuario,
  type ErrorUsuario,
  type ValoresUsuario,
} from '../model';

export interface FormularioUsuarioProps {
  /** Usuario a editar; sin él es un alta. */
  usuario?: UsuarioAdmin;
  /** El usuario editado es el de la sesión: no puede quitarse «Administrador» y, al guardar, se refresca la sesión. */
  esPropio?: boolean;
  /** «Cancelar» o «Volver»: cierra sin enviar nada. */
  onCancelar: () => void;
  /** Cierra tras guardar o al no haber cambios; `resaltadoId` es el usuario creado o editado (para resaltar su fila). */
  onTerminar: (resaltadoId?: number) => void;
  /** El servidor respondió 404: el usuario ya no está activo; la página vuelve al listado y lo pide de nuevo. */
  onYaNoActivo: (usuario: UsuarioAdmin) => void;
}

const MENSAJE_PROPIO_ADMIN = 'No podés quitarte tu propio rol de administrador';
const COMPLEMENTO_CONEXION = 'Probá de nuevo; lo que escribiste se conserva.';

type ErrorDeCampo = Extract<ErrorUsuario, { tipo: 'campo' }>;
type ErrorDeAlerta = Extract<ErrorUsuario, { tipo: 'general' | 'conexion' }>;

const errorLocal = (errores: readonly unknown[], tocado: boolean): string | undefined => (tocado ? errores.find((e): e is string => typeof e === 'string') : undefined);

/** Alta (sin `usuario`) o edición de datos y roles de un usuario; los errores del servidor se muestran junto al campo o en una alerta. */
export function FormularioUsuario({ usuario, esPropio = false, onCancelar, onTerminar, onYaNoActivo }: FormularioUsuarioProps) {
  const crear = useCrearUsuario();
  const actualizar = useActualizarUsuario();
  const refrescarSesion = useRefrescarSesion();
  const [errorCampo, setErrorCampo] = useState<ErrorDeCampo | null>(null);
  const [alerta, setAlerta] = useState<ErrorDeAlerta | null>(null);
  const [pedidoFoco, setPedidoFoco] = useState(0);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const formularioRef = useRef<HTMLFormElement>(null);
  const enEdicion = usuario !== undefined;
  const iniciales = valoresInicialesUsuario(usuario);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  // Tras un envío inválido o un error de campo del servidor, el foco va al primer control marcado como inválido (ya dibujado).
  useEffect(() => {
    if (pedidoFoco > 0) enfocarPrimerError(formularioRef.current);
  }, [pedidoFoco]);

  const guardar = async (valores: ValoresUsuario): Promise<void> => {
    setErrorCampo(null);
    setAlerta(null);
    try {
      if (usuario === undefined) {
        const creado = await crear.mutateAsync(aCuerpoAlta(valores));
        avisarExito('Usuario creado', `${nombreCompleto(creado)} · ${listaDeRoles(creado.roles.map((rol) => rol.codigo))}`);
        onTerminar(creado.id);
        return;
      }
      const cambios = cambiosUsuario(iniciales, valores);
      if (Object.keys(cambios).length === 0) {
        onTerminar();
        return;
      }
      const editado = await actualizar.mutateAsync({ id: usuario.id, cambios });
      if (esPropio) await refrescarSesion.mutateAsync().catch(() => undefined);
      const resumen = cambios.roles_codigos === undefined ? '' : ` · ${resumenRolesNuevos(codigosOrdenados(cambios.roles_codigos))}`;
      avisarExito('Usuario actualizado', `${nombreCompleto(editado)}${resumen}`);
      onTerminar(usuario.id);
    } catch (fallo) {
      const error = clasificarErrorUsuario(aApiError(fallo), enEdicion ? 'edicion' : 'alta');
      if (error.tipo === 'ya-no-activo' && usuario !== undefined) {
        avisarError(`${nombreCompleto(usuario)} ya no estaba activo`, 'Actualizamos el listado.');
        onYaNoActivo(usuario);
      } else if (error.tipo === 'campo') {
        setErrorCampo(error);
        setPedidoFoco((n) => n + 1);
      } else if (error.tipo === 'general' || error.tipo === 'conexion') setAlerta(error);
    }
  };

  const form = useForm({
    defaultValues: iniciales,
    onSubmit: ({ value }) => guardar(value),
    onSubmitInvalid: () => setPedidoFoco((n) => n + 1),
  });

  const pendiente = crear.isPending || actualizar.isPending || refrescarSesion.isPending;
  const errorDelServidor = (campo: CampoUsuario): string | undefined => (errorCampo?.campo === campo ? errorCampo.mensaje : undefined);
  const limpiarErrorDelServidor = (campo: CampoUsuario): void => {
    if (errorCampo?.campo === campo) setErrorCampo(null);
  };

  const campoTexto = (nombre: CampoTextoUsuario, etiqueta: string, opciones: { className: string; opcional?: boolean; ayuda?: string; tipo?: string; autoComplete?: string }) => (
    <form.Field
      name={nombre}
      validators={{
        onMount: ({ value }) => validarCampoUsuario(nombre, value),
        onChange: ({ value }) => validarCampoUsuario(nombre, value),
        onBlur: ({ value }) => validarCampoUsuario(nombre, value),
      }}
    >
      {(campo) => {
        const error = errorDelServidor(nombre) ?? errorLocal(campo.state.meta.errors, campo.state.meta.isTouched);
        return (
          <Campo
            etiqueta={etiqueta}
            className={opciones.className}
            {...(opciones.opcional === true ? { opcional: true } : {})}
            {...(opciones.ayuda === undefined ? {} : { ayuda: opciones.ayuda })}
            {...(error === undefined ? {} : { error })}
          >
            {(control) => (
              <input
                {...control}
                className="input"
                type={opciones.tipo ?? 'text'}
                name={campo.name}
                {...(opciones.autoComplete === undefined ? {} : { autoComplete: opciones.autoComplete })}
                value={campo.state.value}
                onBlur={campo.handleBlur}
                onChange={(evento) => {
                  limpiarErrorDelServidor(nombre);
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
    <>
      <button type="button" className="back-link" onClick={onCancelar}>
        <Icon name="volver" />
        Volver a Usuarios
      </button>
      <section className="form-card" aria-labelledby="form-titulo">
        <h2 id="form-titulo" ref={tituloRef} tabIndex={-1}>
          {enEdicion ? `Editar a ${nombreCompleto(usuario)}` : 'Nuevo usuario'}
        </h2>
        {esPropio ? <p className="admin-summary">Es tu propia cuenta.</p> : null}
        {alerta === null ? null : (
          <div className="form-alert" role="alert">
            <Icon name="alerta" />
            <div>
              {enEdicion ? 'No pudimos guardar los cambios' : 'No pudimos guardar el usuario'}
              <p>{alerta.tipo === 'conexion' ? `${alerta.mensaje} ${COMPLEMENTO_CONEXION}` : alerta.mensaje}</p>
            </div>
          </div>
        )}
        <form
          ref={formularioRef}
          className="form-grid form-usuario"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            void form.handleSubmit();
          }}
        >
          {campoTexto('nombre', 'Nombre', { className: 'c-3', autoComplete: 'off' })}
          {campoTexto('apellido', 'Apellido', { className: 'c-3', autoComplete: 'off' })}
          {enEdicion ? (
            <Campo etiqueta="Email" className="c-3" ayuda="El email no se puede cambiar.">
              {(control) => <input {...control} className="input" type="email" name="email" readOnly aria-readonly="true" value={usuario.email} />}
            </Campo>
          ) : (
            campoTexto('email', 'Email', { className: 'c-3', tipo: 'email', autoComplete: 'off' })
          )}
          {campoTexto('celular', 'Celular', { className: 'c-3', opcional: true, tipo: 'tel', autoComplete: 'off' })}
          {enEdicion ? null : campoTexto('password', 'Contraseña inicial', { className: 'c-3', tipo: 'password', autoComplete: 'new-password', ayuda: 'Mínimo 8 caracteres. Se la tenés que pasar vos al usuario.' })}
          <form.Field name="roles" validators={{ onMount: ({ value }) => validarRolesUsuario(value), onChange: ({ value }) => validarRolesUsuario(value) }}>
            {(campo) => {
              const error = errorDelServidor('roles') ?? errorLocal(campo.state.meta.errors, campo.state.meta.isTouched);
              const alternar = (codigo: string, marcado: boolean): void => {
                limpiarErrorDelServidor('roles');
                campo.handleChange(marcado ? [...campo.state.value, codigo] : campo.state.value.filter((actual) => actual !== codigo));
              };
              return (
                <div className="field c-6">
                  <fieldset className={error === undefined ? 'roles' : 'roles has-error'} {...(error === undefined ? {} : { 'aria-describedby': 'roles-error' })}>
                    <legend>
                      Roles <small>(elegí al menos uno)</small>
                    </legend>
                    <div className="roles-grid">
                      {ROLES.map((codigo) => {
                        const marcado = campo.state.value.includes(codigo);
                        const bloqueado = esPropio && codigo === 'ADMIN';
                        return (
                          <label key={codigo} className={bloqueado ? 'check is-checked is-disabled' : marcado ? 'check is-checked' : 'check'}>
                            <input
                              type="checkbox"
                              name="roles"
                              value={codigo}
                              checked={marcado}
                              disabled={bloqueado}
                              {...(bloqueado ? { 'aria-describedby': 'admin-propio' } : {})}
                              onChange={(evento) => alternar(codigo, evento.target.checked)}
                            />
                            <span>
                              {NOMBRE_ROL[codigo]}
                              <small>{DESCRIPCION_ROL[codigo]}</small>
                              {bloqueado ? (
                                <span className="why" id="admin-propio">
                                  <Icon name="candado" />
                                  {MENSAJE_PROPIO_ADMIN}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {error === undefined ? null : (
                      <span id="roles-error" className="roles-err">
                        {error}
                      </span>
                    )}
                  </fieldset>
                </div>
              );
            }}
          </form.Field>
          <div className="form-actions c-6">
            <button type="button" className={claseBoton('fantasma')} onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className={claseBoton('primario')} disabled={pendiente}>
              {pendiente ? 'Guardando…' : enEdicion ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

/** Foco al primer control inválido del formulario; si el error es de los roles, a la primera casilla habilitada. */
function enfocarPrimerError(formulario: HTMLFormElement | null): void {
  if (formulario === null) return;
  const invalido = formulario.querySelector<HTMLElement>('[aria-invalid="true"]');
  (invalido ?? formulario.querySelector<HTMLElement>('fieldset.has-error input:not([disabled])'))?.focus();
}
