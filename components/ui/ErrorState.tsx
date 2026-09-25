import React from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 max-w-sm mx-auto my-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-3">
        <Icon name="error_outline" size="md" />
      </div>
      <h4 className="text-sm font-bold text-red-900 dark:text-red-200 mb-1">{title}</h4>
      <p className="text-xs text-red-600 dark:text-red-300 mb-4">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          leftIcon={<Icon name="refresh" size="xs" />}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
