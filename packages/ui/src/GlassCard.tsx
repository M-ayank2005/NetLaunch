import React from "react";
import { cn } from "./cn";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverEffect?: boolean;
  active?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  hoverEffect = false,
  active = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300",
        hoverEffect && "hover:border-zinc-700/80 hover:bg-zinc-900/60 hover:-translate-y-0.5",
        active && "border-zinc-600/90 bg-zinc-900/70 shadow-zinc-950/50",
        className
      )}
      {...props}
    >
      {/* Subtle inner top highlight line for crisp glass depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/[0.07] rounded-t-2xl" />
      {children}
    </div>
  );
};
