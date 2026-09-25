"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { NavigationTab } from "@/constants/brand";
import { Conversation } from "@/types";
import { subscribeToConversations } from "@/lib/firestore/conversationService";
import { getVeyraAiConversation, VEYRA_AI_CONVERSATION_ID } from "@/lib/ai/aiService";
import { DesktopSidebarNav } from "@/components/chat/DesktopSidebarNav";
import { MobileBottomNav } from "@/components/chat/MobileBottomNav";
import { ChatList } from "@/components/chat/ChatList";
import { ConversationView } from "@/components/chat/ConversationView";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { CreateGroupModal } from "@/components/groups/CreateGroupModal";
import { StatusView } from "@/components/status/StatusView";
import { GroupsView } from "@/components/groups/GroupsView";
import { ProfileView } from "@/components/profile/ProfileView";
import { SettingsView } from "@/components/settings/SettingsView";
import { ArchivedChatsView } from "@/components/chat/ArchivedChatsView";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export interface ChatPageProps {
  initialArchive?: boolean;
}

export default function ChatPage({ initialArchive = false }: ChatPageProps) {
  const router = useRouter();
  const { user, profile, loading, isEmailVerified, is2FAPending } = useAuth();

  const [activeTab, setActiveTab] = useState<NavigationTab>("chats");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(initialArchive);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);

  // Strict route protection guard
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/auth");
      return;
    }

    if (!isEmailVerified) {
      router.replace("/auth?mode=verify-email");
      return;
    }

    if (is2FAPending) {
      router.replace("/auth");
      return;
    }

    if (!profile) {
      router.replace("/auth?mode=onboarding");
      return;
    }
  }, [user, profile, loading, isEmailVerified, is2FAPending, router]);

  // Subscribe to user conversations
  useEffect(() => {
    if (!user) return;
    setIsLoadingConversations(true);
    const unsub = subscribeToConversations(
      user.uid,
      (convos) => {
        setConversations(convos);
        setIsLoadingConversations(false);
      },
      (err) => {
        console.error("Failed to load conversations:", err);
        setIsLoadingConversations(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Open / Select conversation with client-side history navigation
  const handleSelectConversation = (id: string | null, fromArchive?: boolean) => {
    if (!id) {
      handleCloseConversation();
      return;
    }

    if (id === selectedConversationId) return;

    setSelectedConversationId(id);

    const inArchive = fromArchive !== undefined ? fromArchive : isArchiveOpen;

    if (typeof window !== "undefined") {
      const basePath = inArchive ? "/archive/chat" : "/chat";
      const url = `${basePath}?chat=${encodeURIComponent(id)}`;

      // When opening a chat from the chat list, add a browser history entry so Back returns to chat/archive list.
      // If switching directly between open chats (e.g. desktop), replace state so Back still returns to list.
      if (!selectedConversationId) {
        window.history.pushState({ chatId: id, inArchive }, "", url);
      } else {
        window.history.replaceState({ chatId: id, inArchive }, "", url);
      }
    }
  };

  // Close active conversation and reset URL
  const handleCloseConversation = () => {
    setSelectedConversationId(null);
    if (typeof window !== "undefined") {
      const resetPath = isArchiveOpen ? "/archive" : "/chat";
      window.history.replaceState({ chatId: null, inArchive: isArchiveOpen }, "", resetPath);
    }
  };

  // Mobile Back button: pop browser history if entry was pushed, else close chat
  const handleBackMobile = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("chat") || params.has("id") || params.has("ai")) {
        window.history.back();
        return;
      }
    }
    handleCloseConversation();
  };

  // Open Archived Chats View (Client-side history without reload)
  const handleOpenArchive = () => {
    setIsArchiveOpen(true);
    if (typeof window !== "undefined") {
      window.history.pushState({ inArchive: true }, "", "/archive");
    }
  };

  // Close Archived Chats View and return to standard chat list
  const handleCloseArchive = () => {
    setIsArchiveOpen(false);
    setSelectedConversationId(null);
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/archive")) {
        window.history.pushState({ inArchive: false }, "", "/chat");
      }
    }
  };

  // Handle browser & Android Back / Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const pathname = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const chatIdFromUrl = params.get("chat") || params.get("id");
      const isAi = params.get("ai") === "true";

      const inArchive = pathname.startsWith("/archive");
      setIsArchiveOpen(inArchive);

      if (chatIdFromUrl) {
        setSelectedConversationId(chatIdFromUrl);
      } else if (isAi) {
        setSelectedConversationId(VEYRA_AI_CONVERSATION_ID);
      } else {
        // Back pressed while viewing chat: close chat & return to list
        setSelectedConversationId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Parse initial chat query param on mount and set up history stack
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;
    const inArchive = initialArchive || pathname.startsWith("/archive");
    if (inArchive) {
      setIsArchiveOpen(true);
    }

    const params = new URLSearchParams(window.location.search);
    const initialChatId = params.get("chat") || params.get("id");
    const isAi = params.get("ai") === "true";

    const basePath = inArchive ? "/archive" : "/chat";
    const chatPath = inArchive ? "/archive/chat" : "/chat";

    if (initialChatId) {
      setSelectedConversationId(initialChatId);
      window.history.replaceState({ chatId: null, inArchive }, "", basePath);
      window.history.pushState(
        { chatId: initialChatId, inArchive },
        "",
        `${chatPath}?chat=${encodeURIComponent(initialChatId)}`
      );
    } else if (isAi) {
      setSelectedConversationId(VEYRA_AI_CONVERSATION_ID);
      window.history.replaceState({ chatId: null, inArchive }, "", basePath);
      window.history.pushState(
        { chatId: VEYRA_AI_CONVERSATION_ID, inArchive },
        "",
        `${chatPath}?chat=ai_veyra`
      );
    }
  }, [initialArchive]);

  // Open Veyra AI companion conversation
  const handleOpenAi = () => {
    if (!user) return;
    setActiveTab("chats");
    handleSelectConversation(VEYRA_AI_CONVERSATION_ID);
  };

  // Track selected conversation with immediate fallback for newly opened direct chats
  const [directFallbackConv, setDirectFallbackConv] = useState<Conversation | null>(null);

  useEffect(() => {
    if (!selectedConversationId || selectedConversationId === VEYRA_AI_CONVERSATION_ID || selectedConversationId.startsWith("ai_")) {
      setDirectFallbackConv(null);
      return;
    }
    const found = conversations.find((c) => c.id === selectedConversationId);
    if (!found) {
      import("firebase/firestore").then(({ doc, getDoc }) => {
        import("@/lib/firebase/client").then(({ db }) => {
          const convRef = doc(db, "conversations", selectedConversationId);
          getDoc(convRef).then((snap) => {
            if (snap.exists()) {
              setDirectFallbackConv({ id: snap.id, ...snap.data() } as Conversation);
            }
          });
        });
      });
    } else {
      setDirectFallbackConv(null);
    }
  }, [selectedConversationId, conversations]);

  // Find selected conversation (including AI conversation)
  const isAiSelected =
    selectedConversationId === VEYRA_AI_CONVERSATION_ID ||
    (selectedConversationId ? selectedConversationId.startsWith("ai_") : false);

  const currentConversation: Conversation | null = selectedConversationId
    ? isAiSelected && user
      ? getVeyraAiConversation(user.uid)
      : conversations.find((c) => c.id === selectedConversationId) || directFallbackConv || null
    : null;

  if (loading || !user || !isEmailVerified || is2FAPending || !profile) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-app)]">
  {/* Logo */}
  <div className="relative mb-6">
    {/* Soft ambient glow */}
    <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-2xl animate-pulse" />

    {/* Logo container */}
    <div className="relative w-24 h-24 flex items-center justify-center rounded-3xl animate-[float_2.8s_ease-in-out_infinite]">
      <Image
        src="/assets/favicon.png"
        alt="Veyra"
        width={88}
        height={88}
        className="object-contain drop-shadow-xl"
        priority
      />
    </div>
  </div>

  {/* Loading dots */}
  <div className="flex items-center gap-1.5 mb-3">
    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-[dot_1.4s_ease-in-out_infinite]" />
    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-[dot_1.4s_ease-in-out_0.2s_infinite]" />
    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-[dot_1.4s_ease-in-out_0.4s_infinite]" />
  </div>

  <p className="text-xs text-slate-400/80 font-medium tracking-wide">
    Opening Veyra
  </p>

  <style jsx>{`
    @keyframes float {
      0%, 100% {
        transform: translateY(0) scale(1);
      }
      50% {
        transform: translateY(-6px) scale(1.025);
      }
    }

    @keyframes dot {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.35;
      }
      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }
  `}</style>
