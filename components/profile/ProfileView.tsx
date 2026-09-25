"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarPicker } from "@/components/ui/AvatarPicker";
import { UsernameInput } from "@/components/ui/UsernameInput";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import {
  updateUserProfile,
  changeUsername,
} from "@/lib/firestore/userService";
import { formatJoinedDuration, UsernameStatus } from "@/lib/validation/username";
import { useAuth } from "@/components/providers/AuthProvider";

interface ProfileViewProps {
  currentUser: UserProfile;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser }) => {
  const { refreshProfile, logout } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit form state
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

  const handleOpenEdit = () => {
    setDisplayName(currentUser.displayName);
    setUsername(currentUser.username);
    setUsernameStatus("available");
    setUsernameError(null);
    setAvatarUrl(currentUser.avatarUrl);
    setBio(currentUser.bio || "");
    setMobileNumber(currentUser.mobileNumber || currentUser.phoneNumber || "");
    setSaveError(null);
    setSaveSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setSaveError("Display name cannot be empty.");
      return;
    }

    if (usernameStatus !== "available") {
      setSaveError(usernameError || "Please provide a valid, available username.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      // 1. Handle username change if updated
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

      // 2. Handle general profile updates
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
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSaveSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving profile.";
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0F172A] overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Your Profile
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={handleOpenEdit}
          leftIcon={<Icon name="edit" size="xs" />}
        >
          Edit Profile
        </Button>
      </div>

      <div className="p-4 md:p-6 max-w-xl space-y-6 pb-24 md:pb-8">
        {/* Main Profile Header Card */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
          <Avatar
            name={currentUser.displayName}
            src={currentUser.avatarUrl}
            size="xl"
            isOnline={true}
          />

          <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {currentUser.displayName}
            </h3>
            <p className="text-sm font-mono font-bold text-[#2563EB] dark:text-[#14B8A6]">
              @{currentUser.username}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 pt-2 leading-relaxed whitespace-pre-wrap">
              {currentUser.bio || "Hey there! I am using Veyra."}
            </p>
          </div>
        </div>

        {/* Account Details Group */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Account Information
          </h4>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
            {/* Email */}
            <div className="flex items-center justify-between p-3.5 px-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="mail" size="xs" />
                <span>Email Address</span>
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                {currentUser.email}
              </span>
            </div>

            {/* Mobile Number */}
            <div className="flex items-center justify-between p-3.5 px-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="call" size="xs" />
                <span>Mobile Number</span>
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {currentUser.mobileNumber || currentUser.phoneNumber || (
                  <span className="text-slate-400 italic font-normal">Not provided</span>
                )}
              </span>
            </div>

            {/* Relative Join Duration (Prompt: Do not show an exact join date) */}
            <div className="flex items-center justify-between p-3.5 px-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="history" size="xs" />
                <span>Veyra Membership</span>
              </span>
              <span className="font-semibold text-[#2563EB] dark:text-[#14B8A6]">
                {formatJoinedDuration(currentUser.createdAt)}
              </span>
            </div>

            {/* Two-Factor Authentication */}
            <div className="flex items-center justify-between p-3.5 px-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icon name="security" size="xs" />
                <span>Two-Step Verification</span>
              </span>
              <span
                className={`font-semibold ${
                  currentUser.twoFactorEnabled ? "text-emerald-500" : "text-slate-400"
                }`}
              >
                {currentUser.twoFactorEnabled ? "Active (OTP Protected)" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Log out Action */}
        <div className="pt-2">
          <Button
            variant="danger"
            size="md"
            onClick={logout}
            className="w-full sm:w-auto"
            leftIcon={<Icon name="logout" size="sm" />}
          >
            Log Out of Veyra
          </Button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Your Profile"
        maxWidth="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
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

          {/* Avatar Picker with upload & presets */}
          <div className="py-2">
            <AvatarPicker
              currentAvatarUrl={avatarUrl}
              displayName={displayName}
              onAvatarChange={(url) => setAvatarUrl(url)}
              size="lg"
            />
          </div>

          {/* Display Name */}
          <Input
            label="Display Name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            leftIcon={<Icon name="badge" size="sm" />}
          />

          {/* Username Input with Live Validation */}
          <UsernameInput
            value={username}
            currentUsername={currentUser.username}
            onChange={(val, status, err) => {
              setUsername(val);
              setUsernameStatus(status);
              setUsernameError(err || null);
            }}
          />

          {/* Bio */}
          <Input
            label="Bio / About"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Hey there! I am using Veyra."
            leftIcon={<Icon name="notes" size="sm" />}
          />

          {/* Mobile Number */}
          <Input
            label="Mobile Number (Optional)"
            type="tel"
            placeholder="+91 9876543210"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            leftIcon={<Icon name="call" size="sm" />}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              leftIcon={<Icon name="check" size="xs" />}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
