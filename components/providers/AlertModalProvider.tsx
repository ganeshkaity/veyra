"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";

export type AlertType = "info" | "success" | "warning" | "error";

export interface AlertOptions {
  title?: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
}

interface AlertModalContextType {
  showAlert: (message: string, options?: AlertOptions) => Promise<void>;
  showConfirm: (message: string, options?: AlertOptions) => Promise<boolean>;
}

const AlertModalContext = createContext<AlertModalContextType>({
  showAlert: async () => {},
  showConfirm: async () => false,
});

export const useAlert = () => useContext(AlertModalContext);

interface ModalState {
  isOpen: boolean;
  isConfirm: boolean;
  message: string;
  title: string;
  type: AlertType;
  confirmText: string;
  cancelText: string;
  resolve?: (value: any) => void;
}

export const AlertModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const resolveRef = useRef<((value: any) => void) | null>(null);

  const showAlert = (message: string, options?: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({
        isOpen: true,
        isConfirm: false,
        message,
        title: options?.title || (options?.type === "error" ? "Error" : options?.type === "success" ? "Success" : "Notice"),
        type: options?.type || "info",
        confirmText: options?.confirmText || "OK",
        cancelText: "Cancel",
      });
    });
  };

  const showConfirm = (message: string, options?: AlertOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({
        isOpen: true,
        isConfirm: true,
        message,
        title: options?.title || "Please Confirm",
        type: options?.type || "warning",
        confirmText: options?.confirmText || "Confirm",
        cancelText: options?.cancelText || "Cancel",
      });
    });
  };

  const handleClose = (result: boolean) => {
    if (resolveRef.current) {
      if (modalState?.isConfirm) {
        resolveRef.current(result);
      } else {
        resolveRef.current(undefined);
      }
      resolveRef.current = null;
    }
    setModalState(null);
  };

  // Intercept window.alert globally across the entire web application
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      showAlert(String(msg ?? ""));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Keyboard navigation (Enter / Escape)
  useEffect(() => {
    if (!modalState?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleClose(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState?.isOpen]);

  const getIconConfig = (type: AlertType) => {
    switch (type) {
      case "success":
        return {
          icon: "check_circle",
          badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
          btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
        };
      case "error":
        return {
          icon: "error",
          badgeClass: "bg-rose-500/10 text-rose-500 border-rose-500/20",
          btnClass: "bg-rose-600 hover:bg-rose-700 text-white",
        };
      case "warning":
        return {
          icon: "warning",
          badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
          btnClass: "bg-[#2563EB] hover:bg-[#1d4ed8] text-white",
        };
      case "info":
      default:
        return {
          icon: "info",
          badgeClass: "bg-[#2563EB]/10 text-[#2563EB] dark:text-[#38BDF8] border-[#2563EB]/20",
          btnClass: "bg-[#2563EB] hover:bg-[#1d4ed8] text-white",
        };
    }
  };

  const currentConfig = modalState ? getIconConfig(modalState.type) : null;

  return (
    <AlertModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Branded Alert / Confirm Modal Dialog */}
      {modalState?.isOpen && currentConfig && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => handleClose(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm bg-white dark:bg-[#18222d] text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 p-6 flex flex-col items-center text-center z-10 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Type Icon Badge */}
            <div
              className={`w-13 h-13 rounded-2xl flex items-center justify-center border shadow-xs mb-3.5 ${currentConfig.badgeClass}`}
            >
              <Icon name={currentConfig.icon} size="md" />
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-snug">
              {modalState.title}
            </h3>

            {/* Message Body */}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 whitespace-pre-line select-text">
              {modalState.message}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2.5 w-full">
              {modalState.isConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleClose(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all active:scale-98 cursor-pointer"
                  >
                    {modalState.cancelText}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClose(true)}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-98 cursor-pointer ${
                      modalState.type === "error" || modalState.type === "warning"
                        ? "bg-rose-600 hover:bg-rose-700 text-white"
                        : currentConfig.btnClass
                    }`}
                  >
                    {modalState.confirmText}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleClose(true)}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-98 cursor-pointer ${currentConfig.btnClass}`}
                >
                  {modalState.confirmText}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AlertModalContext.Provider>
  );
};
