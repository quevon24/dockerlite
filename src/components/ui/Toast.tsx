import { createContext, useCallback, useContext, useState } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X, AlertTriangle, CheckCircle2, Info } from "lucide-react";

type ToastVariant = "error" | "success" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (title: string, description?: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

const VARIANT_STYLES: Record<ToastVariant, string> = {
  error: "border-danger/40",
  success: "border-success/40",
  info: "border-accent/40",
};

const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  error: <AlertTriangle className="w-4 h-4 text-danger shrink-0" />,
  success: <CheckCircle2 className="w-4 h-4 text-success shrink-0" />,
  info: <Info className="w-4 h-4 text-accent shrink-0" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (title: string, description?: string, variant: ToastVariant = "info") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            className={`bg-surface-raised border ${VARIANT_STYLES[t.variant]} rounded-lg p-3 shadow-xl flex items-start gap-3 min-w-[300px] max-w-[420px]`}
            onOpenChange={(open) => {
              if (!open) removeToast(t.id);
            }}
          >
            {VARIANT_ICONS[t.variant]}
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-medium text-text-primary">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-xs text-text-secondary mt-1 break-words">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="p-0.5 rounded hover:bg-surface-overlay text-text-muted hover:text-text-primary transition-colors">
              <X className="w-3.5 h-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
