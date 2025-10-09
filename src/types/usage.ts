export interface UsageEventWithMetadata {
  id: number;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimate: string | null;
  timestamp: string;
  provider: string;
  windowStart: string | null;
  windowEnd: string | null;
  projectId: string | null;
  openaiApiKeyId: string | null;
  openaiUserId: string | null;
  serviceTier: string | null;
  batch: boolean | null;
  numModelRequests: number | null;
  inputCachedTokens: number | null;
  inputUncachedTokens: number | null;
  inputTextTokens: number | null;
  outputTextTokens: number | null;
  inputCachedTextTokens: number | null;
  inputAudioTokens: number | null;
  inputCachedAudioTokens: number | null;
  outputAudioTokens: number | null;
  inputImageTokens: number | null;
  inputCachedImageTokens: number | null;
  outputImageTokens: number | null;
}
