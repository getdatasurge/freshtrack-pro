import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  CreditCard, 
  Loader2, 
  ExternalLink, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { PlanCard } from "./PlanCard";
import { InvoiceHistory } from "./InvoiceHistory";
import { STRIPE_PLANS, PlanKey } from "@/lib/stripe";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
type SubscriptionPlan = Database["public"]["Enums"]["subscription_plan"];

interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  sensor_limit: number;
  current_sensor_count: number;
  current_period_end: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface BillingTabProps {
  organizationId: string;
  canManageBilling: boolean;
}

const statusConfig: Record<SubscriptionStatus, { label: string; color: string; icon: React.ElementType }> = {
  trial: { label: "Trial", color: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  active: { label: "Active", color: "bg-safe/15 text-safe border-safe/30", icon: CheckCircle },
  past_due: { label: "Past Due", color: "bg-danger/15 text-danger border-danger/30", icon: AlertTriangle },
  canceled: { label: "Canceled", color: "bg-muted text-muted-foreground border-border", icon: AlertTriangle },
  paused: { label: "Paused", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

export const BillingTab = ({ organizationId, canManageBilling }: BillingTabProps) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, [organizationId]);

  const loadSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error("Error loading subscription:", error);
      toast.error("Failed to load subscription");
    }
    setIsLoading(false);
  };

  const handleUpgrade = async (planKey: PlanKey) => {
    const plan = STRIPE_PLANS[planKey];
    if (!plan.priceId) {
      toast.info("Contact sales for Enterprise pricing");
      return;
    }

    setIsCheckoutLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { priceId: plan.priceId, organizationId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start checkout");
    }
    setIsCheckoutLoading(null);
  };

  const handleManageBilling = async () => {
    setIsPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal", {
        body: { organizationId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Failed to open billing portal");
    }
    setIsPortalLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || "starter";
  const status = subscription?.status || "trial";
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;
  const sensorUsage = subscription 
    ? Math.round((subscription.current_sensor_count / subscription.sensor_limit) * 100)
    : 0;
  const isTrialEnding = status === "trial" && subscription?.trial_ends_at;
  const trialDaysLeft = isTrialEnding 
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Current Plan
              </CardTitle>
              <CardDescription>
                Manage your subscription and billing
              </CardDescription>
            </div>
            <Badge variant="outline" className={statusInfo.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold capitalize">{currentPlan} Plan</h3>
              <p className="text-muted-foreground">
                {STRIPE_PLANS[currentPlan as PlanKey]?.price 
                  ? `$${STRIPE_PLANS[currentPlan as PlanKey].price}/month`
                  : "Custom pricing"
                }
              </p>
            </div>
            {canManageBilling && subscription?.stripe_customer_id && (
              <Button 
                variant="outline" 
                onClick={handleManageBilling}
                disabled={isPortalLoading}
              >
                {isPortalLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Manage Billing
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            )}
          </div>

          {isTrialEnding && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-warning">Trial ends in {trialDaysLeft} days</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade now to continue using all features
                </p>
              </div>
            </div>
          )}

          {/* Sensor Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sensor Usage</span>
              <span className="font-medium">
                {subscription?.current_sensor_count || 0} / {subscription?.sensor_limit || 5}
              </span>
            </div>
            <Progress value={sensorUsage} className="h-2" />
            {sensorUsage >= 80 && (
              <p className="text-xs text-warning">
                You're approaching your sensor limit. Consider upgrading for more capacity.
              </p>
            )}
          </div>

          {subscription?.current_period_end && status === "active" && (
            <p className="text-sm text-muted-foreground">
              Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      {canManageBilling && (
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
            <CardDescription>
              Choose the plan that best fits your needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {(Object.entries(STRIPE_PLANS) as [PlanKey, typeof STRIPE_PLANS[PlanKey]][]).map(([key, plan]) => (
                <PlanCard
                  key={key}
                  planKey={key}
                  plan={plan}
                  isCurrentPlan={currentPlan === key}
                  onUpgrade={() => handleUpgrade(key)}
                  isLoading={isCheckoutLoading === key}
                  disabled={
                    currentPlan === key || 
                    (subscription?.stripe_subscription_id && !plan.priceId)
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice History */}
      {subscription && (
        <InvoiceHistory subscriptionId={subscription.id} />
      )}
    </div>
  );
};