</div>
    );
  }

  return (
    <div className="flex h-[100dvh] h-screen w-full max-w-[100vw] overflow-hidden bg-[var(--bg-app)]">
      {/* Desktop Left Sidebar Navigation */}
      <DesktopSidebarNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "chats") {
            setActiveTab("chats");
          } else if (tab === "status") {
            router.push("/status");
          } else if (tab === "groups") {
            router.push("/groups");
          } else if (tab === "you") {
            router.push("/profile");
          } else if (tab === "settings") {
            router.push("/setting");
          }
        }}
        onOpenAi={handleOpenAi}
      />

      {/* Main View Area */}
      <div className="flex-1 flex h-full overflow-hidden relative min-w-0">
        {/* TAB: CHATS */}
        {activeTab === "chats" && (
          <div className="flex h-full w-full overflow-hidden">
            {/* Chat List or Archived List (Side panel on desktop, full page on mobile) */}
            <div
              className={`h-full w-full md:w-80 lg:w-96 md:flex-shrink-0 ${
                selectedConversationId ? "hidden md:block" : "block"
              }`}
            >
              {isArchiveOpen ? (
                <ArchivedChatsView
                  conversations={conversations}
                  currentUser={profile}
                  selectedConversationId={selectedConversationId}
                  onSelectConversation={(id) => handleSelectConversation(id, true)}
                  onBack={handleCloseArchive}
                  onArchiveToggle={() => setConversations([...conversations])}
                />
              ) : (
                <ChatList
                  conversations={conversations}
                  currentUser={profile}
                  selectedConversationId={selectedConversationId}
                  onSelectConversation={(id) => handleSelectConversation(id, false)}
                  onNewChat={() => setIsNewChatModalOpen(true)}
                  onNewGroup={() => setIsNewGroupModalOpen(true)}
                  isLoading={isLoadingConversations}
                  onOpenArchive={handleOpenArchive}
                  onArchiveToggle={() => setConversations([...conversations])}
                />
              )}
            </div>

            {/* Conversation Area */}
            <div
              className={`flex-1 h-full min-w-0 ${
                selectedConversationId
                  ? "block animate-in fade-in slide-in-from-right-2 duration-150"
                  : "hidden md:flex"
              }`}
            >
              {currentConversation ? (
                <ConversationView
                  conversation={currentConversation}
                  currentUser={profile}
                  onBackMobile={handleBackMobile}
                />
              ) : (
                /* Desktop Welcome Empty State */
                <div className="hidden md:flex flex-col items-center justify-center flex-1 h-full bg-slate-50 dark:bg-[#0B1120] text-center p-8 select-none border-b-4 border-[#2563EB]">
                  <div className="relative mb-6">
                    <div className="w-32 h-32 flex items-center justify-center">
                      <Image
                        src="/assets/favicon.png"
                        alt="Veyra"
                        width={112}
                        height={112}
                        priority
                        className="object-contain"
                      />
                    </div>
                  </div>

                  <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-1">
                    Veyra Web
                  </h3>
                  <p className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#14B8A6] mb-4">
                    "Har Baat, Apno Ke Saath."
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                    Select a conversation from the left to start messaging, or search for a username to start a new chat.
                  </p>

                  <div className="flex items-center gap-3">
                    <Button
                      size="md"
                      onClick={() => setIsNewChatModalOpen(true)}
                      leftIcon={<Icon name="chat" size="sm" />}
                    >
                      Start a New Chat
                    </Button>
                    <Button
                      size="md"
                      variant="outline"
                      onClick={() => setIsNewGroupModalOpen(true)}
                      leftIcon={<Icon name="groups" size="sm" />}
                    >
                      New Group
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-12">
                    <Icon name="lock" size="xs" />
                    <span>Protected by end-to-end authentication and verified rules</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB: STATUS */}
        {activeTab === "status" && <StatusView currentUser={profile} />}

        {/* TAB: GROUPS */}
        {activeTab === "groups" && (
          <GroupsView
            currentUser={profile}
            conversations={conversations}
            onSelectGroupConversation={(groupId) => {
              setActiveTab("chats");
              handleSelectConversation(groupId);
            }}
          />
        )}

        {/* TAB: YOU (PROFILE) */}
        {activeTab === "you" && <ProfileView currentUser={profile} />}

        {/* TAB: SETTINGS */}
        {activeTab === "settings" && <SettingsView currentUser={profile} />}
      </div>

      {/* Mobile Bottom Navigation (Hidden when inside active conversation on mobile) */}
      {!selectedConversationId && (
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === "chats") {
              setActiveTab("chats");
            } else if (tab === "status") {
              router.push("/status");
            } else if (tab === "groups") {
              router.push("/groups");
            } else if (tab === "you") {
              router.push("/profile");
            } else if (tab === "settings") {
              router.push("/setting");
            }
          }}
        />
      )}

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        currentUser={profile}
        onConversationCreated={(convId) => {
          handleSelectConversation(convId);
        }}
        onOpenNewGroup={() => setIsNewGroupModalOpen(true)}
      />

      {/* New Group Modal */}
      <CreateGroupModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        currentUser={profile}
        conversations={conversations}
        onGroupCreated={(groupId) => {
          handleSelectConversation(groupId);
        }}
      />
    </div>
  );
}
