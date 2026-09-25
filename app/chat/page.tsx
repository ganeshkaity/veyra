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
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function ChatPage() {
  const router = useRouter();
  const { user, profile, loading, isEmailVerified, is2FAPending } = useAuth();

  const [activeTab, setActiveTab] = useState<NavigationTab>("chats");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
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

  // Open Veyra AI companion conversation
  const handleOpenAi = () => {
    if (!user) return;
    setActiveTab("chats");
    setSelectedConversationId(VEYRA_AI_CONVERSATION_ID);
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
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg p-2 bg-white dark:bg-slate-900 mb-4 animate-pulse">
          <Image
            src="/assets/main_logo.png"
            alt="Veyra"
            width={64}
            height={64}
            className="object-contain"
          />
        </div>
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 mt-3 font-medium">Opening Veyra...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] h-screen w-full max-w-[100vw] overflow-hidden bg-[var(--bg-app)]">
      {/* Desktop Left Sidebar Navigation */}
      <DesktopSidebarNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          // When switching tabs on desktop, clear selected conversation if moving away from chats
          if (tab !== "chats") {
            setSelectedConversationId(null);
          }
        }}
        onOpenAi={handleOpenAi}
      />

      {/* Main View Area */}
      <div className="flex-1 flex h-full overflow-hidden relative min-w-0">
        {/* TAB: CHATS */}
        {activeTab === "chats" && (
          <div className="flex h-full w-full overflow-hidden">
            {/* Chat List (Full width on mobile when no conversation selected, responsive width on desktop) */}
            <div
              className={`h-full w-full md:w-80 lg:w-96 md:flex-shrink-0 ${
                selectedConversationId ? "hidden md:block" : "block"
              }`}
            >
              <ChatList
                conversations={conversations}
                currentUser={profile}
                selectedConversationId={selectedConversationId}
                onSelectConversation={(id) => setSelectedConversationId(id)}
                onNewChat={() => setIsNewChatModalOpen(true)}
                onNewGroup={() => setIsNewGroupModalOpen(true)}
                isLoading={isLoadingConversations}
              />
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
                  onBackMobile={() => setSelectedConversationId(null)}
                />
              ) : (
                /* Desktop Welcome Empty State */
                <div className="hidden md:flex flex-col items-center justify-center flex-1 h-full bg-slate-50 dark:bg-[#0B1120] text-center p-8 select-none border-b-4 border-[#2563EB]">
                  <div className="relative mb-6">
                    <div className="w-32 h-32 rounded-3xl bg-white dark:bg-slate-900 shadow-xl p-4 flex items-center justify-center ring-1 ring-black/5 dark:ring-white/10">
                      <Image
                        src="/assets/main_logo.png"
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
              setSelectedConversationId(groupId);
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
            setActiveTab(tab);
            setSelectedConversationId(null);
          }}
        />
      )}

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        currentUser={profile}
        onConversationCreated={(convId) => {
          setSelectedConversationId(convId);
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
          setSelectedConversationId(groupId);
        }}
      />
    </div>
  );
}
