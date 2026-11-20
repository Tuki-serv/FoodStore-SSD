import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSesion } from '@/entities/session';
import { usuarioQueries, type UsuarioAdmin } from '@/entities/usuario';
import { aApiError } from '@/shared/api';
import { NOMBRE_ROL } from '@/shared/config';
import { AvisoDesactualizado, claseBoton, EsqueletoFilas, EstadoError, EstadoVacio, Icon, Paginacion } from '@/shared/ui';
import { aParametros, leerEstadoListado, type EstadoListado } from '../model';
import { DialogoDesactivarUsuario } from './dialogo-desactivar-usuario';
import { FiltroRol } from './filtro-rol';
import { FormularioUsuario } from './formulario-usuario';
import { ListaUsuarios } from './lista-usuarios';

/** La página muestra el listado o el formulario (alta o edición): sin rutas propias, como en C-17a. */
type Modo = { tipo: 'lista' } | { tipo: 'alta' } | { tipo: 'edicion'; usuario: UsuarioAdmin };

/** Administración de usuarios (US-027, solo ADMIN): listado paginado con filtro por rol, alta y edición. */
export function AdminUsuariosPage() {
  const [parametros, setParametros] = useSearchParams();
  const { rol, page } = leerEstadoListado(parametros);
  const consulta = useQuery(usuarioQueries.lista({ rol, page }));
  const { usuario: sesion } = useSesion();
  const { data } = consulta;
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [resaltadoId, setResaltadoId] = useState<number | null>(null);
  const [baja, setBaja] = useState<UsuarioAdmin | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // Marca (`data-foco`) del botón al que vuelve el foco al cerrar el formulario.
  const focoAlVolver = useRef<string | null>(null);

  useEffect(() => {
    if (modo.tipo !== 'lista' || focoAlVolver.current === null) return;
    document.querySelector<HTMLElement>(`[data-foco="${focoAlVolver.current}"]`)?.focus();
    focoAlVolver.current = null;
  }, [modo]);

  const abrirFormulario = (siguiente: Modo, foco: string): void => {
    focoAlVolver.current = foco;
    setResaltadoId(null);
    setModo(siguiente);
  };
  const cerrarFormulario = (): void => setModo({ tipo: 'lista' });
  const terminarFormulario = (id?: number): void => {
    if (id !== undefined) setResaltadoId(id);
    cerrarFormulario();
  };
  // El usuario ya no estaba activo: se vuelve al listado (el aviso lo da el formulario) y se pide de nuevo.
  const yaNoActivo = (): void => {
    cerrarFormulario();
    void consulta.refetch();
  };

  const irA = (siguiente: EstadoListado): void => setParametros(aParametros(siguiente));

  // Si la página pedida ya no existe (por ejemplo, tras desactivar al único usuario de la última página), se vuelve a la última que hay.
  useEffect(() => {
    if (data !== undefined && data.items.length === 0 && data.total > 0 && data.page > 1) {
      setParametros(aParametros({ rol, page: data.pages }), { replace: true });
    }
  }, [data, rol, setParametros]);

  // El diálogo devolvió el foco al botón «Desactivar», que el refetch ya quitó del DOM: al terminar, el foco pasa al título.
  const terminarBaja = (): void => {
    setBaja(null);
    tituloRef.current?.focus();
  };
  const reintentar = (): void => void consulta.refetch();
  const contenedor = 'mx-auto flex w-full max-w-[1040px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6';

  if (modo.tipo !== 'lista') {
    const editado = modo.tipo === 'edicion' ? modo.usuario : undefined;
    return (
      <div className={contenedor}>
        <h1 className="sr-only">Usuarios</h1>
        <FormularioUsuario
          key={editado?.id ?? 'alta'}
          {...(editado === undefined ? {} : { usuario: editado, esPropio: editado.id === sesion?.id })}
          onCancelar={cerrarFormulario}
          onTerminar={terminarFormulario}
          onYaNoActivo={yaNoActivo}
        />
      </div>
    );
  }

  return (
    <div className={contenedor}>
      <div className="page-head-row">
        <header className="page-head">
          <h1 ref={tituloRef} tabIndex={-1} className="text-2xl">
            Usuarios
          </h1>
          <p>Administrá las cuentas de la tienda: sus datos, sus roles y quién puede ingresar.</p>
        </header>
        <button type="button" className={`${claseBoton('primario')} btn-agregar`} data-foco="nuevo" onClick={() => abrirFormulario({ tipo: 'alta' }, 'nuevo')}>
          <Icon name="mas" />
          Nuevo usuario
        </button>
      </div>
      <div className="toolbar">
        <FiltroRol rol={rol} onCambiar={(siguiente) => irA({ rol: siguiente, page: 1 })} />
        {data === undefined ? null : (
          <p className="admin-summary" role="status">
            <strong>
              {data.total} {data.total === 1 ? 'usuario' : 'usuarios'}
            </strong>
            {rol === null ? '' : ` con el rol ${NOMBRE_ROL[rol]}`}
          </p>
        )}
      </div>
      {consulta.isError && data !== undefined ? <AvisoDesactualizado texto="No pudimos actualizar los usuarios" onReintentar={reintentar} /> : null}
      {data === undefined ? (
        consulta.isError ? (
          <EstadoError titulo="No pudimos cargar los usuarios" detalle={aApiError(consulta.error).detail} onReintentar={reintentar} />
        ) : (
          <EsqueletoFilas etiqueta="Cargando usuarios" filas={6} />
        )
      ) : data.total === 0 ? (
        <EstadoVacio
          icono="usuarios"
          titulo={rol === null ? 'Todavía no hay usuarios' : 'No hay usuarios con ese rol'}
          texto={rol === null ? 'Cuando se registre alguien o crees una cuenta va a aparecer acá.' : `Cuando le des el rol ${NOMBRE_ROL[rol]} a alguien va a aparecer acá.`}
        >
          {rol === null ? null : (
            <button type="button" className={claseBoton('secundario')} onClick={() => irA({ rol: null, page: 1 })}>
              Ver todos
            </button>
          )}
        </EstadoVacio>
      ) : (
        <>
          <ListaUsuarios usuarios={data.items} sesionId={sesion?.id ?? null} resaltadoId={resaltadoId} onEditar={(usuario) => abrirFormulario({ tipo: 'edicion', usuario }, `editar-${usuario.id}`)} onDesactivar={setBaja} />
          <Paginacion etiqueta="Paginación de usuarios" page={data.page} pages={data.pages} onCambiar={(destino) => irA({ rol, page: destino })} />
        </>
      )}
      {baja === null ? null : <DialogoDesactivarUsuario usuario={baja} onCerrar={() => setBaja(null)} onTerminar={terminarBaja} onYaNoActivo={reintentar} />}
    </div>
  );
}
