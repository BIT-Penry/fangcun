import type { LucideIcon } from "lucide-react";
import { Bookmark, BookOpen, House, MessageSquareText, Settings } from "lucide-react";

export type AppRoute = "/" | "/bookmarks" | "/prompts" | "/journal" | "/settings";

export interface NavigationItem {
  label: string;
  path: AppRoute;
  icon: LucideIcon;
}

export const PRIMARY_NAV_ITEMS: readonly NavigationItem[] = [
  { label: "首页", path: "/", icon: House },
  { label: "书签", path: "/bookmarks", icon: Bookmark },
  { label: "提示词", path: "/prompts", icon: MessageSquareText },
  { label: "日记", path: "/journal", icon: BookOpen },
];

export const SETTINGS_NAV_ITEM: NavigationItem = {
  label: "设置",
  path: "/settings",
  icon: Settings,
};
