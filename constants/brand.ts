export const BRAND = {
  name: "Veyra",
  tagline: "Har Baat, Apno Ke Saath.",
  colors: {
    primaryBlue: "#2563EB",
    primaryTeal: "#14B8A6",
    deepNavy: "#0F172A",
    lightBg: "#F8FAFC",
    mutedText: "#64748B",
  },
  assets: {
    logo: "/assets/main_logo.png",
    aiLogo: "/assets/veyra_ai_logo.png",
    wallpaper: "/assets/default_chat_bg.png",
  },
  ai: {
    name: "Veyra AI",
    bio: "Your friendly AI companion on Veyra — ask questions, brainstorm ideas, learn something new, or just have a chat.",
  },
};

export const NAVIGATION_ITEMS = [
  { id: "chats", label: "Chats", icon: "chat", mobileOrder: 1 },
  { id: "status", label: "Status", icon: "donut_large", mobileOrder: 2 },
  { id: "you", label: "You", icon: "person", mobileOrder: 3 },
  { id: "groups", label: "Groups", icon: "groups", mobileOrder: 4 },
  { id: "settings", label: "Settings", icon: "settings", mobileOrder: 5 },
] as const;

export type NavigationTab = (typeof NAVIGATION_ITEMS)[number]["id"];
