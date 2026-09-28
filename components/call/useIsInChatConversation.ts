"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Detects whether the current user is actively inside a chat conversation.
 * Returns true if:
 * 1. User is on /chat or /archive/chat AND has an active conversation open
 * 2. On desktop (viewport >= 768px) where conversation pane is visible
 */
export function useIsInChatConversation(): boolean {
  const pathname = usePathname();
  const [hasChatParam, setHasChatParam] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const updateLocationState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const hasParam = params.has("chat") || params.has("id") || params.has("ai");
      setHasChatParam(hasParam);
      setIsDesktop(window.innerWidth >= 768);
    };

    updateLocationState();

    window.addEventListener("popstate", updateLocationState);
    window.addEventListener("resize", updateLocationState);

    const interval = setInterval(updateLocationState, 400);

    return () => {
      window.removeEventListener("popstate", updateLocationState);
      window.removeEventListener("resize", updateLocationState);
      clearInterval(interval);
    };
  }, []);

  if (!pathname) return false;

  const isChatRoute =
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    pathname.startsWith("/archive/chat");

  if (!isChatRoute) return false;

  return isDesktop || hasChatParam;
}
