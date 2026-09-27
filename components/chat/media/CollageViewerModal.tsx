"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { ChatMessage, UserProfile } from "@/types";
import { toggleStarMessage } from "@/lib/firestore/conversationService";

interface CollageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  initialIndex?: number;
  currentUser: UserProfile;
  onReply?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage, selectedUrls?: string[]) => void;
  onDeleteSelectedImages?: (message: ChatMessage, selectedUrls: string[]) => void;
}

export const CollageViewerModal: React.FC<CollageViewerModalProps> = ({
  isOpen,
  onClose,
  message,
  initialIndex = 0,
  currentUser,
  onReply,
  onForward,
  onDeleteSelectedImages,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isStarred, setIsStarred] = useState(false);

  const pushedHistoryRef = useRef(false);

  // Sync initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsSelectionMode(false);
      setSelectedUrls(new Set());
      setContextMenuPos(null);
      setScale(1);
      if (message) {
        setIsStarred(Boolean(message.starredBy?.includes(currentUser.uid)));
      }
    }
  }, [isOpen, initialIndex, message, currentUser.uid]);

  // Requirement 8: Back button / backward key handling
  useEffect(() => {
    if (!isOpen) {
      pushedHistoryRef.current = false;
      return;
    }

    if (typeof window !== "undefined") {
      const stateObj = { ...(window.history.state || {}), modal: "collageViewer" };
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

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (contextMenuPos) {
          setContextMenuPos(null);
        } else if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedUrls(new Set());
        } else {
          handleClose();
        }
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, contextMenuPos, isSelectionMode]);

  if (!isOpen || !message) return null;

  const images: string[] =
    message.mediaUrls && message.mediaUrls.length > 0
      ? message.mediaUrls
      : message.mediaUrl
      ? [message.mediaUrl]
      : [];

  if (images.length === 0) return null;

  const currentUrl = images[currentIndex] || images[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleClose = () => {
    setContextMenuPos(null);
    setIsSelectionMode(false);
    setSelectedUrls(new Set());
    if (pushedHistoryRef.current && typeof window !== "undefined") {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setScale(1);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setScale(1);
  };

  const handleToggleSelectUrl = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedUrls.size === images.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(images));
    }
  };

  const handleDownloadActive = async () => {
    try {
      const res = await fetch(currentUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `photo-${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast("Downloaded photo");
    } catch {
      window.open(currentUrl, "_blank");
    }
  };

  const handleCopyImage = async () => {
    try {
      const res = await fetch(currentUrl);
      const blob = await res.blob();
      let pngBlob = blob;
      if (blob.type !== "image/png") {
        const img = document.createElement("img");
        img.crossOrigin = "anonymous";
        img.src = currentUrl;
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
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      showToast("Image copied to clipboard");
    } catch {
      await navigator.clipboard.writeText(currentUrl);
      showToast("Image link copied to clipboard");
    }
    setContextMenuPos(null);
  };

  const handleToggleStar = async () => {
    try {
      const nowStarred = await toggleStarMessage(
        message.conversationId,
        message.id,
        currentUser.uid
      );
      setIsStarred(nowStarred);
      showToast(nowStarred ? "Message starred" : "Message unstarred");
    } catch {
      showToast("Failed to star message");
    }
    setContextMenuPos(null);
  };

  const handleForwardAction = () => {
    const list = selectedUrls.size > 0 ? Array.from(selectedUrls) : [currentUrl];
    if (onForward) {
      onForward(message, list);
    }
    setContextMenuPos(null);
  };

  const handleDeleteSelected = () => {
    if (selectedUrls.size === 0) return;
    if (onDeleteSelectedImages) {
      onDeleteSelectedImages(message, Array.from(selectedUrls));
    }
    showToast(`Deleted ${selectedUrls.size} photos`);
    setIsSelectionMode(false);
    setSelectedUrls(new Set());
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-xl border border-white/10 animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent text-white z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <Icon name="arrow_back" size="sm" />
          </button>

          <div className="min-w-0">
            <h4 className="text-sm font-bold truncate">
              {message.senderName || "Photos"}
            </h4>
            <p className="text-xs text-white/60 truncate font-mono">
              {currentIndex + 1} of {images.length} •{" "}
              {new Date(message.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>

        {/* Selection mode or normal actions */}
        <div className="flex items-center gap-2">
          {isSelectionMode ? (
            <>
              <span className="text-xs font-semibold text-white/80 mr-1">
                {selectedUrls.size} selected
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition-colors"
              >
                {selectedUrls.size === images.length ? "Deselect All" : "Select All"}
              </button>
              <button
                type="button"
                onClick={handleForwardAction}
                disabled={selectedUrls.size === 0}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white disabled:opacity-40 transition-colors"
                title="Forward selected"
              >
                <Icon name="forward" size="sm" />
              </button>
              <button
                type="button"
                onClick={handleToggleStar}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="Star"
              >
                <Icon name={isStarred ? "star" : "star_border"} size="sm" fill={isStarred} />
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selectedUrls.size === 0}
                className="p-2 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                title="Delete selected"
              >
                <Icon name="delete" size="sm" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedUrls(new Set());
                }}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors ml-1"
                title="Cancel selection"
              >
                <Icon name="close" size="sm" />
              </button>
            </>
          ) : (
            <>
              {/* Select mode toggle button */}
              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(true);
                  setSelectedUrls(new Set([currentUrl]));
                }}
                className="px-3 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition-colors cursor-pointer"
                title="Select multiple photos"
              >
                Select
              </button>

              {/* Zoom In/Out */}
              <button
                type="button"
                onClick={() => setScale((s) => (s >= 2 ? 1 : s + 0.5))}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Zoom"
              >
                <Icon name={scale > 1 ? "zoom_out" : "zoom_in"} size="sm" />
              </button>

              {/* Star */}
              <button
                type="button"
                onClick={handleToggleStar}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer ${
                  isStarred ? "text-amber-400" : "text-white/80 hover:text-white"
                }`}
                title="Star message"
              >
                <Icon name={isStarred ? "star" : "star_border"} size="sm" fill={isStarred} />
              </button>

              {/* Forward */}
              <button
                type="button"
                onClick={handleForwardAction}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Forward"
              >
                <Icon name="forward" size="sm" />
              </button>

              {/* Download */}
              <button
                type="button"
                onClick={handleDownloadActive}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Download"
              >
                <Icon name="download" size="sm" />
              </button>

              {/* More / Context Menu trigger */}
              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenuPos({ x: rect.left, y: rect.bottom + 8 });
                }}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="More options"
              >
                <Icon name="more_vert" size="sm" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-white/20 text-white transition-colors ml-1 cursor-pointer"
                title="Close"
              >
                <Icon name="close" size="sm" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Image Stage with Left and Right Chevrons */}
      <div
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenuPos({ x: e.clientX, y: e.clientY });
        }}
        onClick={() => {
          if (contextMenuPos) setContextMenuPos(null);
        }}
      >
        {/* Left Chevron */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-lg cursor-pointer"
            title="Previous photo (Left arrow)"
          >
            <Icon name="chevron_left" size="md" />
          </button>
        )}

        {/* Displayed Image */}
        <div
          className="relative max-w-full max-h-full transition-transform duration-200 flex items-center justify-center"
          style={{ transform: `scale(${scale})` }}
        >
          <img
            src={currentUrl}
            alt={`Photo ${currentIndex + 1}`}
            className="max-h-[72vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />

          {/* Selection Checkbox overlay */}
          {isSelectionMode && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSelectUrl(currentUrl);
              }}
              className="absolute top-4 right-4 z-20 cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-lg transition-transform ${
                  selectedUrls.has(currentUrl)
                    ? "bg-[#2563EB] border-[#2563EB] scale-110 text-white"
                    : "bg-black/60 border-white/80 text-transparent hover:scale-105"
                }`}
              >
                ✓
              </div>
            </div>
          )}
        </div>

        {/* Right Chevron */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-lg cursor-pointer"
            title="Next photo (Right arrow)"
          >
            <Icon name="chevron_right" size="md" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip (Reel) */}
      <div className="p-3 bg-gradient-to-t from-black/90 to-black/40 backdrop-blur-md z-20">
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 max-w-3xl mx-auto scrollbar-thin">
          {images.map((url, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (isSelectionMode) {
                  handleToggleSelectUrl(url);
                } else {
                  setCurrentIndex(idx);
                  setScale(1);
                }
              }}
              className={`relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer border-2 transition-all ${
                idx === currentIndex
                  ? "border-emerald-500 scale-105 shadow-md"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />

              {/* Checkbox indicator in selection mode */}
              {isSelectionMode && selectedUrls.has(url) && (
                <div className="absolute inset-0 bg-[#2563EB]/40 flex items-center justify-center text-white text-xs font-bold">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp Right-click / Context Menu Modal */}
      {contextMenuPos && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-52 bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 text-xs text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95"
          style={{
            top: Math.min(contextMenuPos.y, window.innerHeight - 300),
            left: Math.min(contextMenuPos.x, window.innerWidth - 220),
          }}
        >
          {/* Reply */}
          <button
            type="button"
            onClick={() => {
              if (onReply) onReply(message);
              setContextMenuPos(null);
              handleClose();
            }}
            className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="reply" size="xs" className="text-slate-400" />
            <span>Reply</span>
          </button>

          {/* Copy Image */}
          <button
            type="button"
            onClick={handleCopyImage}
            className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="content_copy" size="xs" className="text-slate-400" />
            <span>Copy Image</span>
          </button>

          {/* Forward */}
          <button
            type="button"
            onClick={handleForwardAction}
            className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="forward" size="xs" className="text-slate-400" />
            <span>Forward</span>
          </button>

          {/* Star */}
          <button
            type="button"
            onClick={handleToggleStar}
            className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon
              name="star"
              size="xs"
              className={isStarred ? "text-amber-400" : "text-slate-400"}
              fill={isStarred}
            />
            <span>{isStarred ? "Unstar" : "Star"}</span>
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={() => {
              handleDownloadActive();
              setContextMenuPos(null);
            }}
            className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="download" size="xs" className="text-slate-400" />
            <span>Download</span>
          </button>

          {/* Select Mode */}
          <button
            type="button"
            onClick={() => {
              setIsSelectionMode(true);
              setSelectedUrls(new Set([currentUrl]));
              setContextMenuPos(null);
            }}
            className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800"
          >
            <Icon name="check_circle" size="xs" className="text-slate-400" />
            <span>Select</span>
          </button>
        </div>
      )}
    </div>
  );
};
