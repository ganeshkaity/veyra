"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon";
import {
  sanitizeUsername,
  validateUsername,
  UsernameStatus,
} from "@/lib/validation/username";
import { isUsernameAvailable } from "@/lib/firestore/userService";

interface UsernameInputProps {
  value: string;
  onChange: (value: string, status: UsernameStatus, error?: string) => void;
  currentUsername?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export const UsernameInput: React.FC<UsernameInputProps> = ({
  value,
  onChange,
  currentUsername,
  label = "Choose Unique Username",
  required = true,
  className = "",
}) => {
  const [status, setStatus] = useState<UsernameStatus>("empty");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const clean = sanitizeUsername(value);

    if (!clean) {
      setStatus("empty");
      setErrorMessage(null);
      onChange("", "empty");
      return;
    }

    // Client format validation
    const valResult = validateUsername(clean);
    if (!valResult.isValid) {
      setStatus("invalid");
      setErrorMessage(valResult.error || "Invalid username");
      onChange(clean, "invalid", valResult.error);
      return;
    }

    // If it matches the user's current username when editing
    if (currentUsername && clean === sanitizeUsername(currentUsername)) {
      setStatus("available");
      setErrorMessage(null);
      onChange(clean, "available");
      return;
    }

    // Server-level uniqueness check with debounce
    setStatus("checking");
    setErrorMessage(null);
    onChange(clean, "checking");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(clean);
        if (available) {
          setStatus("available");
          setErrorMessage(null);
          onChange(clean, "available");
        } else {
          setStatus("unavailable");
          const msg = "This username is already taken. Please choose another.";
          setErrorMessage(msg);
          onChange(clean, "unavailable", msg);
        }
      } catch (err) {
        setStatus("invalid");
        setErrorMessage("Error checking username. Please try again.");
        onChange(clean, "invalid", "Error checking username");
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, currentUsername]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = sanitizeUsername(raw);
    onChange(clean, status, errorMessage || undefined);
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Leading @ Symbol */}
        <span className="absolute left-3.5 text-slate-400 font-bold text-sm select-none">
          @
        </span>

        {/* Input Field */}
        <input
          type="text"
          required={required}
          value={value}
          onChange={handleInputChange}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`w-full rounded-xl border text-sm pl-8 pr-10 py-2.5 outline-none font-mono transition-all duration-200 ${
            status === "invalid" || status === "unavailable"
              ? "border-red-400 bg-red-50/40 text-red-900 dark:text-red-200 focus:ring-2 focus:ring-red-200"
              : status === "available"
              ? "border-emerald-400 bg-emerald-50/30 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-200"
              : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
          }`}
        />

        {/* Trailing Status Indicator */}
        <div className="absolute right-3.5 flex items-center select-none pointer-events-none">
          {status === "checking" && (
            <div
              className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"
              title="Checking availability..."
            />
          )}
          {status === "available" && (
            <Icon
              name="check_circle"
              size="sm"
              className="text-emerald-500 animate-in zoom-in-75 duration-150"
            />
          )}
          {(status === "unavailable" || status === "invalid") && (
            <Icon
              name="cancel"
              size="sm"
              className="text-red-500 animate-in zoom-in-75 duration-150"
            />
          )}
        </div>
      </div>

      {/* Dynamic Feedback Helper */}
      <div className="min-h-[18px]">
        {status === "empty" && (
          <p className="text-[11px] text-slate-400">
            5–20 characters: lowercase letters, numbers, and underscore (_) only.
          </p>
        )}
        {status === "checking" && (
          <p className="text-[11px] text-blue-500 flex items-center gap-1 font-medium">
            <span>Checking username availability...</span>
          </p>
        )}
        {status === "available" && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
            <span>@{value} is available!</span>
          </p>
        )}
        {(status === "invalid" || status === "unavailable") && errorMessage && (
          <p className="text-[11px] text-red-500 font-medium">{errorMessage}</p>
        )}
      </div>
    </div>
  );
};
