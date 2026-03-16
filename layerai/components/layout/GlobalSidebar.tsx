"use client";

import { useState } from "react";
import {
  Home,
  Folder,
  LayoutTemplate,
  Palette,
  Sparkles,
  Music4,
  HelpCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
}

const topNavItems: NavItem[] = [
  { id: "home", icon: Home, label: "Home" },
  { id: "projects", icon: Folder, label: "Projects" },
  { id: "templates", icon: LayoutTemplate, label: "Templates" },
  { id: "brand", icon: Palette, label: "Brand Kit" },
  { id: "assets", icon: Sparkles, label: "Assets" },
  { id: "audio", icon: Music4, label: "Audio" },
];

const bottomNavItems: NavItem[] = [
  { id: "help", icon: HelpCircle, label: "Help" },
  { id: "settings", icon: Settings, label: "Settings" },
];

interface GlobalSidebarProps {
  activeItem?: string;
  onItemClick?: (id: string) => void;
}

export function GlobalSidebar({ activeItem = "home", onItemClick }: GlobalSidebarProps) {
  const [active, setActive] = useState(activeItem);

  const handleClick = (id: string) => {
    setActive(id);
    onItemClick?.(id);
  };

  return (
    <nav className="w-[72px] h-full flex-none bg-[#0a0a0a] border-r border-neutral-800/50 flex flex-col items-center py-5 z-20 shrink-0">
      {/* Logo */}
      <div className="mb-8 w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black shrink-0">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>

      {/* Top Actions */}
      <div className="flex flex-col gap-4 w-full px-2">
        {topNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 group transition-colors",
                isActive ? "text-white" : "text-neutral-500 hover:text-white"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isActive ? "bg-neutral-800" : "hover:bg-neutral-800/50"
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <span className={cn(
                "text-[10px] tracking-tight",
                isActive ? "font-medium" : "font-normal"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col gap-4 w-full px-2">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 group transition-colors",
                isActive ? "text-white" : "text-neutral-500 hover:text-white"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isActive ? "bg-neutral-800" : "hover:bg-neutral-800/50"
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <span className={cn(
                "text-[10px] tracking-tight",
                isActive ? "font-medium" : "font-normal"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* User Avatar */}
        <button className="mt-2 w-9 h-9 rounded-full overflow-hidden mx-auto border border-neutral-700 ring-2 ring-transparent hover:ring-neutral-600 transition-all">
          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500" />
        </button>
      </div>
    </nav>
  );
}
