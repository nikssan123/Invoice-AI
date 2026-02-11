export type PublicPlanKey = 'starter' | 'pro' | 'enterprise';

export const PUBLIC_PLANS: { key: PublicPlanKey; price: number | null; period: 'month' | null; highlighted?: boolean }[] = [
  { key: 'starter', price: 19, period: 'month', highlighted: false },
  { key: 'pro', price: 49, period: 'month', highlighted: true },
  { key: 'enterprise', price: null, period: null, highlighted: false },
];

export const getPlanFeatureKeys = (planKey: PublicPlanKey): string[] => {
  if (planKey === 'starter') {
    return [
      'usageBilling.planStarterFeature1',
      'usageBilling.planStarterFeature2',
      'usageBilling.planStarterChatFeature',
    ];
  }
  if (planKey === 'pro') {
    return [
      'usageBilling.planProFeature1',
      'usageBilling.planProFeature2',
      'usageBilling.planProChatFeature',
    ];
  }
  return [
    'usageBilling.planEnterpriseFeature1',
    'usageBilling.planEnterpriseFeature2',
    'usageBilling.planEnterpriseFeature3',
  ];
};

