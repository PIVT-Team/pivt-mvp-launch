import { Badge } from "@/components/ui/badge";
import { formatAiConfidenceLabel } from "@/lib/fieldCorrections";

interface AiConfidenceBadgeProps {
  aiConfidence?: number | null;
  className?: string;
}

export function AiConfidenceBadge({ aiConfidence, className }: AiConfidenceBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={[
        "border-accent/30 bg-accent/10 text-accent text-[10px] font-medium uppercase tracking-wide",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {formatAiConfidenceLabel(aiConfidence)}
    </Badge>
  );
}