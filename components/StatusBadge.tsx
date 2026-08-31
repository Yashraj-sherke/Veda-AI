import { AlertTriangle, Check, CircleDashed, CircleDot } from "lucide-react";
import type { QuestionStatus } from "@/types/assessment";

const statusConfig = {
  answered: { label: "Answered", icon: Check },
  partially_answered: { label: "Partial", icon: CircleDot },
  unanswered: { label: "Unanswered", icon: CircleDashed },
  needs_review: { label: "Needs review", icon: AlertTriangle },
} satisfies Record<QuestionStatus, { label: string; icon: typeof Check }>;

export function StatusBadge({ status, compact = false }: { status: QuestionStatus; compact?: boolean }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span className={`status-badge status-badge--${status}`} title={config.label}>
      <Icon size={12} />
      {!compact && config.label}
    </span>
  );
}

export function confidenceLabel(confidence?: number) {
  if (confidence === undefined) return "No mapping";
  if (confidence >= 0.9) return "High confidence";
  if (confidence >= 0.7) return "Medium confidence";
  return "Needs review";
}
