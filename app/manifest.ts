import { headers } from "next/headers";
import type { MetadataRoute } from "next";

// Narrow (mobile) screenshots  720x1280, aspect ratio 9:16
const narrowScreenshots = [
  { src: "/screenshots/mobile1.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Chats & Filter Lists" },
  { src: "/screenshots/mobile2.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Direct Conversation & Voice" },
  { src: "/screenshots/mobile3.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Status Updates & Stories" },
  { src: "/screenshots/mobile4.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Status Reactions & Replies" },
  { src: "/screenshots/mobile5.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Passkey Protected Lock Chats" },
  { src: "/screenshots/mobile6.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Manage Custom Chat Lists" },
  { src: "/screenshots/mobile7.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Settings & Account Privacy" },
  { src: "/screenshots/mobile8.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Appearance & Dynamic Themes" },
];

// Wide (desktop) screenshots  1280x720, aspect ratio 16:9
const wideScreenshots = [
  { src: "/screenshots/desktop1.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Chats & Chat Lists" },
  { src: "/screenshots/desktop2.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Real-Time Conversation" },
  { src: "/screenshots/desktop3.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Status & Stories Feed" },
  { src: "/screenshots/desktop4.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Status Reply Input" },
  { src: "/screenshots/desktop5.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Lock Chat Privacy" },
  { src: "/screenshots/desktop6.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Settings & Account" },
  { src: "/screenshots/desktop7.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Themes & Appearance" },
];

const baseManifest = {
  name: "Veyra - Har Baat, Apno Ke Saath",
  short_name: "Veyra",
  description: "A modern, secure, and fast messaging application built with real-time sync, stories, and end-to-end privacy.",
  start_url: "/chat",
  id: "/chat",
  scope: "/",
  display: "standalone" as const,
  background_color: "#0B1120",
  theme_color: "#2563EB",
  lang: "en",
  dir: "ltr" as const,
  categories: ["social", "communication", "utilities"],
  icons: [
    { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" as const },
    { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" as const },
    { src: "/icons/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
  ],
  shortcuts: [
    { name: "Chats", short_name: "Chats", description: "Open your active conversations", url: "/chat", icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }] },
    { name: "Status Updates", short_name: "Status", description: "View contact statuses and stories", url: "/status", icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }] },
    { name: "Settings", short_name: "Settings", description: "Configure your account and preferences", url: "/setting", icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }] },
  ],
  prefer_related_applications: false,
};

export default async function manifest() {
  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";

  // Detect Android  Chrome on Android requests the manifest with an Android UA.
  // We serve ONLY the platform-matching form_factor so Chrome'"'"'s 8-screenshot
  // counter is never wasted on screenshots it will skip anyway.
  // See: InstallableDataFetcher::OnScreenshotFetched in Chromium source �
  // the counter increments for ALL screenshots before the form_factor check.
  const isAndroid = /android/i.test(ua);

  return {
    ...baseManifest,
    screenshots: isAndroid ? narrowScreenshots : wideScreenshots,
  };
}
