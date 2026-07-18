import React from "react";
import { cn } from "./cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-400/30 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

  const variantStyles = {
    primary:
      "bg-white text-zinc-950 hover:bg-zinc-200 shadow-lg shadow-white/5 border border-white/20",
    secondary:
      "bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700/80 border border-zinc-700/80 backdrop-blur-md",
    ghost: "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40",
    danger: "bg-rose-600/90 text-white hover:bg-rose-500 border border-rose-500/30 shadow-lg shadow-rose-900/20",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          Processing...
        </>
      ) : (
        children
      )}
    </button>
  );
};
