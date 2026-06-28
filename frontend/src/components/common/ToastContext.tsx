import React, { createContext, useContext, useState, useCallback } from 'react';
import { IconCheck, IconX, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const toastStyles: Record<ToastType, { bg: string; icon: React.ReactNode; border: string }> = {
  success: {
    bg: 'bg-green-950/80 text-green-300',
    border: 'border-green-800/60',
    icon: <IconCheck size={16} />,
  },
  error: {
    bg: 'bg-red-950/80 text-red-300',
    border: 'border-red-800/60',
    icon: <IconX size={16} />,
  },
  info: {
    bg: 'bg-blue-950/80 text-blue-300',
    border: 'border-blue-800/60',
    icon: <IconInfoCircle size={16} />,
  },
  warning: {
    bg: 'bg-amber-950/80 text-amber-300',
    border: 'border-amber-800/60',
    icon: <IconAlertTriangle size={16} />,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg: string) => toast(msg, 'error'), [toast]);
  const info = useCallback((msg: string) => toast(msg, 'info'), [toast]);
  const warning = useCallback((msg: string) => toast(msg, 'warning'), [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, info, warning, dismiss }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const style = toastStyles[t.type];
          return (
            <div
              key={t.id}
              className={[
                'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm',
                'shadow-xl shadow-black/30 text-sm font-medium',
                'pointer-events-auto animate-slide-up',
                style.bg,
                style.border,
              ].join(' ')}
            >
              <span className="shrink-0">{style.icon}</span>
              <span className="flex-1 min-w-0 break-words max-w-xs">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <IconX size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
