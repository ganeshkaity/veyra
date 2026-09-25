import React from "react";

interface BadgeProps {
  count?: number;
  label?: string;
  variant?: "brand" | "neutral" | "success" | "danger";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  count,
  label,
  variant = "brand",
  className = "",
}) => {
  const variantStyles = {
    brand: "bg-[#2563EB] text-white",
    neutral: "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200",
    success: "bg-emerald-500 text-white",
    danger: "bg-red-500 text-white",
  };

  const displayText = count !== undefined ? (count > 99 ? "99+" : count.toString()) : label;

  if (!displayText) return null;

  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 min-w-[20px] h-5 text-[11px] font-bold rounded-full shadow-sm ${variantStyles[variant]} ${className}`}
    >
      {displayText}
    </span>
  );
};
