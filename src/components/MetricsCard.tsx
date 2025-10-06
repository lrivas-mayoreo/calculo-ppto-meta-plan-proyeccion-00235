import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: "positive" | "negative" | "neutral";
  subtitle?: string;
}

export const MetricsCard = ({
  title,
  value,
  icon: Icon,
  trend = "neutral",
  subtitle,
}: MetricsCardProps) => {
  return (
    <Card className="p-5 shadow-md transition-all hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "mt-2 text-2xl font-bold",
              trend === "positive" && "text-accent",
              trend === "negative" && "text-destructive",
              trend === "neutral" && "text-foreground"
            )}
          >
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div
          className={cn(
            "rounded-lg p-2.5",
            trend === "positive" && "bg-accent/10",
            trend === "negative" && "bg-destructive/10",
            trend === "neutral" && "bg-primary/10"
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              trend === "positive" && "text-accent",
              trend === "negative" && "text-destructive",
              trend === "neutral" && "text-primary"
            )}
          />
        </div>
      </div>
    </Card>
  );
};
