import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-md ${className}`}
    />
  );
};

export const ChatListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-3.5 p-3.5 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const MessageListSkeleton: React.FC = () => {
  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      {/* Received skeleton */}
      <div className="flex items-end gap-2 max-w-[70%]">
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 animate-pulse" />
        <div className="space-y-1.5 p-3 rounded-2xl rounded-bl-sm bg-slate-200 dark:bg-slate-800/80 animate-pulse w-48">
          <div className="h-3.5 w-36 bg-slate-300 dark:bg-slate-700 rounded" />
          <div className="h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded self-end ml-auto" />
        </div>
      </div>

      {/* Sent skeleton */}
      <div className="flex items-end justify-end gap-2">
        <div className="space-y-1.5 p-3 rounded-2xl rounded-br-sm bg-blue-100 dark:bg-teal-950/40 animate-pulse w-56">
          <div className="h-3.5 w-48 bg-blue-200 dark:bg-teal-800/60 rounded" />
          <div className="h-3.5 w-32 bg-blue-200 dark:bg-teal-800/60 rounded" />
          <div className="h-3 w-14 bg-blue-200 dark:bg-teal-800/60 rounded ml-auto" />
        </div>
      </div>

      {/* Received skeleton */}
      <div className="flex items-end gap-2 max-w-[70%]">
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 animate-pulse" />
        <div className="space-y-1.5 p-3 rounded-2xl rounded-bl-sm bg-slate-200 dark:bg-slate-800/80 animate-pulse w-64">
          <div className="h-3.5 w-52 bg-slate-300 dark:bg-slate-700 rounded" />
          <div className="h-3.5 w-40 bg-slate-300 dark:bg-slate-700 rounded" />
          <div className="h-3 w-16 bg-slate-300 dark:bg-slate-700 rounded ml-auto" />
        </div>
      </div>
    </div>
  );
};
