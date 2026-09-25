"use client";

import React from "react";

interface WhatsAppForwardIconProps {
  className?: string;
  size?: number;
}

/**
 * WhatsApp style double-arrow curved forward icon matching user reference design
 */
export const WhatsAppForwardIcon: React.FC<WhatsAppForwardIconProps> = ({
  className = "w-4 h-4",
  size,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    className={className}
    aria-hidden="true"
  >
    {/* Curved forward stem */}
    <path d="M4 17c0-4 3-7.5 7.5-7.5H15" />
    {/* First arrowhead chevron */}
    <path d="M11 5.5l4 4-4 4" />
    {/* Second arrowhead chevron */}
    <path d="M16 5.5l4 4-4 4" />
  </svg>
);
