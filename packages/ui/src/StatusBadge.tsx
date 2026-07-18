import React from "react";
import { cn } from "./cn";
import { CheckCircle2, Clock, Loader2, XCircle, AlertCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  showIcon = true,
}) => {
  const normalized = status.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case "READY":
        return {
          badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
          icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />,
          label: "Ready",
        };
      case "BUILDING":
        return {
          badge: "border-blue-500/30 bg-blue-500/10 text-blue-400",
          icon: <Loader2 className="w-3.5 h-3.5 mr-1.5 text-blue-400 animate-spin" />,
          label: "Building",
        };
      case "QUEUED":
        return {
          badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
          icon: <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-400" />,
          label: "Queued",
        };
      case "FAILED":
        return {
          badge: "border-rose-500/30 bg-rose-500/10 text-rose-400",
          icon: <XCircle className="w-3.5 h-3.5 mr-1.5 text-rose-400" />,
          label: "Failed",
        };
      case "CANCELED":
        return {
          badge: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
          icon: <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />,
          label: "Canceled",
        };
      default:
        return {
          badge: "border-zinc-700 bg-zinc-800 text-zinc-300",
          icon: null,
          label: status,
        };
    }
  };

  const { badge, icon, label } = getStyle();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-all",
        badge,
        className
      )}
    >
      {showIcon && icon}
      {label}
      {normalized === "BUILDING" && (
        <span className="relative flex h-2 w-2 ml-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
      )}
    </span>
  );
};
