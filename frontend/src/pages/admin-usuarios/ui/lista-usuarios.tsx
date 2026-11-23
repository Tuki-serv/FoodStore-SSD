import { nombreCompleto, type UsuarioAdmin } from '@/entities/usuario';
import { nombreDeRol } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';

export interface ListaUsuariosProps {
  usuarios: readonly UsuarioAdmin[];
  /** Id del administrador de la sesión: su fila lleva «Vos» y no ofrece «Desactivar». */
  sesionId: number | null;
  /** Usuario recién creado o actualizado: la fila se resalta un momento. */
  resaltadoId: number | null;
  onEditar: (usuario: UsuarioAdmin) => void;
  onDesactivar: (usuario: UsuarioAdmin) => void;
}

/** Listado de usuarios: nombre y email, roles como etiquetas, celular y acciones por fila (tabla en desktop, tarjetas en mobile). */
export function ListaUsuarios({ usuarios, sesionId, resaltadoId, onEditar, onDesactivar }: ListaUsuariosProps) {
  return (
    <ul className="ilist ulist" aria-label="Usuarios">
      <li className="urow uhead" aria-hidden="true">
        <span>Usuario</span>
        <span>Roles</span>
        <span>Celular</span>
        <span />
      </li>
      {usuarios.map((usuario) => {
        const nombre = nombreCompleto(usuario);
        const esPropio = usuario.id === sesionId;
        const esResaltado = usuario.id === resaltadoId;
        return (
          <li key={usuario.id}>
            <div className={esResaltado ? 'urow is-new' : 'urow'} role="group" aria-label={nombre}>
              <div className="iname">
                <div className="iname-top">
                  <strong>{nombre}</strong>
                  {esPropio ? <span className="meta-txt">Vos</span> : null}
                </div>
                <small>{usuario.email}</small>
              </div>
              <ul className="uroles" aria-label={`Roles de ${nombre}`}>
                {usuario.roles.map((rol) => (
                  <li key={rol.codigo} className="rol-txt">
                    {nombreDeRol(rol.codigo)}
                  </li>
                ))}
              </ul>
              <span className="ucel">
                {usuario.celular === null || usuario.celular === '' ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">Sin celular</span>
                  </>
                ) : (
                  usuario.celular
                )}
              </span>
              <div className="crow-actions">
                <button
                  type="button"
                  className={claseBoton('fantasma', { compacto: true })}
                  aria-label={`Editar ${nombre}`}
                  data-foco={`editar-${usuario.id}`}
                  onClick={() => onEditar(usuario)}
                >
                  <Icon name="editar" />
                  Editar
                </button>
                {esPropio ? null : (
                  <button type="button" className={claseBoton('fantasmaPeligro', { compacto: true })} aria-label={`Desactivar ${nombre}`} onClick={() => onDesactivar(usuario)}>
                    <Icon name="basura" />
                    Desactivar
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
