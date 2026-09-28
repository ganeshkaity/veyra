"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Channel, UserProfile, ChatMessage, Conversation } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MessageItem } from "@/components/chat/MessageItem";
import {
  subscribeToMessages,
  sendMessage,
} from "@/lib/firestore/conversationService";
import {
  unfollowChannel,
  formatFollowerCount,
  followChannel,
} from "@/lib/firestore/channelService";

interface ChannelViewProps {
  channel: Channel;
  currentUser: UserProfile;
  onBack: () => void;
}

export const ChannelView: React.FC<ChannelViewProps> = ({
  channel,
  currentUser,
  onBack,
}) => {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Media upload for creator broadcasts
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isCreator = channel.createdBy === currentUser.uid;
  const isFollowing =
    channel.followers?.includes(currentUser.uid) || isCreator;

  // Realtime subscription to channel messages
  useEffect(() => {
    setIsLoadingMessages(true);
    const unsub = subscribeToMessages(
      channel.id,
      50,
      (newMsgs) => {
        setMessages(newMsgs);
        setIsLoadingMessages(false);
      },
      (err) => {
        console.error("Channel messages subscription error:", err);
        setIsLoadingMessages(false);
      }
    );

    return () => unsub();
  }, [channel.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isSearchOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isSearchOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending || !isCreator) return;

    const textToSend = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      await sendMessage(channel.id, {
        conversationId: channel.id,
        senderId: currentUser.uid,
        senderName: channel.name,
        senderAvatar: channel.avatarUrl || channel.avatar || currentUser.avatarUrl,
        text: textToSend,
        type: "text",
      });
    } catch (err) {
      console.error("Failed to post update to channel:", err);
      showToast("Failed to post update");
      setInputText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isCreator) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("File size too large (max 10MB)");
      return;
    }

    try {
      setIsUploadingMedia(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await sendMessage(channel.id, {
          conversationId: channel.id,
          senderId: currentUser.uid,
          senderName: channel.name,
          senderAvatar: channel.avatarUrl || channel.avatar || currentUser.avatarUrl,
          text: "",
          type: "image",
          mediaUrl: base64,
        });
        setIsUploadingMedia(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Media upload error:", err);
      showToast("Failed to upload photo");
      setIsUploadingMedia(false);
    }
  };

  const handleUnfollow = async () => {
    try {
      await unfollowChannel(channel.id, currentUser.uid);
      setShowUnfollowConfirm(false);
      showToast("Unfollowed channel");
      onBack();
    } catch (err) {
      console.error("Unfollow error:", err);
      showToast("Failed to unfollow");
    }
  };

  const handleFollowToggle = async () => {
    try {
      if (isFollowing) {
        setShowUnfollowConfirm(true);
      } else {
        await followChannel(channel.id, currentUser);
        showToast("Following channel! 🔔");
      }
    } catch (err) {
      console.error("Follow toggle error:", err);
    }
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.text?.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : messages;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#EFEAE2] dark:bg-[#0B141A] overflow-hidden relative font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. CHANNEL HEADER (Matches Group Header layout) */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 select-none z-30 shadow-xs">
        {/* Left: Back + Avatar + Channel Name & Follower count */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Back"
            aria-label="Back"
          >
            <Icon name="arrow_back" size="sm" />
          </button>

          <div
            onClick={() => setShowInfoDrawer(true)}
            className="flex items-center gap-3 min-w-0 cursor-pointer group"
          >
            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {channel.avatarUrl || channel.avatar ? (
                <img
                  src={channel.avatarUrl || channel.avatar}
                  alt={channel.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-base uppercase">
                  {channel.name.charAt(0) || "C"}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-[#2563EB] transition-colors">
                  {channel.name}
                </h3>
                {channel.verified && (
                  <span className="w-3.5 h-3.5 rounded-full bg-[#2563EB] text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">
                    ✓
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {formatFollowerCount(channel.followerCount)} • Channel
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Follow / Following button if not creator */}
          {!isCreator && (
            <button
              onClick={handleFollowToggle}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all mr-1.5 ${
                isFollowing
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                  : "bg-[#2563EB] text-white hover:bg-blue-700 shadow-xs"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}

          {/* Search Toggle */}
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="p-2 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Search channel"
          >
            <Icon name="search" size="sm" />
          </button>

          {/* Info Button */}
          <button
            onClick={() => setShowInfoDrawer(true)}
            className="p-2 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Channel Info"
          >
            <Icon name="info" size="sm" />
          </button>
        </div>
      </div>

      {/* In-channel Search Bar */}
      {isSearchOpen && (
        <div className="px-4 py-2 bg-slate-100 dark:bg-[#0A101D] border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-1 duration-150">
          <Icon name="search" size="xs" className="text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search updates in this channel..."
            className="flex-1 bg-transparent border-none text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-slate-600"
            >
              <Icon name="close" size="xs" />
            </button>
          )}
          <button
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery("");
            }}
            className="text-xs font-semibold text-[#2563EB] hover:underline"
          >
            Done
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MESSAGES STREAM (Broadcast Updates) */}
      {/* ======================================================== */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Channel Header Welcome Card */}
        <div className="max-w-md mx-auto my-6 p-6 rounded-3xl bg-white/95 dark:bg-[#111B21]/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm text-center select-none space-y-3">
          <div className="w-20 h-20 rounded-full mx-auto overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-[#2563EB]/30 shadow-md">
            {channel.avatarUrl || channel.avatar ? (
              <img
                src={channel.avatarUrl || channel.avatar}
                alt={channel.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-3xl uppercase">
                {channel.name.charAt(0) || "C"}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {channel.name}
              </h3>
              {channel.verified && (
                <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] font-black flex items-center justify-center">
                  ✓
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {channel.description || "Welcome to the official channel updates."}
            </p>
          </div>
          <div className="pt-1 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <Icon name="lock" size="xs" />
            <span>Public Channel • Phone numbers are hidden</span>
          </div>
        </div>

        {/* Message Items */}
        {isLoadingMessages ? (
          <div className="p-8 flex items-center justify-center text-slate-400">
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-xs">Loading updates...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            {searchQuery
              ? "No updates matched your search."
              : isCreator
              ? "You haven't posted any updates yet. Broadcast your first message below!"
              : "No updates posted yet. Stay tuned!"}
          </div>
        ) : (
          filteredMessages.map((msg, index) => (
            <MessageItem
              key={msg.id}
              message={msg}
              currentUser={currentUser}
              isGroup={true}
              onReply={() => {}}
              onForward={(m) => {
                navigator.clipboard.writeText(m.text || "");
                showToast("Update copied to clipboard 📋");
              }}
              onEdit={() => {}}
              onDeleteForEveryone={() => {}}
              onDeleteForMe={() => {}}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ======================================================== */}
      {/* 3. BOTTOM COMPOSER OR READ-ONLY BANNER */}
      {/* ======================================================== */}
      {isCreator ? (
        /* CREATOR: Full Broadcast Composer Bar */
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white dark:bg-[#0F172A] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 select-none z-20"
        >
          {/* Photo upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingMedia}
            className="p-2.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Broadcast Photo"
          >
            {isUploadingMedia ? (
              <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="add_photo_alternate" size="sm" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleMediaUpload}
          />

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Broadcast an update to followers..."
            className="flex-1 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              inputText.trim() && !isSending
                ? "bg-[#2563EB] text-white hover:bg-blue-700 shadow-md scale-100"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 scale-95"
            }`}
          >
            <Icon name="send" size="sm" />
          </button>
        </form>
      ) : (
        /* FOLLOWER: Read-only WhatsApp/Telegram Style Banner */
        <div className="p-3.5 px-6 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 text-center select-none shadow-lg z-20 flex items-center justify-center gap-2">
          <Icon name="lock" size="xs" className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Only the channel creator can send updates
          </span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. CHANNEL INFO DRAWER (Matching Group Info layout) */}
      {/* ======================================================== */}
      {showInfoDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowInfoDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[420px] h-full bg-white dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200 select-none"
          >
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                Channel Info
              </span>
              <button
                onClick={() => setShowInfoDrawer(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="p-6 flex flex-col items-center text-center border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-md">
                {channel.avatarUrl || channel.avatar ? (
                  <img
                    src={channel.avatarUrl || channel.avatar}
                    alt={channel.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-3xl uppercase">
                    {channel.name.charAt(0) || "C"}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-center gap-1.5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {channel.name}
                  </h3>
                  {channel.verified && (
                    <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] font-black flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatFollowerCount(channel.followerCount)}
                </p>
              </div>

              {channel.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs pt-1">
                  {channel.description}
                </p>
              )}
            </div>

            {/* Member Privacy / Follower list */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Followers ({formatFollowerCount(channel.followerCount)})
                </span>
                {isCreator && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    Admin View
                  </span>
                )}
              </div>

              {isCreator ? (
                /* Creator CAN see joined member count & UIDs */
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    You created this channel. You can post broadcasts and manage followers.
                  </p>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Channel Creator: {channel.createdByName || "You"}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Followers are shielded from public view to protect user privacy.
                    </p>
                  </div>
                </div>
              ) : (
                /* Non-creator: Member list is shielded for privacy! */
                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-2.5">
                  <Icon name="lock" size="xs" className="text-[#2563EB] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Member privacy is protected. Only the channel creator can view the joined members list.
                  </p>
                </div>
              )}
            </div>

            {/* Channel Options & Actions */}
            <div className="p-5 space-y-2 flex-1 flex flex-col justify-end">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  showToast("Channel link copied! 🔗");
                }}
                className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Icon name="share" size="xs" />
                <span>Share Channel Link</span>
              </button>

              {/* Unfollow button in place of Leave Group button */}
              {!isCreator && (
                <button
                  type="button"
                  onClick={() => setShowUnfollowConfirm(true)}
                  className="w-full py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Icon name="logout" size="xs" />
                  <span>Unfollow Channel</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unfollow Confirmation Modal */}
      {showUnfollowConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowUnfollowConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#0F172A] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Unfollow "{channel.name}"?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              You will no longer receive updates from this channel in your Updates feed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnfollowConfirm(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnfollow}
                className="px-5 py-2 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
              >
                Unfollow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
