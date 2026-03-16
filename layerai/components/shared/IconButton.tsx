"use client";

import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface IconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  tooltip?: string;
  disabled?: boolean;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "default";
  className?: string;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, onClick, tooltip, disabled, active, size = "md", variant = "ghost", className }, ref) => {
    const sizeClasses = {
      sm: "w-7 h-7",
      md: "w-8 h-8",
      lg: "w-10 h-10",
    };

    const iconSizes = {
      sm: "w-3.5 h-3.5",
      md: "w-4 h-4",
      lg: "w-5 h-5",
    };

    const button = (
      <Button
        ref={ref}
        variant={variant}
        size="icon"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          sizeClasses[size],
          "hover:bg-neutral-800/50 transition-colors",
          active && "bg-white text-black hover:bg-white",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <Icon className={iconSizes[size]} strokeWidth={1.5} />
      </Button>
    );

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  }
);

IconButton.displayName = "IconButton";

export { IconButton };
