export const TOAST_MESSAGES = {
  SAVE_FAILED: 'Could not save. Your changes are still shown here; try again.',
  NOTE_REMOVED: 'Note no longer exists on the server and was removed.',
  CHECKLIST_TRUNCATED: 'Checklist item cut to 80 characters.',
  REJECTED_SAVE: 'Could not save changes.',
} as const;

export interface ToastProps {
  message: string;
  onClose?: () => void;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export function Toast({
  message,
  onClose,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}: ToastProps) {
  if (!message) return null;

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-forest text-cream px-4 py-3 rounded-lg shadow-lg text-sm max-w-md animate-fade-in"
    >
      <span className="flex-1">{message}</span>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-sand hover:text-cream font-medium underline px-1"
        >
          {actionText}
        </button>
      )}
      {secondaryActionText && onSecondaryAction && (
        <button
          type="button"
          onClick={onSecondaryAction}
          className="text-sand hover:text-cream font-medium underline px-1"
        >
          {secondaryActionText}
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="text-sage hover:text-cream font-bold ml-1"
        >
          &times;
        </button>
      )}
    </div>
  );
}