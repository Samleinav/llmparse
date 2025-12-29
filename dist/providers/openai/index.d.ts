import { UnifiedLLMPayload, AnthropicResponse } from '../../types';
export declare function buildOpenAIPayload(body: any): UnifiedLLMPayload;
export declare function convertOpenAIResponse(response: unknown, modelUsed: string): AnthropicResponse;
