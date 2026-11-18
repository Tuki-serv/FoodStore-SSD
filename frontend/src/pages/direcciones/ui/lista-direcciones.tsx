import { nombreDireccion, TarjetaDireccion, type Direccion } from '@/entities/direccion';
import { claseBoton, Icon } from '@/shared/ui';

export interface ListaDireccionesProps {
  direcciones: readonly Direccion[];
  /** Hay un «Marcar como principal» en curso: se deshabilita la acción en todas (evita dos principales por carrera, R3). */
  marcandoPrincipal?: boolean;
  onEditar: (direccion: Direccion) => void;
  onMarcarPrincipal: (direccion: Direccion) => void;
  onEliminar: (direccion: Direccion) => void;
}

export function ListaDirecciones({ direcciones, marcandoPrincipal = false, onEditar, onMarcarPrincipal, onEliminar }: ListaDireccionesProps) {
  return (
    <ul className="addr-list" aria-label="Tus direcciones">
      {direcciones.map((direccion) => {
        const nombre = nombreDireccion(direccion);
        return (
          <TarjetaDireccion
            key={direccion.id}
            direccion={direccion}
            acciones={
              <>
                {direccion.es_principal ? null : (
                  <button
                    type="button"
                    className={claseBoton('secundario', { compacto: true })}
                    aria-label={`Marcar ${nombre} como principal`}
                    disabled={marcandoPrincipal}
                    onClick={() => onMarcarPrincipal(direccion)}
                  >
                    <Icon name="estrella" className="h-[18px] w-[18px]" />
                    Marcar como principal
                  </button>
                )}
                <button
                  type="button"
                  className={claseBoton('fantasma', { compacto: true })}
                  aria-label={`Editar ${nombre}`}
                  data-foco={`editar-${direccion.id}`}
                  onClick={() => onEditar(direccion)}
                >
                  <Icon name="editar" className="h-[18px] w-[18px]" />
                  Editar
                </button>
                <button
                  type="button"
                  className={claseBoton('fantasma', { compacto: true })}
                  aria-label={`Eliminar ${nombre}`}
                  onClick={() => onEliminar(direccion)}
                >
                  <Icon name="basura" className="h-[18px] w-[18px]" />
                  Eliminar
                </button>
              </>
            }
          />
        );
      })}
    </ul>
  );
}
