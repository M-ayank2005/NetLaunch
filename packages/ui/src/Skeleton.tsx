import React from "react";
import { cn } from "./cn";

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-zinc-800/60", className)}
      {...props}
    />
  );
};
