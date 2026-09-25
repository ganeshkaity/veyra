"use client";

import React from "react";

interface MessageStatusTickProps {
  status?: "sent" | "delivered" | "read" | string;
  className?: string;
  size?: number | string;
  color?: string;
}

/**
 * Message status tick icon displaying single tick for sent,
 * grey double tick for delivered, and brand blue/cyan double tick for read.
 * Uses exact SVG path provided by user with optimized bounding box for clear visibility.
 */
export const MessageStatusTick: React.FC<MessageStatusTickProps> = ({
  status = "read",
  className = "",
  size = 18,
  color,
}) => {
  const isRead = status === "read";
  const isSent = status === "sent";

  const colorClass = color
    ? ""
    : isRead
    ? "text-[var(--bubble-tick)] text-[#2563EB] dark:text-[#14B8A6]"
    : "text-slate-400 dark:text-slate-400/80";

  const titleText = isRead ? "Read" : status === "delivered" ? "Delivered" : "Sent";

  const numWidth = typeof size === "number" ? size : parseInt(size as string, 10) || 18;
  const numHeight = Math.round(numWidth * 0.6);

  if (isSent) {
    // Single tick
    return (
      <span
        title={titleText}
        aria-label={titleText}
        className={`inline-flex items-center justify-center flex-shrink-0 align-middle ${colorClass} ${className}`}
        style={color ? { color } : undefined}
      >
        <svg
          width={Math.round(numWidth * 0.78)}
          height={numHeight}
          viewBox="3 6.5 15 11"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="inline-block"
        >
          <path
            d="M5.03033 11.4697C4.73744 11.1768 4.26256 11.1768 3.96967 11.4697C3.67678 11.7626 3.67678 12.2374 3.96967 12.5303L5.03033 11.4697ZM8.5 16L7.96967 16.5303C8.26256 16.8232 8.73744 16.8232 9.03033 16.5303L8.5 16ZM17.0303 8.53033C17.3232 8.23744 17.3232 7.76256 17.0303 7.46967C16.7374 7.17678 16.2626 7.17678 15.9697 7.46967L17.0303 8.53033ZM3.96967 12.5303L7.96967 16.5303L9.03033 15.4697L5.03033 11.4697L3.96967 12.5303ZM9.03033 16.5303L17.0303 8.53033L15.9697 7.46967L7.96967 15.4697L9.03033 16.5303Z"
            fill="currentColor"
          />
        </svg>
      </span>
    );
  }

  // Double tick for read or delivered (exact SVG path requested)
  return (
    <span
      title={titleText}
      aria-label={titleText}
      className={`inline-flex items-center justify-center flex-shrink-0 align-middle ${colorClass} ${className}`}
      style={color ? { color } : undefined}
    >
      <svg
        width={numWidth}
        height={numHeight}
        viewBox="3 6.5 19 11"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="inline-block"
      >
        <path
          d="M5.03033 11.4697C4.73744 11.1768 4.26256 11.1768 3.96967 11.4697C3.67678 11.7626 3.67678 12.2374 3.96967 12.5303L5.03033 11.4697ZM8.5 16L7.96967 16.5303C8.26256 16.8232 8.73744 16.8232 9.03033 16.5303L8.5 16ZM17.0303 8.53033C17.3232 8.23744 17.3232 7.76256 17.0303 7.46967C16.7374 7.17678 16.2626 7.17678 15.9697 7.46967L17.0303 8.53033ZM9.03033 11.4697C8.73744 11.1768 8.26256 11.1768 7.96967 11.4697C7.67678 11.7626 7.67678 12.2374 7.96967 12.5303L9.03033 11.4697ZM12.5 16L11.9697 16.5303C12.2626 16.8232 12.7374 16.8232 13.0303 16.5303L12.5 16ZM21.0303 8.53033C21.3232 8.23744 21.3232 7.76256 21.0303 7.46967C20.7374 7.17678 20.2626 7.17678 19.9697 7.46967L21.0303 8.53033ZM3.96967 12.5303L7.96967 16.5303L9.03033 15.4697L5.03033 11.4697L3.96967 12.5303ZM9.03033 16.5303L17.0303 8.53033L15.9697 7.46967L7.96967 15.4697L9.03033 16.5303ZM7.96967 12.5303L11.9697 16.5303L13.0303 15.4697L9.03033 11.4697L7.96967 12.5303ZM13.0303 16.5303L21.0303 8.53033L19.9697 7.46967L11.9697 15.4697L13.0303 16.5303Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
};
