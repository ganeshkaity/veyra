"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  linkGoogleAccount,
  addPasswordToAccount,
  changeUserPassword,
} from "@/lib/auth/authService";

interface SecuritySectionProps {
  currentUser: UserProfile;
  onBack: () => void;
  onNavigateToTwoStep?: () => void;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  currentUser,
  onBack,
  onNavigateToTwoStep,
}) => {
  const { user, refreshProfile } = useAuth();

  // Google linking state
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const hasGoogle =
    currentUser.authProviders?.includes("google") ||
    user?.providerData.some((p) => p.providerId === "google.com");

  const hasPassword =
    currentUser.authProviders?.includes("password") ||
    user?.providerData.some((p) => p.providerId === "password");

  // Link Google
  const handleLinkGoogle = async () => {
    if (!user) return;
    try {
      setIsLinkingGoogle(true);
      await linkGoogleAccount(user);
      await refreshProfile();
      alert("Google account connected successfully to your Veyra profile!");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to link Google account.";
      alert(msg);
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  // Add or change password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (!user) return;

    try {
      setIsSavingPassword(true);
      setPasswordError(null);

      if (hasPassword) {
        await changeUserPassword(user, newPassword);
        setPasswordSuccess("Password updated successfully!");
      } else {
        await addPasswordToAccount(user, newPassword);
        await refreshProfile();
        setPasswordSuccess(
          "Password created! You can now sign in with your email & password."
        );
      }

      setTimeout(() => {
        setShowPasswordModal(false);
        setNewPassword("");
        setConfirmPassword("");
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save password.";
      setPasswordError(msg);
    } finally {
      setIsSavingPassword(false);
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
          Security
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-5">
        {/* Connected Authentication Providers Card */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Icon name="vpn_key" size="sm" className="text-[#2563EB] dark:text-[#14B8A6]" />
            <h4 className="text-sm font-bold">Sign-In Methods</h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You can access Veyra using Google authentication, your email and password, or both linked simultaneously.
          </p>

          <div className="space-y-2.5 pt-2">
            {/* Google Row */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Google Sign-In
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {hasGoogle ? "Account linked and verified" : "Link your Google account"}
                  </span>
                </div>
              </div>

              {hasGoogle ? (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-teal-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Icon name="check" size="xs" />
                  <span>Connected</span>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={isLinkingGoogle}
                  onClick={handleLinkGoogle}
                >
                  Connect
                </Button>
              )}
            </div>

            {/* Password Row */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md bg-slate-700 text-white flex items-center justify-center flex-shrink-0">
                  <Icon name="password" size="xs" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Password Authentication
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {hasPassword
                      ? "Password protection is active"
                      : "Add a password for standalone sign-in"}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant={hasPassword ? "outline" : "primary"}
                onClick={() => {
                  setPasswordError(null);
                  setPasswordSuccess(null);
                  setShowPasswordModal(true);
                }}
              >
                {hasPassword ? "Change" : "Add Password"}
              </Button>
            </div>
          </div>
        </div>

        {/* Two-Step Verification Section Link */}
        {onNavigateToTwoStep && (
          <button
            type="button"
            onClick={onNavigateToTwoStep}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Icon name="verified_user" size="sm" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Two-Step Verification
                </h4>
                <p className="text-xs text-slate-400">
                  Email OTP verification on new logins
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  currentUser.twoFactorEnabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {currentUser.twoFactorEnabled ? "Active" : "Disabled"}
              </span>
              <Icon name="chevron_right" size="sm" className="text-slate-400" />
            </div>
          </button>
        )}

        {/* Security Info Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-[#2563EB] dark:text-[#14B8A6]">
            <Icon name="security" size="sm" />
            <h5 className="text-xs font-bold uppercase tracking-wider">
              Account Protection
            </h5>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Your Veyra session is managed by secure Firebase Authentication tokens. When Two-Step Verification is enabled, sign-ins from unrecognized browsers require an instant 6-digit code delivered to your verified email.
          </p>
        </div>
      </div>

      {/* Add / Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordError(null);
          setPasswordSuccess(null);
        }}
        title={hasPassword ? "Change Password" : "Add Password to Account"}
        maxWidth="sm"
      >
        <form onSubmit={handleSavePassword} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hasPassword
              ? "Enter your new password below. It must be at least 6 characters long."
              : "Set a password so you can sign in with your email address even without Google."}
          </p>

          {passwordError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs">
              {passwordSuccess}
            </div>
          )}

          <Input
            label="New Password"
            type="password"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<Icon name="lock" size="xs" />}
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Icon name="lock" size="xs" />}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSavingPassword}
            >
              {hasPassword ? "Update Password" : "Set Password"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
