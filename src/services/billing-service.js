import { getTenantSubscription } from "./subscription-service.js";
import { getUsage } from "./usage-service.js";

export async function getBillingSummary(tenantId) {
  const subscription = await getTenantSubscription(tenantId);

  if (!subscription) {
    const error = new Error("No active subscription");
    error.code = "NO_ACTIVE_SUBSCRIPTION";
    throw error;
  }

  const apiUsage = await getUsage(tenantId, "api_call");
  const aiTokenUsage = await getUsage(tenantId, "ai_tokens");

  const apiQuota = Number(subscription.api_call_quota);
  const aiTokenQuota = Number(subscription.ai_token_quota);

  const monthlyPrice = Number(subscription.monthly_price);

  const apiOveragePrice =
    Number(subscription.api_call_overage_price);

  const aiTokenOveragePrice =
    Number(subscription.ai_token_overage_price);

  const apiRemaining = Math.max(
    apiQuota - apiUsage,
    0
  );

  const aiTokenRemaining = Math.max(
    aiTokenQuota - aiTokenUsage,
    0
  );

  const apiOverage = Math.max(
    apiUsage - apiQuota,
    0
  );

  const aiTokenOverage = Math.max(
    aiTokenUsage - aiTokenQuota,
    0
  );

  const apiOverageCost =
    apiOverage * apiOveragePrice;

  const aiTokenOverageCost =
    aiTokenOverage * aiTokenOveragePrice;

  const total = 
    monthlyPrice +
    apiOverageCost +
    aiTokenOverageCost;

  const apiUsagePercentage =
    apiQuota > 0
      ? (apiUsage / apiQuota) * 100
      : 0;

  const aiTokenUsagePercentage =
    aiTokenQuota > 0
      ? (aiTokenUsage / aiTokenQuota) * 100
      : 0;

  return {
    tenant_id: tenantId,

    subscription: {
      id: subscription.id,
      status: subscription.status,
    },

    plan: {
      id: subscription.plan_id,
      name: subscription.plan_name,
      monthly_price: monthlyPrice,
    },

    usage: {
      api_calls: {
        used: apiUsage,
        quota: apiQuota,
        remaining: apiRemaining,
        percentage: Number(
          apiUsagePercentage.toFixed(2)
        ),
      },

      ai_tokens: {
        used: aiTokenUsage,
        quota: aiTokenQuota,
        remaining: aiTokenRemaining,
        percentage: Number(
          aiTokenUsagePercentage.toFixed(2)
        ),
      },
    },

    overage: {
      api_calls: {
        quantity: apiOverage,
        unit_price: apiOveragePrice,
        cost: Number(
          apiOverageCost.toFixed(6)
        ),
      },

      ai_tokens: {
        quantity: aiTokenOverage,
        unit_price: aiTokenOveragePrice,
        cost: Number(
          aiTokenOverageCost.toFixed(9)
        ),
      },
    },

    billing: {
      monthly_price: monthlyPrice,
      overage_cost: Number(
        (apiOverageCost + aiTokenOverageCost).toFixed(6)
      ),
      total: Number(total.toFixed(6)),
    },
  };
}