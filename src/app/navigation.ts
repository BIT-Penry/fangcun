import type { LucideIcon } from "lucide-react";
import { Bookmark, Boxes, House, MessageSquareText, NotebookPen, Settings } from "lucide-react";

export type AppRoute = "/" | "/bookmarks" | "/prompts" | "/skills" | "/journal" | "/settings";

export interface NavigationItem {
  label: string;
  path: AppRoute;
  icon: LucideIcon;
}

export const PRIMARY_NAV_ITEMS: readonly NavigationItem[] = [
  { label: "首页", path: "/", icon: House },
  { label: "书签", path: "/bookmarks", icon: Bookmark },
  { label: "提示词", path: "/prompts", icon: MessageSquareText },
  { label: "技能库", path: "/skills", icon: Boxes },
  { label: "日记", path: "/journal", icon: NotebookPen },
];

export const SETTINGS_NAV_ITEM: NavigationItem = {
  label: "设置",
  path: "/settings",
  icon: Settings,
};
