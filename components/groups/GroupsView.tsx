"use client";

import React, { useState, useEffect } from "react";
import { GroupDetails, UserProfile, Conversation } from "@/types";
import { subscribeToUserGroups } from "@/lib/firestore/groupService";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateGroupModal } from "./CreateGroupModal";

interface GroupsViewProps {
  currentUser: UserProfile;
  onSelectGroupConversation: (groupId: string) => void;
  conversations?: Conversation[];
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  currentUser,
  onSelectGroupConversation,
  conversations,
}) => {
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToUserGroups(currentUser.uid, (list) => {
      setGroups(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [currentUser.uid]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0F172A] overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Groups
        </h2>
        <Button
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          leftIcon={<Icon name="add" size="xs" />}
        >
          New Group
        </Button>
      </div>

      {/* Groups List */}
      <div className="p-4 flex-1 pb-24 md:pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : groups.length > 0 ? (
          <div className="space-y-2">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => onSelectGroupConversation(group.id)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={group.name} src={group.avatar || group.avatarUrl} size="md" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {group.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                      {group.description || `${(group.members || group.memberIds || []).length} members`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-xs">{(group.members || group.memberIds || []).length} members</span>
                  <Icon name="chevron_right" size="sm" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="groups"
            title="You haven't joined any groups yet."
            description="Create a group to coordinate with friends, family, or work teams."
            actionLabel="Create Group"
            onAction={() => setIsCreateModalOpen(true)}
            className="my-auto py-16"
          />
        )}
      </div>

      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        currentUser={currentUser}
        conversations={conversations}
        onGroupCreated={(groupId) => onSelectGroupConversation(groupId)}
      />
    </div>
  );
};
