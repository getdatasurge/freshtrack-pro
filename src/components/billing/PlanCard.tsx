import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, ArrowUpRight } from "lucide-react";
import { PlanKey, STRIPE_PLANS } from "@/lib/stripe";

interface PlanCardProps {
  planKey: PlanKey;
  plan: typeof STRIPE_PLANS[PlanKey];
  isCurrentPlan: boolean;
  onUpgrade: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const PlanCard = ({ 
  planKey, 
  plan, 
  isCurrentPlan, 
  onUpgrade, 
  isLoading,
  disabled 
}: PlanCardProps) => {
  const isPro = planKey === "pro";
  
  return (
    <div 
      className={`relative rounded-lg border p-4 flex flex-col ${
        isCurrentPlan 
          ? "border-accent bg-accent/5 ring-2 ring-accent/20" 
          : isPro 
            ? "border-primary/50 bg-primary/5" 
            : "border-border"
      }`}
    >
      {isCurrentPlan && (
        <Badge className="absolute -top-2.5 left-4 bg-accent text-accent-foreground">
          Current Plan
        </Badge>
      )}
      {isPro && !isCurrentPlan && (
        <Badge className="absolute -top-2.5 left-4 bg-primary text-primary-foreground">
          Most Popular
        </Badge>
      )}

      <div className="mb-4 pt-2">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <div className="mt-1">
          {plan.price ? (
            <span className="text-2xl font-bold">${plan.price}</span>
          ) : (
            <span className="text-lg font-medium">Custom</span>
          )}
          {plan.price && <span className="text-muted-foreground">/month</span>}
        </div>
      </div>

      <ul className="space-y-2 flex-1 mb-4">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-safe shrink-0 mt-0.5" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={isCurrentPlan ? "outline" : isPro ? "default" : "secondary"}
        className="w-full"
        onClick={onUpgrade}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isCurrentPlan ? (
          "Current Plan"
        ) : plan.priceId ? (
          <>
            Upgrade
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </>
        ) : (
          "Contact Sales"
        )}
      </Button>
    </div>
  );
};
