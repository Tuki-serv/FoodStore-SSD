import { useState } from 'react';
import { nombreCompleto, useDesactivarUsuario, type UsuarioAdmin } from '@/entities/usuario';
import { aApiError } from '@/shared/api';
import { avisarExito } from '@/shared/model';
import { claseBoton, DialogoBaja, type AvisoBaja } from '@/shared/ui';
import { clasificarErrorUsuario, type ErrorUsuario } from '../model';

export interface DialogoDesactivarUsuarioProps {
  usuario: UsuarioAdmin;
  onCerrar: () => void;
  /** La baja salió bien o el usuario ya no estaba activo y se pulsó «Entendido» (el diálogo ya puede desmontarse). */
  onTerminar: () => void;
  /** El servidor respondió 404: la página vuelve a pedir el listado. */
  onYaNoActivo: () => void;
}

const COMPLEMENTO_CONEXION = 'Probá de nuevo.';

/** Aviso de error dentro del diálogo; el 404 no llega acá (tiene su propio estado). */
function avisoDeError(error: Exclude<ErrorUsuario, { tipo: 'ya-no-activo' }>): AvisoBaja {
  const detalle = error.tipo === 'conexion' ? `${error.mensaje} ${COMPLEMENTO_CONEXION}` : error.mensaje;
  return { titulo: 'No pudimos desactivar al usuario', detalle, peligro: true };
}

/** Baja de un usuario: quién es y qué pasa al confirmar; los errores del servidor se muestran dentro del diálogo. */
export function DialogoDesactivarUsuario({ usuario, onCerrar, onTerminar, onYaNoActivo }: DialogoDesactivarUsuarioProps) {
  const desactivar = useDesactivarUsuario();
  const [error, setError] = useState<ErrorUsuario | null>(null);
  const nombre = nombreCompleto(usuario);

  const confirmar = async (): Promise<void> => {
    setError(null);
    try {
      await desactivar.mutateAsync(usuario.id);
    } catch (fallo) {
      const clasificado = clasificarErrorUsuario(aApiError(fallo), 'baja');
      setError(clasificado);
      if (clasificado.tipo === 'ya-no-activo') onYaNoActivo();
      return;
    }
    avisarExito('Usuario desactivado', `${nombre} ya no puede ingresar`);
    onTerminar();
  };

  if (error?.tipo === 'ya-no-activo') {
    return (
      <DialogoBaja
        key="ya-no-activo"
        titulo={`${nombre} ya no estaba activo`}
        aviso={{ titulo: 'Otra persona ya lo desactivó', detalle: 'Actualizamos el listado para que veas el estado real.', peligro: true }}
        onConfirmar={onTerminar}
        onCerrar={onTerminar}
        acciones={
          <button type="button" className={claseBoton('primario')} data-autofocus onClick={onTerminar}>
            Entendido
          </button>
        }
      />
    );
  }

  return (
    <DialogoBaja
      key="confirmar"
      titulo={`¿Desactivar a ${nombre}?`}
      cuerpo={
        <>
          <div className="who">
            <strong>{nombre}</strong>
            <span>{usuario.email}</span>
          </div>
          <ul className="effects">
            <li>Se cierran sus sesiones abiertas: queda fuera de la tienda enseguida.</li>
            <li>No va a poder ingresar con esa cuenta.</li>
            <li>Su email queda libre para una cuenta nueva.</li>
          </ul>
        </>
      }
      {...(error === null ? {} : { aviso: avisoDeError(error) })}
      etiquetaConfirmar="Desactivar"
      etiquetaPendiente="Desactivando…"
      pendiente={desactivar.isPending}
      onConfirmar={() => void confirmar()}
      onCerrar={onCerrar}
    />
  );
}
