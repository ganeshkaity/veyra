import React from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "chat_bubble_outline",
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto my-auto ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#14B8A6] flex items-center justify-center mb-4 shadow-sm ring-1 ring-blue-500/10">
        <Icon name={icon} size="lg" />
      </div>
      <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
        {title}
      </h4>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} leftIcon={<Icon name="add" size="sm" />}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
