import { useEffect } from 'react';
import { selectToasts, useUiStore, type Toast } from '@/shared/model';
import { Icon } from '@/shared/ui';

/** Milisegundos hasta que una notificación se descarta sola. */
export const DURACION_TOAST_MS = 5000;

function ItemToast({ toast }: { toast: Toast }) {
  const { id } = toast;
  useEffect(() => {
    const temporizador = setTimeout(() => useUiStore.getState().descartarToast(id), DURACION_TOAST_MS);
    return () => clearTimeout(temporizador);
  }, [id]);

  return (
    <div className={`toast t-${toast.tipo}`} role={toast.tipo === 'error' ? 'alert' : 'status'}>
      <div>
        <strong>{toast.titulo}</strong>
        {toast.mensaje}
      </div>
      <button type="button" className="icon-btn" aria-label="Cerrar notificación" onClick={() => useUiStore.getState().descartarToast(id)}>
        <Icon name="cerrar" className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

/** Host de la cola de notificaciones de `uiStore`: se monta una vez en el shell. */
export function Notificaciones() {
  const toasts = useUiStore(selectToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <ItemToast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
