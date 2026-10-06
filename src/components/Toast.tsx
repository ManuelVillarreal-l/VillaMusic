import { useStore } from '../store';
import { IconClose, IconUndo } from './Icons';

export function ToastHost() {
  const { toast, dismissToast } = useStore();
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          className="toast-undo"
          onClick={() => {
            toast.undo?.();
            dismissToast();
          }}
        >
          <IconUndo size={16} /> Deshacer
        </button>
      )}
      <button className="icon-btn toast-close" onClick={dismissToast} aria-label="Cerrar aviso">
        <IconClose size={16} />
      </button>
    </div>
  );
}
