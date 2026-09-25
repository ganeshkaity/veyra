"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarPicker } from "@/components/ui/AvatarPicker";
import { UsernameInput } from "@/components/ui/UsernameInput";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateUserProfile, changeUsername } from "@/lib/firestore/userService";
import { formatJoinedDuration, UsernameStatus } from "@/lib/validation/username";
import { useAuth } from "@/components/providers/AuthProvider";

interface ProfileSectionProps {
  currentUser: UserProfile;
  onBack: () => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  currentUser,
  onBack,
}) => {
  const { refreshProfile } = useAuth();

  // Form states
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("available");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [bio, setBio] = useState(currentUser.bio || "");
  const [mobileNumber, setMobileNumber] = useState(
    currentUser.mobileNumber || currentUser.phoneNumber || ""
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setSaveError("Display name cannot be empty.");
      return;
    }

    if (username !== currentUser.username && usernameStatus !== "available") {
      setSaveError(usernameError || "Please provide a valid, available username.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      // Change username if changed
      if (username !== currentUser.username) {
        const usernameRes = await changeUsername(
          currentUser.uid,
          currentUser.username,
          username
        );
        if (!usernameRes.success) {
          setSaveError(usernameRes.error || "Failed to update username.");
          setIsSaving(false);
          return;
        }
      }

      // Update general fields
      const profileRes = await updateUserProfile(currentUser.uid, {
        displayName: displayName.trim(),
        avatarUrl,
        bio: bio.trim(),
        mobileNumber: mobileNumber.trim(),
        phoneNumber: mobileNumber.trim(),
      });

      if (!profileRes.success) {
        setSaveError(profileRes.error || "Failed to update profile.");
        setIsSaving(false);
        return;
      }

      await refreshProfile();
      setSaveSuccess("Profile updated successfully!");
      setTimeout(() => setSaveSuccess(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving profile.";
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          onClick={onBack}
          className="p-1 rounded-xl text-[#2563EB] dark:text-[#14B8A6] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <Icon name="arrow_back_ios" size="xs" />
          <span>Settings</span>
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12">
          Profile
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-6">
        <form onSubmit={handleSaveProfile} className="space-y-5">
          {saveError && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2">
              <Icon name="error" size="xs" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center gap-2">
              <Icon name="check_circle" size="xs" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            
            <AvatarPicker
              currentAvatarUrl={avatarUrl}
              displayName={displayName || currentUser.displayName}
              onAvatarChange={setAvatarUrl}
            />
          </div>

          {/* Main Info Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs space-y-4">
            {/* Display Name */}
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              leftIcon={<Icon name="badge" size="xs" />}
            />

            {/* Username Input with live uniqueness check */}
            <div>
              <UsernameInput
                value={username}
                onChange={(val, status, err) => {
                  setUsername(val);
                  setUsernameStatus(status);
                  setUsernameError(err || null);
                }}
                currentUsername={currentUser.username}
                label="Username"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                5–20 chars, lowercase letters, numbers, and underscore.
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Bio / About
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                maxLength={140}
                placeholder="Write something about yourself..."
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#14B8A6] transition-colors resize-none"
              />
              <div className="text-right text-[10px] text-slate-400 mt-0.5">
                {bio.length} / 140
              </div>
            </div>

            {/* Mobile Number */}
            <Input
              label="Mobile Number (Optional)"
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+91 98765 43210"
              leftIcon={<Icon name="call" size="xs" />}
            />
          </div>

          {/* Read-Only Account Metadata */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {/* Email */}
            <div className="flex items-center justify-between p-3.5 px-4">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="mail" size="xs" />
                <span>Email</span>
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <span>{currentUser.email}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Verified" />
              </div>
            </div>

            {/* Relative Joined Duration */}
            <div className="flex items-center justify-between p-3.5 px-4">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="history" size="xs" />
                <span>Joined</span>
              </span>
              <span className="font-semibold text-[#2563EB] dark:text-[#14B8A6]">
                {formatJoinedDuration(currentUser.createdAt)}
              </span>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              type="submit"
              size="md"
              className="w-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-white shadow-md shadow-blue-500/25"
              isLoading={isSaving}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
