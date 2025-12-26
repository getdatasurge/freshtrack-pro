// Stripe plan configuration
export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    priceId: "price_1SiUf142uQRDu0jrOM50mqeK",
    productId: "prod_TfqLIQxzwzsG3K",
    price: 29,
    sensorLimit: 5,
    features: [
      "Up to 5 sensors",
      "Email alerts",
      "7-day data retention",
      "Basic dashboard",
    ],
  },
  pro: {
    name: "Pro",
    priceId: "price_1SiUfF42uQRDu0jrJ8kCIn9u",
    productId: "prod_TfqLvYhECPZrZ1",
    price: 79,
    sensorLimit: 25,
    features: [
      "Up to 25 sensors",
      "Email + SMS alerts",
      "30-day data retention",
      "Advanced analytics",
      "Multiple sites",
      "API access",
    ],
  },
  haccp: {
    name: "HACCP",
    priceId: "price_1SiUfP42uQRDu0jrAlHvwYID",
    productId: "prod_TfqMkPMNgTsesr",
    price: 199,
    sensorLimit: 100,
    features: [
      "Up to 100 sensors",
      "All Pro features",
      "HACCP compliance reports",
      "Audit trails",
      "Corrective action tracking",
      "Priority support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    priceId: null,
    productId: null,
    price: null,
    sensorLimit: null,
    features: [
      "Unlimited sensors",
      "All HACCP features",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantees",
      "On-premise options",
    ],
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

export const getPlanByPriceId = (priceId: string): PlanKey | null => {
  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.priceId === priceId) {
      return key as PlanKey;
    }
  }
  return null;
};

export const getPlanBySensorLimit = (limit: number): PlanKey => {
  if (limit <= 5) return "starter";
  if (limit <= 25) return "pro";
  if (limit <= 100) return "haccp";
  return "enterprise";
};
