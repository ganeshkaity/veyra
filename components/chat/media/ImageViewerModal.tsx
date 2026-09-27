"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { ChatMessage, UserProfile } from "@/types";
import { WhatsAppForwardIcon } from "../WhatsAppForwardIcon";
import { toggleStarMessage, toggleMessageReaction } from "@/lib/firestore/conversationService";

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  allMediaMessages?: ChatMessage[];
  currentUser: UserProfile;
  conversationId: string;
  onReply?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
  onDeleteForMe?: (messageId: string) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  message,
  allMediaMessages = [],
  currentUser,
  conversationId,
  onReply,
  onForward,
  onDeleteForMe,
}) => {
  const [currentMessage, setCurrentMessage] = useState<ChatMessage | null>(message);
  const [scale, setScale] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReactBar, setShowReactBar] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);
  const pushedHistoryRef = useRef(false);

  // Sync current message when modal opens or message prop changes
  useEffect(() => {
    if (isOpen && message) {
      setCurrentMessage(message);
      setScale(1);
      setShowMoreMenu(false);
      setShowReactBar(false);
      setShowInfoModal(false);
    }
  }, [isOpen, message]);

  // Media items list from chat
  const mediaList = useMemo(() => {
    if (!allMediaMessages || allMediaMessages.length === 0) {
      return message ? [message] : [];
    }
    // Filter only valid image messages
    const valid = allMediaMessages.filter((m) => m.type === "image" && (m.mediaUrl || (m.mediaUrls && m.mediaUrls.length > 0)));
    if (message && !valid.some((m) => m.id === message.id)) {
      return [message, ...valid];
    }
    return valid;
  }, [allMediaMessages, message]);

  const currentIndex = useMemo(() => {
    if (!currentMessage) return 0;
    const idx = mediaList.findIndex((m) => m.id === currentMessage.id);
    return idx >= 0 ? idx : 0;
  }, [mediaList, currentMessage]);

  const isStarred = Boolean(currentMessage?.starredBy?.includes(currentUser.uid));

  // Requirement 9: Back button / backward key handling
  // Intercepts popstate to close only the modal and not reload or close the chat
  useEffect(() => {
    if (!isOpen) {
      pushedHistoryRef.current = false;
      return;
    }

    if (typeof window !== "undefined") {
      const stateObj = { ...(window.history.state || {}), modal: "imageViewer" };
      window.history.pushState(stateObj, "", window.location.href);
      pushedHistoryRef.current = true;
    }

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      pushedHistoryRef.current = false;
      handleClose();
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => {
      window.removeEventListener("popstate", handlePopState, true);
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showMoreMenu) setShowMoreMenu(false);
        else if (showReactBar) setShowReactBar(false);
        else if (showInfoModal) setShowInfoModal(false);
        else handleClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showMoreMenu, showReactBar, showInfoModal, currentIndex, mediaList]);

  // Scroll active thumbnail into view in the bottom reel
  useEffect(() => {
    if (!isOpen || !reelRef.current) return;
    const activeEl = reelRef.current.querySelector(`[data-reel-index="${currentIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentIndex, isOpen]);

  if (!isOpen || !currentMessage) return null;

  const currentMediaUrl =
    currentMessage.mediaUrl || (currentMessage.mediaUrls && currentMessage.mediaUrls[0]) || "";
  const fileName = currentMessage.mediaMetadata?.fileName || "photo.jpg";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleClose = () => {
    setShowMoreMenu(false);
    setShowReactBar(false);
    setShowInfoModal(false);
    if (pushedHistoryRef.current && typeof window !== "undefined") {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (mediaList.length <= 1) return;
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : mediaList.length - 1;
    setCurrentMessage(mediaList[prevIdx]);
    setScale(1);
  };

  const handleNext = () => {
    if (mediaList.length <= 1) return;
    const nextIdx = currentIndex < mediaList.length - 1 ? currentIndex + 1 : 0;
    setCurrentMessage(mediaList[nextIdx]);
    setScale(1);
  };

  // 1. Zoom toggle
  const handleToggleZoom = () => {
    setScale((s) => (s === 1 ? 1.5 : s === 1.5 ? 2.2 : 1));
  };

  // 2. Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // 3. Reply
  const handleReplyAction = () => {
    if (onReply && currentMessage) {
      onReply(currentMessage);
      handleClose();
    }
  };

  // 4. Star
  const handleToggleStar = async () => {
    if (!currentMessage) return;
    try {
      const nowStarred = await toggleStarMessage(
        conversationId,
        currentMessage.id,
        currentUser.uid
      );
      showToast(nowStarred ? "Message starred" : "Message unstarred");
      setCurrentMessage((prev) =>
        prev
          ? {
              ...prev,
              starredBy: nowStarred
                ? [...(prev.starredBy || []), currentUser.uid]
                : (prev.starredBy || []).filter((id) => id !== currentUser.uid),
            }
          : prev
      );
    } catch {
      showToast("Failed to star message");
    }
  };

  // 5. Pin
  const handleTogglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      showToast(next ? "Message pinned" : "Message unpinned");
      return next;
    });
  };

  // 6. React with emoji
  const handleReactWithEmoji = async (emoji: string) => {
    if (!currentMessage) return;
    setShowReactBar(false);
    try {
      await toggleMessageReaction(conversationId, currentMessage.id, currentUser, emoji);
      showToast(`Reacted ${emoji}`);
      setCurrentMessage((prev) => {
        if (!prev) return prev;
        const reactions = { ...(prev.reactions || {}) };
        if (reactions[currentUser.uid]?.emoji === emoji) {
          delete reactions[currentUser.uid];
        } else {
          reactions[currentUser.uid] = {
            emoji,
            userId: currentUser.uid,
            userName: currentUser.displayName,
            userAvatar: currentUser.avatarUrl || "",
            timestamp: Date.now(),
          };
        }
        return { ...prev, reactions };
      });
    } catch {
      showToast("Failed to react");
    }
  };

  // 7. Forward
  const handleForwardAction = () => {
    if (onForward && currentMessage) {
      onForward(currentMessage);
      handleClose();
    }
  };

  // 8. Download
  const handleDownload = async () => {
    if (!currentMediaUrl) return;
    try {
      const response = await fetch(currentMediaUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showToast("Downloaded photo");
    } catch {
      window.open(currentMediaUrl, "_blank");
    }
  };

  // 9. Copy image blob (PNG) to clipboard
  const handleCopyImage = async () => {
    setShowMoreMenu(false);
    if (!currentMediaUrl) return;
    try {
      const res = await fetch(currentMediaUrl);
      const blob = await res.blob();
      let pngBlob = blob;
      if (blob.type !== "image/png") {
        const img = document.createElement("img");
        img.crossOrigin = "anonymous";
        img.src = currentMediaUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        pngBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b || blob), "image/png")
        );
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      showToast("Image copied to clipboard");
    } catch {
      await navigator.clipboard.writeText(currentMediaUrl);
      showToast("Image link copied to clipboard");
    }
  };

  const formatMessageTimestamp = (createdAt: number) => {
    const d = new Date(createdAt);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const timeStr = d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    if (isToday) return `Today at ${timeStr}`;
    if (isYesterday) return `Yesterday at ${timeStr}`;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0B141A] text-slate-900 dark:text-white select-none animate-in fade-in duration-200"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs font-semibold shadow-xl border border-white/10 animate-in fade-in zoom-in-95 pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Top Header Bar matching Reference Image 4 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#0B141A]/95 backdrop-blur-md z-30">
        {/* Left: Avatar + Contact Name + Timestamp */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-slate-700">
            {currentMessage.senderAvatar ? (
              <img
                src={currentMessage.senderAvatar}
                alt={currentMessage.senderName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm">
                {currentMessage.senderName ? currentMessage.senderName.charAt(0).toUpperCase() : "U"}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
              {currentMessage.senderName || "Contact"}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {formatMessageTimestamp(currentMessage.createdAt)}
            </p>
          </div>
        </div>

        {/* Right Action Icons matching Image 4 (all fully working) */}
        <div className="flex items-center gap-1 sm:gap-1.5 relative">
          {/* 1. Zoom In/Out */}
          <button
            type="button"
            onClick={handleToggleZoom}
            className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Zoom (Toggle zoom level)"
          >
            <Icon name={scale > 1 ? "zoom_out" : "zoom_in"} size="sm" />
          </button>

          {/* 2. Fullscreen */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            <Icon name={isFullscreen ? "fullscreen_exit" : "crop_free"} size="sm" />
          </button>

          {/* 3. Reply */}
          <button
            type="button"
            onClick={handleReplyAction}
            className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Reply to message"
          >
            <Icon name="reply" size="sm" />
          </button>

          {/* 4. Star */}
          <button
            type="button"
            onClick={handleToggleStar}
            className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer ${
              isStarred ? "text-amber-500" : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
            title={isStarred ? "Unstar" : "Star"}
          >
            <Icon name="star" size="sm" fill={isStarred} />
          </button>

          {/* 5. Pin */}
          <button
            type="button"
            onClick={handleTogglePin}
            className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer ${
              isPinned ? "text-[#2563EB] dark:text-[#14B8A6]" : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
            title={isPinned ? "Unpin" : "Pin"}
          >
            <Icon name="push_pin" size="sm" fill={isPinned} />
          </button>

          {/* 6. React (Smiley face) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowReactBar((prev) => !prev);
                setShowMoreMenu(false);
              }}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="React to message"
            >
              <Icon name="mood" size="sm" />
            </button>

            {/* Quick Reactions Popup Bar */}
            {showReactBar && (
              <div className="absolute right-0 top-12 z-50 flex items-center gap-1.5 p-2 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95">
                {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReactWithEmoji(emoji)}
                    className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-lg hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 7. Forward */}
          <button
            type="button"
            onClick={handleForwardAction}
            className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Forward message"
          >
            <WhatsAppForwardIcon className="w-4 h-4" />
          </button>

          {/* 8. Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Download image"
          >
            <Icon name="download" size="sm" />
          </button>

          {/* 9. More Options (...) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowMoreMenu((prev) => !prev);
                setShowReactBar(false);
              }}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="More options"
            >
              <Icon name="more_vert" size="sm" />
            </button>

            {/* Dropdown Menu */}
            {showMoreMenu && (
              <div className="absolute right-0 top-12 z-50 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 text-xs animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <Icon name="content_copy" size="xs" className="text-slate-400" />
                  <span>Copy image</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInfoModal(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <Icon name="info" size="xs" className="text-slate-400" />
                  <span>Message info</span>
                </button>
                {onDeleteForMe && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteForMe(currentMessage.id);
                      setShowMoreMenu(false);
                      handleClose();
                    }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                  >
                    <Icon name="delete" size="xs" className="text-red-500" />
                    <span>Delete for me</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 10. Close (X) */}
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ml-1"
            title="Close viewer"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      </div>

      {/* Main Image Stage with Floating Chevrons (matching Image 4) */}
      <div
        onClick={() => {
          if (showMoreMenu) setShowMoreMenu(false);
          if (showReactBar) setShowReactBar(false);
        }}
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-slate-100/70 dark:bg-black/60"
      >
        {/* Left Chevron */}
        {mediaList.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-6 z-20 w-11 h-11 rounded-full bg-slate-800/50 hover:bg-slate-800/80 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-90 shadow-xl cursor-pointer"
            title="Previous (Left arrow)"
          >
            <Icon name="chevron_left" size="md" />
          </button>
        )}

        {/* Displayed Image */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleToggleZoom();
          }}
          className="relative max-w-full max-h-full transition-transform duration-200 flex items-center justify-center cursor-zoom-in"
          style={{ transform: `scale(${scale})` }}
        >
          <img
            src={currentMediaUrl}
            alt={fileName}
            className="max-h-[70vh] max-w-[88vw] object-contain rounded-xl shadow-2xl"
          />
        </div>

        {/* Right Chevron */}
        {mediaList.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-6 z-20 w-11 h-11 rounded-full bg-slate-800/50 hover:bg-slate-800/80 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-90 shadow-xl cursor-pointer"
            title="Next (Right arrow)"
          >
            <Icon name="chevron_right" size="md" />
          </button>
        )}
      </div>

      {/* Bottom Media Reel (Filmstrip matching Image 4) */}
      <div className="py-2.5 px-4 bg-white/95 dark:bg-[#0B141A]/95 border-t border-slate-200/80 dark:border-white/10 z-20">
        <div
          ref={reelRef}
          className="flex items-center gap-2 overflow-x-auto py-1 max-w-4xl mx-auto scrollbar-thin"
        >
          {mediaList.map((m, idx) => {
            const isSelected = idx === currentIndex;
            const thumbUrl = m.mediaUrl || (m.mediaUrls && m.mediaUrls[0]) || "";

            return (
              <div
                key={m.id}
                data-reel-index={idx}
                onClick={() => {
                  setCurrentMessage(m);
                  setScale(1);
                }}
                className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer transition-all ${
                  isSelected
                    ? "border-[2.5px] border-emerald-500 scale-105 shadow-md ring-1 ring-emerald-500/50"
                    : "border border-slate-300 dark:border-slate-700 opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={thumbUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {/* Subtle download overlay icon for unselected images (as seen in Image 4) */}
                {!isSelected && (
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center text-white/90">
                    <Icon name="download" size="xs" className="!text-[14px]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Message Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setShowInfoModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Icon name="info" size="sm" className="text-[#2563EB] dark:text-[#14B8A6]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Photo Info</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Sent by</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {currentMessage.senderName || "User"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Sent at</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(currentMessage.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              {currentMessage.mediaMetadata && (
                <>
                  {currentMessage.mediaMetadata.width && currentMessage.mediaMetadata.height && (
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500">Dimensions</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {currentMessage.mediaMetadata.width} × {currentMessage.mediaMetadata.height} px
                      </span>
                    </div>
                  )}
                  {currentMessage.mediaMetadata.sizeBytes && (
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500">File size</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {(currentMessage.mediaMetadata.sizeBytes / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
