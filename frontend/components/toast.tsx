"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { IconCheck } from "./icons";

type ToastType = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(
  () => {},
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-line bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg"
            style={{ animation: "toast-in 0.25s ease-out" }}
          >
            {t.type === "success" && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-green text-white">
                <IconCheck width={13} height={13} />
              </span>
            )}
            {t.type === "error" && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-white">
                !
              </span>
            )}
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
