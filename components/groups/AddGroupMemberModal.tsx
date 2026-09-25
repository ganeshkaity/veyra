"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { searchUsersByUsername } from "@/lib/firestore/userService";
import { addMemberToGroup } from "@/lib/firestore/groupService";
import { GroupDetails, UserProfile } from "@/types";

interface AddGroupMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupDetails;
  currentUser: UserProfile;
}

export const AddGroupMemberModal: React.FC<AddGroupMemberModalProps> = ({
  isOpen,
  onClose,
  group,
  currentUser,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const existingMemberIds = group.members || group.memberIds || [];

  const handleSearch = async (val: string) => {
    setQuery(val);
    const cleaned = val.trim().replace(/^@+/, "");
    if (!cleaned) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const users = await searchUsersByUsername(cleaned);
      // Filter out users already in the group
      setResults(users.filter((u) => !existingMemberIds.includes(u.uid)));
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async (user: UserProfile) => {
    try {
      setAddingUid(user.uid);
      setErrorMsg(null);
      await addMemberToGroup(group.id, user, currentUser);
      onClose();
    } catch (err: any) {
      console.error("Failed to add member:", err);
      setErrorMsg(err.message || "Failed to add member.");
    } finally {
      setAddingUid(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Member to Group" maxWidth="md">
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        <Input
          placeholder="Search by @username..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          leftIcon={<Icon name="person_search" size="sm" />}
          autoFocus
        />

        <div className="min-h-[180px] max-h-[260px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {isSearching && (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
              <span className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              <span>Searching users...</span>
            </div>
          )}

          {!isSearching &&
            results.map((user) => (
              <div
                key={user.uid}
                className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {user.displayName}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-mono">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  isLoading={addingUid === user.uid}
                  onClick={() => handleAddMember(user)}
                  leftIcon={<Icon name="person_add" size="xs" />}
                >
                  Add
                </Button>
              </div>
            ))}

          {!isSearching && query && results.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              No matching users found (or user is already in this group).
            </div>
          )}

          {!isSearching && !query && (
            <div className="text-center py-8 text-xs text-slate-400">
              Type an @username to search for users to add.
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
