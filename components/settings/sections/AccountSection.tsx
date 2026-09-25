"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { updateUserProfile } from "@/lib/firestore/userService";
import { useAuth } from "@/components/providers/AuthProvider";

interface AccountSectionProps {
  currentUser: UserProfile;
  onBack: () => void;
  onNavigateToSection?: (section: string) => void;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  currentUser,
  onBack,
  onNavigateToSection,
}) => {
  const { refreshProfile, logout } = useAuth();
  const [showEditPhoneModal, setShowEditPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState(
    currentUser.mobileNumber || currentUser.phoneNumber || ""
  );
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Save phone number
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingPhone(true);
      setPhoneError(null);
      const res = await updateUserProfile(currentUser.uid, {
        mobileNumber: phoneInput.trim(),
        phoneNumber: phoneInput.trim(),
      });
      if (!res.success) {
        setPhoneError(res.error || "Failed to update phone number.");
        return;
      }
      await refreshProfile();
      setPhoneSuccess("Phone number updated successfully!");
      setTimeout(() => {
        setShowEditPhoneModal(false);
        setPhoneSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving phone number";
      setPhoneError(msg);
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Export account info
  const handleRequestAccountInfo = () => {
    const data = {
      product: "Veyra",
      exportedAt: new Date().toISOString(),
      account: {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        username: `@${currentUser.username}`,
        bio: currentUser.bio,
        mobileNumber: currentUser.mobileNumber || "Not provided",
        twoFactorEnabled: currentUser.twoFactorEnabled,
        authProviders: currentUser.authProviders,
        createdAt: new Date(currentUser.createdAt).toLocaleString(),
        updatedAt: new Date(currentUser.updatedAt).toLocaleString(),
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veyra_account_${currentUser.username}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          Account
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-5">
        {/* Section 1: Security Shortcuts (matches reference UI) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#0F172A] shadow-xs">
          {onNavigateToSection && (
            <>
              <button
                type="button"
                onClick={() => onNavigateToSection("privacy")}
                className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Privacy
                  </span>
                </div>
                <Icon name="chevron_right" size="sm" className="text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateToSection("security")}
                className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Security
                  </span>
                </div>
                <Icon name="chevron_right" size="sm" className="text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateToSection("twostep")}
                className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Two-Step Verification
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      currentUser.twoFactorEnabled
                        ? "text-emerald-500"
                        : "text-slate-400"
                    }`}
                  >
                    {currentUser.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </span>
                  <Icon name="chevron_right" size="sm" className="text-slate-400" />
                </div>
              </button>
            </>
          )}

          {/* Change Phone Number */}
          <button
            type="button"
            onClick={() => setShowEditPhoneModal(true)}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Change Number
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 truncate max-w-[140px]">
                {currentUser.mobileNumber || "Add number"}
              </span>
              <Icon name="chevron_right" size="sm" className="text-slate-400" />
            </div>
          </button>
        </div>

        {/* Section 2: Account Information & Export (matches reference UI) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#0F172A] shadow-xs">
          <button
            type="button"
            onClick={handleRequestAccountInfo}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">
                Request Account Info
              </span>
              <span className="text-[11px] text-slate-400">
                Download a JSON copy of your Veyra account profile
              </span>
            </div>
            <Icon name="download" size="sm" className="text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
          >
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Delete My Account
            </span>
            <Icon name="chevron_right" size="sm" className="text-red-400" />
          </button>
        </div>

        {/* Account Metadata Summary */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Account Identifiers
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500 dark:text-slate-400">Primary Email</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser.email}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500 dark:text-slate-400">Username</span>
            <span className="font-semibold text-[#2563EB] dark:text-[#14B8A6]">@{currentUser.username}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500 dark:text-slate-400">Firebase UID</span>
            <span className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">{currentUser.uid}</span>
          </div>
        </div>
      </div>

      {/* Edit Phone Number Modal */}
      <Modal
        isOpen={showEditPhoneModal}
        onClose={() => {
          setShowEditPhoneModal(false);
          setPhoneError(null);
          setPhoneSuccess(null);
        }}
        title="Change Phone Number"
        maxWidth="sm"
      >
        <form onSubmit={handleSavePhone} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add or update your optional phone number. This helps with account recovery and contacts.
          </p>

          {phoneError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
              {phoneError}
            </div>
          )}

          {phoneSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs">
              {phoneSuccess}
            </div>
          )}

          <Input
            label="Mobile Number"
            type="tel"
            placeholder="+91 98765 43210"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            leftIcon={<Icon name="call" size="xs" />}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowEditPhoneModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSavingPhone}
            >
              Save Number
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText("");
        }}
        title="Delete Veyra Account"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs space-y-1">
            <p className="font-bold">Warning: This action is permanent and cannot be undone.</p>
            <p>Your profile, message histories, media links, and username @{currentUser.username} will be released.</p>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            To proceed, type <span className="font-mono font-bold text-red-600">{currentUser.username}</span> below:
          </p>

          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={`Type ${currentUser.username} to confirm`}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={deleteConfirmText !== currentUser.username || isDeleting}
              isLoading={isDeleting}
              onClick={async () => {
                setIsDeleting(true);
                await logout();
              }}
            >
              Confirm Deletion
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
