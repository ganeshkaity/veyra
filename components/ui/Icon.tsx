import React from "react";

interface IconProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  fill?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  xs: "!text-[16px] text-[16px]",
  sm: "!text-[20px] text-[20px]",
  md: "!text-[24px] text-[24px]",
  lg: "!text-[28px] text-[28px]",
  xl: "!text-[36px] text-[36px]",
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = "md",
  fill = false,
  className = "",
  onClick,
}) => {
  return (
    <span
      onClick={onClick}
      className={`material-symbols-outlined ${sizeMap[size]} ${
        fill ? "[font-variation-settings:'FILL'_1]" : ""
      } ${className}`}
    >
      {name}
    </span>
  );
};
