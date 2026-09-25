"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAlert } from "@/components/providers/AlertModalProvider";
import { setTwoFactorStatus } from "@/lib/auth/authService";
import { requestOtp, verifyOtpCode } from "@/lib/auth/otpService";

interface TwoStepSectionProps {
  currentUser: UserProfile;
  onBack: () => void;
}

export const TwoStepSection: React.FC<TwoStepSectionProps> = ({
  currentUser,
  onBack,
}) => {
  const { refreshProfile } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [isTogglingOff, setIsTogglingOff] = useState(false);

  // Send real email OTP to start enablement
  const handleStartEnable = async () => {
    try {
      setIsSendingOtp(true);
      setOtpError(null);
      setOtpCode("");
      const res = await requestOtp(currentUser.email, "2fa");
      if (res.success) {
        setShowOtpModal(true);
      } else {
        await showAlert(res.error || "Failed to send 2FA verification email.", { type: "error" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error sending 2FA code";
      await showAlert(msg, { type: "error" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP and enable 2FA
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setOtpError("Please enter the 6-digit code sent to your email.");
      return;
    }

    try {
      setIsVerifyingOtp(true);
      setOtpError(null);
      const res = await verifyOtpCode(currentUser.email, otpCode.trim());
      if (!res.success) {
        setOtpError(res.error || "Invalid code. Please try again.");
        return;
      }

      await setTwoFactorStatus(currentUser.uid, true);
      await refreshProfile();
      setOtpSuccess("Two-Step Verification has been successfully enabled!");
      setTimeout(() => {
        setShowOtpModal(false);
        setOtpSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error verifying code";
      setOtpError(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Disable 2FA
  const handleDisable = async () => {
    const confirmed = await showConfirm(
      "Are you sure you want to disable Two-Step Verification? Your account will be protected by password/Google alone.",
      { title: "Disable Two-Step Verification", type: "warning", confirmText: "Disable" }
    );
    if (confirmed) {
      try {
        setIsTogglingOff(true);
        await setTwoFactorStatus(currentUser.uid, false);
        await refreshProfile();
        await showAlert("Two-Step Verification has been disabled.", { type: "info" });
      } catch (err) {
        console.error("Failed to disable 2FA:", err);
      } finally {
        setIsTogglingOff(false);
      }
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
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12 truncate">
          Two-Step Verification
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-6">
        {/* Hero Card */}
        <div className="flex flex-col items-center text-center p-6 rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform ${
              currentUser.twoFactorEnabled
                ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            }`}
          >
            <Icon
              name={currentUser.twoFactorEnabled ? "verified_user" : "security"}
              size="lg"
            />
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Two-Step Verification is
              </h3>
              <span
                className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${
                  currentUser.twoFactorEnabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {currentUser.twoFactorEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
              For added security, when signing in from an unrecognized device or browser, Veyra will email a 6-digit verification code to{" "}
              <strong className="text-slate-700 dark:text-slate-300">{currentUser.email}</strong>.
            </p>
          </div>

          <div className="pt-2 w-full max-w-xs">
            {currentUser.twoFactorEnabled ? (
              <Button
                variant="outline"
                size="md"
                className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
                isLoading={isTogglingOff}
                onClick={handleDisable}
              >
                Turn Off Two-Step Verification
              </Button>
            ) : (
              <Button
                size="md"
                className="w-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-white shadow-md shadow-blue-500/25"
                isLoading={isSendingOtp}
                onClick={handleStartEnable}
              >
                Turn On Two-Step Verification
              </Button>
            )}
          </div>
        </div>

        {/* Informational Rows */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 shadow-xs text-xs">
          <div className="p-3.5 px-4 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Delivery Method</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Email OTP</span>
          </div>

          <div className="p-3.5 px-4 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Registered Email</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
              {currentUser.email}
            </span>
          </div>
        </div>
      </div>

      {/* Real OTP Confirmation Modal */}
      <Modal
        isOpen={showOtpModal}
        onClose={() => {
          setShowOtpModal(false);
          setOtpError(null);
          setOtpSuccess(null);
        }}
        title="Verify 2FA Activation"
        maxWidth="sm"
      >
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#2563EB]/10 dark:bg-[#14B8A6]/20 text-[#2563EB] dark:text-[#14B8A6] flex items-center justify-center">
              <Icon name="mark_email_read" size="md" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              We've dispatched a 6-digit confirmation code to{" "}
              <strong className="text-slate-900 dark:text-slate-100">{currentUser.email}</strong>.
            </p>
          </div>

          {otpError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
              {otpError}
            </div>
          )}

          {otpSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs">
              {otpSuccess}
            </div>
          )}

          <div>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-xl tracking-[0.4em] font-mono font-bold"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowOtpModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isVerifyingOtp}
              disabled={otpCode.length !== 6}
            >
              Confirm & Enable
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
