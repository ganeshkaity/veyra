"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getGroupByInviteCode,
  joinGroupByInviteCode,
  GroupInvitePreview,
} from "@/lib/firestore/groupService";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function GroupInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const inviteCode = params?.code as string;
  const [preview, setPreview] = useState<GroupInvitePreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode) return;
    setIsLoading(true);
    getGroupByInviteCode(inviteCode)
      .then((data) => {
        setPreview(data);
        if (!data) {
          setErrorMessage("This group invite link is invalid or has expired.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch invite preview:", err);
        setErrorMessage("Failed to load group invite.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!profile) {
      router.push(`/auth?redirect=/invite/${inviteCode}`);
      return;
    }

    try {
      setIsJoining(true);
      setErrorMessage(null);
      const groupId = await joinGroupByInviteCode(inviteCode, profile);
      router.push("/chat");
    } catch (err: any) {
      console.error("Failed to join group:", err);
      setErrorMessage(err.message || "Failed to join group.");
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-50 via-white to-blue-50/30 dark:from-[#090E17] dark:via-[#0F172A] dark:to-[#0B1528]">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl text-center animate-in fade-in zoom-in-95">
        {/* Veyra Brand Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 p-1 flex items-center justify-center">
            <Image
              src="/assets/main_logo.png"
              alt="Veyra"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 space-y-4">
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse mx-auto" />
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mx-auto" />
            <div className="h-4 w-60 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse mx-auto" />
          </div>
        ) : preview ? (
          <div className="space-y-5">
            {/* Group Avatar */}
            <div className="flex justify-center">
              <Avatar
                name={preview.name}
                src={preview.avatar}
                size="xl"
                className="ring-4 ring-[#2563EB]/20 shadow-md"
              />
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Group Invitation
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {preview.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {preview.memberCount} member{preview.memberCount === 1 ? "" : "s"}
              </p>
            </div>

            {preview.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 leading-relaxed text-left">
                {preview.description}
              </p>
            )}

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
                {errorMessage}
              </div>
            )}

            <div className="pt-2 space-y-2">
              <Button
                size="lg"
                variant="primary"
                className="w-full font-semibold shadow-md shadow-blue-500/20"
                isLoading={isJoining}
                onClick={handleJoin}
                leftIcon={<Icon name="group_add" size="sm" />}
              >
                Join Group
              </Button>
              <Button
                size="md"
                variant="ghost"
                className="w-full text-xs text-slate-400"
                onClick={() => router.push("/chat")}
              >
                Go to Chats
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center mx-auto">
              <Icon name="link_off" size="md" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Invalid Invite Link
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              This group invite link is invalid, has expired, or has been revoked by a group admin.
            </p>
            <Button
              size="md"
              variant="outline"
              onClick={() => router.push("/chat")}
              className="mt-4"
            >
              Back to Home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
