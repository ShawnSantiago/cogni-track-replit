export type UsageMode = 'standard' | 'admin';

export type ProviderKeySummary = {
  id: number;
  provider: string;
  createdAt: string;
  usageMode: UsageMode;
  hasOrgConfig: boolean;
  maskedKey?: string;
};

export type ProviderKeyListResponse = {
  keys: ProviderKeySummary[];
};

export type ProviderKeyMutationResponse = {
  key: ProviderKeySummary;
  message: string;
};

export type ProviderKeyGetResponse = {
  key: ProviderKeySummary;
};
