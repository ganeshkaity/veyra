import React, { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = "", ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full rounded-xl border transition-all duration-200 text-sm px-3.5 py-2.5 outline-none 
              ${leftIcon ? "pl-10" : ""} 
              ${rightIcon ? "pr-10" : ""}
              ${
                error
                  ? "border-red-400 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
              }
              ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
        {helperText && !error && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
