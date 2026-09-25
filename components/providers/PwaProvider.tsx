"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type PlatformType = "android" | "ios" | "desktop" | "other";

interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  platform: PlatformType;
  installApp: () => Promise<boolean>;
  openInstallModal: () => void;
  closeInstallModal: () => void;
  isInstallModalOpen: boolean;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isInstalled: false,
  platform: "other",
  installApp: async () => false,
  openInstallModal: () => {},
  closeInstallModal: () => {},
  isInstallModalOpen: false,
});

export const usePwa = () => useContext(PwaContext);

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformType>("other");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect user platform
    const ua = window.navigator.userAgent.toLowerCase();
    if (/android/i.test(ua)) {
      setPlatform("android");
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      setPlatform("ios");
    } else if (/windows|macintosh|linux/i.test(ua)) {
      setPlatform("desktop");
    }

    // Check if running in standalone PWA / TWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
    }

    // Check if secure context
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      console.warn(
        "[Veyra PWA] Insecure context: " +
          window.location.origin +
          ". Chrome on Android requires HTTPS or localhost (run: adb reverse tcp:3000 tcp:3000) for WebAPK/TWA install prompts."
      );
    }

    let autoPromptHandled = false;

    // Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);

      // On Android / mobile: trigger the native install dialog automatically on the first user interaction
      const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isMobile && !autoPromptHandled) {
        const triggerAutoPrompt = async () => {
          window.removeEventListener("click", triggerAutoPrompt);
          window.removeEventListener("touchend", triggerAutoPrompt);
          if (!autoPromptHandled && e) {
            autoPromptHandled = true;
            try {
              await (e as any).prompt();
            } catch (err) {
              console.log("[Veyra PWA] Auto prompt:", err);
            }
          }
        };

        window.addEventListener("click", triggerAutoPrompt, { once: true });
        window.addEventListener("touchend", triggerAutoPrompt, { once: true });
      }
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsInstallModalOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for service worker updates
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("Veyra updated. New content ready.");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("Veyra ServiceWorker registration failed:", err);
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setDeferredPrompt(null);
          setIsInstallable(false);
          return true;
        }
      } catch (err) {
        console.error("Installation prompt error:", err);
      }
    }
    // If prompt wasn't triggered automatically, open the visual install guide
    setIsInstallModalOpen(true);
    return false;
  };

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        platform,
        installApp,
        openInstallModal: () => setIsInstallModalOpen(true),
        closeInstallModal: () => setIsInstallModalOpen(false),
        isInstallModalOpen,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};
