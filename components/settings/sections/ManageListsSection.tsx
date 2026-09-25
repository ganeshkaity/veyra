"use client";

import React, { useState } from "react";
import { UserProfile, ChatListItemConfig } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getEffectiveChatLists,
  saveChatLists,
} from "@/lib/firestore/chatLockAndListService";

interface ManageListsSectionProps {
  currentUser: UserProfile;
  onBack: () => void;
}

export const ManageListsSection: React.FC<ManageListsSectionProps> = ({
  currentUser,
  onBack,
}) => {
  const { refreshProfile } = useAuth();
  const [lists, setLists] = useState<ChatListItemConfig[]>(() =>
    getEffectiveChatLists(currentUser)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New list creation state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Edit list state
  const [editingList, setEditingList] = useState<ChatListItemConfig | null>(null);
  const [editName, setEditName] = useState("");

  // Delete confirm state
  const [deletingList, setDeletingList] = useState<ChatListItemConfig | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveLists = async (newLists: ChatListItemConfig[], successMsg: string) => {
    try {
      setIsSaving(true);
      setLists(newLists);
      const res = await saveChatLists(currentUser.uid, newLists);
      if (res.success) {
        await refreshProfile();
        showToast(successMsg);
      } else {
        showToast(res.error || "Failed to save lists");
      }
    } catch (err: unknown) {
      console.error("Error saving lists:", err);
      showToast("Error updating lists.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reorder up
  const handleMoveUp = async (index: number) => {
    if (index <= 0 || isSaving) return;
    const updated = [...lists];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    await handleSaveLists(updated, "List reordered ⇅");
  };

  // Reorder down
  const handleMoveDown = async (index: number) => {
    if (index >= lists.length - 1 || isSaving) return;
    const updated = [...lists];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    await handleSaveLists(updated, "List reordered ⇅");
  };

  // Create new list
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;

    const newId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newItem: ChatListItemConfig = {
      id: newId,
      label: trimmed,
      isDefault: false,
    };

    const updated = [...lists, newItem];
    setShowAddModal(false);
    setNewListName("");
    await handleSaveLists(updated, `Created "${trimmed}" list ✨`);
  };

  // Rename list
  const handleRenameList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    const updated = lists.map((l) =>
      l.id === editingList.id ? { ...l, label: trimmed } : l
    );

    setEditingList(null);
    setEditName("");
    await handleSaveLists(updated, `Renamed list to "${trimmed}" ✏️`);
  };

  // Delete list
  const handleDeleteList = async () => {
    if (!deletingList) return;
    const updated = lists.filter((l) => l.id !== deletingList.id);
    const deletedName = deletingList.label;
    setDeletingList(null);
    await handleSaveLists(updated, `Deleted "${deletedName}" list 🗑️`);
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded-xl text-[#2563EB] dark:text-[#14B8A6] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-semibold transition-colors cursor-pointer"
        >
          <Icon name="arrow_back_ios" size="xs" />
          <span>Settings</span>
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12">
          Manage Chat Lists
        </h2>
      </div>

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs font-semibold backdrop-blur-md shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <Icon name="check_circle" size="xs" className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-5 pb-20">
        {/* Intro Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-1.5 shadow-xs">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Icon name="label" size="xs" className="text-[#2563EB]" />
            <span>Organize with Chat Lists</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Customize filter chips displayed at the top of your chats screen. Create custom lists, rename, and reorder them anytime.
          </p>
        </div>

        {/* Add New List Button */}
        <button
          type="button"
          onClick={() => {
            setNewListName("");
            setShowAddModal(true);
          }}
          className="w-full py-3 px-4 rounded-2xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white flex items-center justify-center gap-2 text-sm font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <Icon name="add" size="sm" />
          <span>Create New List</span>
        </button>

        {/* Chat Lists Group */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Your Lists ({lists.length})</span>
            <span>Order</span>
          </div>

          {lists.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === lists.length - 1;
            const isDefault = Boolean(item.isDefault);

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 px-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                    <Icon name="label" size="xs" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.label}
                      </span>
                      {isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          Default
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions: Reorder, Rename, Delete */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Move Up */}
                  <button
                    type="button"
                    disabled={isFirst || isSaving}
                    onClick={() => handleMoveUp(index)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 transition-colors cursor-pointer"
                    title="Move up"
                  >
                    <Icon name="arrow_upward" size="xs" />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    disabled={isLast || isSaving}
                    onClick={() => handleMoveDown(index)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 transition-colors cursor-pointer"
                    title="Move down"
                  >
                    <Icon name="arrow_downward" size="xs" />
                  </button>

                  {/* Rename (Available for custom lists) */}
                  {!isDefault && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setEditingList(item);
                        setEditName(item.label);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] dark:hover:text-[#14B8A6] transition-colors cursor-pointer ml-1"
                      title="Rename list"
                    >
                      <Icon name="edit" size="xs" />
                    </button>
                  )}

                  {/* Delete (Available for custom lists) */}
                  {!isDefault && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setDeletingList(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Delete list"
                    >
                      <Icon name="delete" size="xs" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE NEW LIST MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Icon name="playlist_add" size="xs" className="text-[#2563EB]" />
                <span>New Chat List</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            </div>

            <form onSubmit={handleCreateList} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  List Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Work, College, Projects"
                  required
                  maxLength={30}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim() || isSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-xl transition-all disabled:opacity-50"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME LIST MODAL */}
      {editingList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Icon name="edit" size="xs" className="text-[#2563EB]" />
                <span>Rename List</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingList(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            </div>

            <form onSubmit={handleRenameList} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  List Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter new list name"
                  required
                  maxLength={30}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingList(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim() || isSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-xl transition-all disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-center">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
              <Icon name="delete" size="sm" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Delete &quot;{deletingList.label}&quot;?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chats assigned to this list will not be deleted, but this filter chip will be removed from your chats list.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingList(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteList}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors"
              >
                Delete List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
