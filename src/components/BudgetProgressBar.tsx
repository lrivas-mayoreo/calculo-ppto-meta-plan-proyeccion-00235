import { cn } from "@/lib/utils";

interface BudgetProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

export const BudgetProgressBar = ({ current, total, className }: BudgetProgressBarProps) => {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  const getColorClass = () => {
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-primary";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-300", getColorClass())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="min-w-[3rem] text-right text-xs font-medium text-muted-foreground">
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
};
