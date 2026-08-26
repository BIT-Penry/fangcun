import { ChevronDown, ChevronsUp, Equal } from "lucide-react";
import type { TodoPriority } from "./types";

const PRIORITY_META = {
  high: { code: "P1", label: "高优先级", icon: ChevronsUp },
  medium: { code: "P2", label: "中优先级", icon: Equal },
  low: { code: "P3", label: "低优先级", icon: ChevronDown },
} satisfies Record<TodoPriority, { code: string; label: string; icon: typeof ChevronsUp }>;

export function PriorityBadge({ priority }: { priority: TodoPriority }) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span className={`priority-badge priority-${priority}`} aria-label={`${meta.code}，${meta.label}`} title={meta.label}>
      <Icon aria-hidden="true" size={13} />
      <span>{meta.code}</span>
    </span>
  );
}
