/**
 * Root package entry.
 *
 * Exposes the MacPaw AI Gateway surface while keeping upstream Vercel AI SDK
 * primitives on their original packages (`ai`, `@ai-sdk/openai`, etc.).
 */

export * from './provider';

export { GatewayApiCode } from './types';
