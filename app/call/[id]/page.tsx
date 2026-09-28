"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCall } from "@/components/providers/CallProvider";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

function CallLinkContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const conversationId = params?.id as string;
  const hostUid = searchParams.get("caller") || "";
  const hostName = searchParams.get("name") || "User";
  const hostAvatar = searchParams.get("avatar") || "";
  const requestedType = (searchParams.get("type") as "voice" | "video") || "video";

  const { user, profile, loading } = useAuth();
  const { startCall, endCall, callState } = useCall();

  const [hasInitiated, setHasInitiated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If visitor is not authenticated, redirect to auth with callback
  useEffect(() => {
    if (!loading && !user) {
      const currentUrl = window.location.pathname + window.location.search;
      router.push(`/auth?redirect=${encodeURIComponent(currentUrl)}`);
    }
  }, [loading, user, router]);

  // Handle joining/initiating the call with the host
  const handleJoinCall = async () => {
    if (!user || !hostUid) {
      setErrorMsg("Invalid call link or host information.");
      return;
    }

    try {
      setHasInitiated(true);
      setErrorMsg(null);

      await startCall(
        {
          uid: hostUid,
          displayName: hostName,
          avatarUrl: hostAvatar,
          conversationId,
        },
        requestedType
      );
    } catch (err: any) {
      console.error("Failed to start call from link:", err);
      setErrorMsg(err.message || "Failed to initiate call.");
      setHasInitiated(false);
    }
  };

  const handleCancel = async () => {
    try {
      await endCall();
    } catch (_) {}
    router.push("/chat");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B141A] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Preparing call...</p>
      </div>
    );
  }

  // If this is the host opening their own link
  const isHost = user?.uid === hostUid;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#0a161b] via-[#081216] to-[#04080a] text-white flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Icon name="videocam" size="sm" className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-wide text-white">Veyra Call</span>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Close"
          aria-label="Close"
        >
          <Icon name="close" size="sm" />
        </button>
      </div>

      {/* Main Calling Content */}
      <div className="flex flex-col items-center text-center max-w-md w-full my-auto z-10 py-6">
        {/* Call Type Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold tracking-wider text-emerald-400 uppercase mb-8 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {requestedType === "video" ? "HD Video Call" : "Voice Call"}
        </div>

        {/* Pulsing Avatar */}
        <div className="relative mb-6">
          {hasInitiated && (
            <>
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000 scale-125" />
              <div className="absolute -inset-3 rounded-full border border-emerald-400/30 animate-pulse" />
            </>
          )}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-2xl shadow-emerald-500/20">
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
              {hostAvatar ? (
                <Image
                  src={hostAvatar}
                  alt={hostName}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-white uppercase">
                  {hostName.charAt(0) || "U"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Host Info & Status */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          {hostName}
        </h2>

        {isHost ? (
          <p className="text-slate-300 text-sm max-w-xs leading-relaxed mb-6">
            This is your personal call link. Share this link with others to start a call.
          </p>
        ) : hasInitiated ? (
          <div className="flex flex-col items-center gap-1.5 mb-6">
            <p className="text-emerald-400 font-medium text-base animate-pulse">
              {callState === "ringing" ? "Ringing..." : "Connecting to host..."}
            </p>
            <p className="text-slate-400 text-xs max-w-xs">
              Waiting for {hostName} to accept your call link request
            </p>
          </div>
        ) : (
          <p className="text-slate-300 text-sm max-w-xs leading-relaxed mb-6">
            {hostName} invited you to join a 1-to-1 {requestedType === "video" ? "video" : "voice"} call.
          </p>
        )}

        {errorMsg && (
          <div className="mb-6 p-3 px-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs max-w-xs">
            {errorMsg}
          </div>
        )}

        {/* Action Controls */}
        <div className="w-full flex flex-col items-center gap-3">
          {isHost ? (
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                variant="primary"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Link copied to clipboard!");
                }}
                className="w-full !py-3.5 !rounded-full !bg-emerald-500 hover:!bg-emerald-600 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-base font-semibold"
              >
                <Icon name="content_copy" size="sm" />
                Copy Call Link
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/chat")}
                className="w-full !py-3 !rounded-full text-slate-300 hover:text-white"
              >
                Go to Chat
              </Button>
            </div>
          ) : !hasInitiated ? (
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={handleJoinCall}
                className="w-full py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-bold text-base shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2.5 transition-all"
              >
                <Icon name={requestedType === "video" ? "videocam" : "call"} size="md" />
                <span>Join Call</span>
              </button>
              <button
                onClick={handleCancel}
                className="w-full py-3 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white text-sm font-medium transition-all"
              >
                Decline & Return
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <button
                onClick={handleCancel}
                className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center shadow-xl shadow-rose-500/30 transition-all cursor-pointer"
                title="Cancel Call"
                aria-label="Cancel Call"
              >
                <Icon name="call_end" size="lg" />
              </button>
              <span className="text-xs text-slate-400 mt-1">Cancel</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-md text-center text-slate-500 text-xs z-10 flex items-center justify-center gap-2">
        <Icon name="lock" size="xs" className="text-emerald-500/60" />
        <span>End-to-end encrypted WebRTC audio & video</span>
      </div>
    </div>
  );
}

export default function CallLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B141A] flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 text-sm">Loading call...</p>
        </div>
      }
    >
      <CallLinkContent />
    </Suspense>
  );
}
