import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
    error: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-brand-400 shrink-0" />,
  };

  const styles = {
    success: 'border-emerald-800/60 bg-emerald-950/80',
    error: 'border-red-800/60 bg-red-950/80',
    info: 'border-neutral-800 bg-neutral-900/95',
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 text-xs text-neutral-200 p-3 rounded-xl border shadow-xl backdrop-blur-md animate-slide-up ${styles[t.type]}`}
          >
            {icons[t.type]}
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-neutral-500 hover:text-neutral-300 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
