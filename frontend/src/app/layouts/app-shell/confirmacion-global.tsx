import { useEffect, useRef } from 'react';
import { selectConfirmModal, useUiStore, type ConfirmModal } from '@/shared/model';
import { claseBoton, Dialogo } from '@/shared/ui';

function DialogoConfirmacion({ confirmacion }: { confirmacion: ConfirmModal }) {
  const { titulo, mensaje, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', variante = 'normal', onConfirmar } = confirmacion;
  const enviada = useRef(false);

  // Una confirmación nueva (aunque reemplace a otra abierta) vuelve a permitir confirmar.
  useEffect(() => {
    enviada.current = false;
  }, [confirmacion]);

  const cerrar = (): void => useUiStore.getState().cerrarConfirmacion();

  const confirmar = (): void => {
    // Doble clic: la acción corre una sola vez aunque el segundo clic llegue antes de que el diálogo desaparezca.
    if (enviada.current) return;
    enviada.current = true;
    cerrar();
    onConfirmar();
  };

  return (
    <Dialogo titulo={titulo} descripcion={mensaje} onCerrar={cerrar}>
      <div className="modal-actions">
        <button type="button" className={claseBoton('fantasma')} data-autofocus onClick={cerrar}>
          {textoCancelar}
        </button>
        <button type="button" className={claseBoton(variante === 'peligro' ? 'peligro' : 'primario')} data-variante={variante} onClick={confirmar}>
          {textoConfirmar}
        </button>
      </div>
    </Dialogo>
  );
}

/** Host del diálogo de confirmación de `uiStore` (`pedirConfirmacion`): se monta una vez en el shell. */
export function ConfirmacionGlobal() {
  const confirmacion = useUiStore(selectConfirmModal);
  return confirmacion === null ? null : <DialogoConfirmacion confirmacion={confirmacion} />;
}
