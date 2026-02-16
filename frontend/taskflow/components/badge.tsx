import { Badge } from "@/components/ui/badge"

type Priority = 'low' | 'medium' | 'high';

interface PriorityBadgeProps {
  priority: Priority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const badgeStyles = {
    low: 'bg-green-500 text-white hover:bg-green-600',
    medium: 'bg-yellow-500 text-white hover:bg-yellow-600',
    high: 'bg-red-500 text-white hover:bg-red-600',
  };

  const labels = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };

  return (
    <Badge className={badgeStyles[priority]}>
      {labels[priority]}
    </Badge>
  );
}