import { describe, it, expect } from 'vitest';
import * as macpawXai from '@macpaw/ai-sdk/xai';
import * as vercelXai from '@ai-sdk/xai';
import * as macpawGroq from '@macpaw/ai-sdk/groq';
import * as vercelGroq from '@ai-sdk/groq';
import * as macpawMistral from '@macpaw/ai-sdk/mistral';
import * as vercelMistral from '@ai-sdk/mistral';
import * as macpawAmazonBedrock from '@macpaw/ai-sdk/amazon-bedrock';
import * as vercelAmazonBedrock from '@ai-sdk/amazon-bedrock';
import * as macpawAzure from '@macpaw/ai-sdk/azure';
import * as vercelAzure from '@ai-sdk/azure';
import * as macpawCohere from '@macpaw/ai-sdk/cohere';
import * as vercelCohere from '@ai-sdk/cohere';
import * as macpawPerplexity from '@macpaw/ai-sdk/perplexity';
import * as vercelPerplexity from '@ai-sdk/perplexity';
import * as macpawDeepseek from '@macpaw/ai-sdk/deepseek';
import * as vercelDeepseek from '@ai-sdk/deepseek';
import * as macpawTogetherai from '@macpaw/ai-sdk/togetherai';
import * as vercelTogetherai from '@ai-sdk/togetherai';
import * as macpawOpenaiCompatible from '@macpaw/ai-sdk/openai-compatible';
import * as vercelOpenaiCompatible from '@ai-sdk/openai-compatible';

const cases = [
  {
    label: '@macpaw/ai-sdk/xai',
    macpaw: macpawXai,
    vercel: vercelXai,
    factory: 'createXai' as const,
    gatewayFactory: 'createGatewayXai' as const,
  },
  {
    label: '@macpaw/ai-sdk/groq',
    macpaw: macpawGroq,
    vercel: vercelGroq,
    factory: 'createGroq' as const,
    gatewayFactory: 'createGatewayGroq' as const,
  },
  {
    label: '@macpaw/ai-sdk/mistral',
    macpaw: macpawMistral,
    vercel: vercelMistral,
    factory: 'createMistral' as const,
    gatewayFactory: 'createGatewayMistral' as const,
  },
  {
    label: '@macpaw/ai-sdk/amazon-bedrock',
    macpaw: macpawAmazonBedrock,
    vercel: vercelAmazonBedrock,
    factory: 'createAmazonBedrock' as const,
    gatewayFactory: 'createGatewayBedrock' as const,
  },
  {
    label: '@macpaw/ai-sdk/azure',
    macpaw: macpawAzure,
    vercel: vercelAzure,
    factory: 'createAzure' as const,
    gatewayFactory: 'createGatewayAzure' as const,
  },
  {
    label: '@macpaw/ai-sdk/cohere',
    macpaw: macpawCohere,
    vercel: vercelCohere,
    factory: 'createCohere' as const,
    gatewayFactory: 'createGatewayCohere' as const,
  },
  {
    label: '@macpaw/ai-sdk/perplexity',
    macpaw: macpawPerplexity,
    vercel: vercelPerplexity,
    factory: 'createPerplexity' as const,
    gatewayFactory: 'createGatewayPerplexity' as const,
  },
  {
    label: '@macpaw/ai-sdk/deepseek',
    macpaw: macpawDeepseek,
    vercel: vercelDeepseek,
    factory: 'createDeepSeek' as const,
    gatewayFactory: 'createGatewayDeepseek' as const,
  },
  {
    label: '@macpaw/ai-sdk/togetherai',
    macpaw: macpawTogetherai,
    vercel: vercelTogetherai,
    factory: 'createTogetherAI' as const,
    gatewayFactory: 'createGatewayTogetherAI' as const,
  },
  {
    label: '@macpaw/ai-sdk/openai-compatible',
    macpaw: macpawOpenaiCompatible,
    vercel: vercelOpenaiCompatible,
    factory: 'createOpenAICompatible' as const,
    gatewayFactory: 'createGatewayOpenAICompatible' as const,
  },
] as const;

describe('@macpaw/ai-sdk provider mirrors', () => {
  it.each(cases)('$label re-exports the upstream package surface', ({ macpaw, vercel, factory }) => {
    const vercelKeys = Object.keys(vercel).sort();
    const m = macpaw as Record<string, unknown>;
    const v = vercel as Record<string, unknown>;
    for (const key of vercelKeys) {
      expect(m).toHaveProperty(key);
      expect(m[key]).toBe(v[key]);
    }
    expect(m[factory]).toBe(v[factory]);
  });

  it.each(cases)('$label exports a gateway factory ($gatewayFactory)', ({ macpaw, gatewayFactory }) => {
    const m = macpaw as Record<string, unknown>;
    expect(m[gatewayFactory]).toBeDefined();
    expect(typeof m[gatewayFactory]).toBe('function');
  });
});
