import React from "react";
import Image from "next/image";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isOnline?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-xl font-bold",
};

const badgeSizeClasses = {
  xs: "w-2 h-2 bottom-0 right-0 border",
  sm: "w-2.5 h-2.5 bottom-0 right-0 border-2",
  md: "w-3 h-3 bottom-0.5 right-0.5 border-2",
  lg: "w-3.5 h-3.5 bottom-0.5 right-0.5 border-2",
  xl: "w-4.5 h-4.5 bottom-1 right-1 border-2",
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = "md",
  isOnline,
  className = "",
}) => {
  const getInitials = (n: string) => {
    if (!n) return "?";
    const parts = n.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  // Deterministic color palette for avatar fallback
  const getGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      "from-blue-500 to-indigo-600",
      "from-teal-500 to-emerald-600",
      "from-indigo-500 to-purple-600",
      "from-rose-500 to-pink-600",
      "from-amber-500 to-orange-600",
      "from-cyan-500 to-blue-600",
    ];
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-semibold text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10`}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken image and fallback to initials
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center bg-gradient-to-tr ${getGradient(
              name
            )}`}
          >
            {getInitials(name)}
          </div>
        )}
      </div>

      {typeof isOnline === "boolean" && (
        <span
          className={`absolute rounded-full border-white dark:border-slate-900 ${
            badgeSizeClasses[size]
          } ${isOnline ? "bg-emerald-500" : "bg-slate-400"}`}
          title={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
};
