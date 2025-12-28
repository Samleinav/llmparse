import { UnifiedLLMPayload, AnthropicResponse } from '../../types';

export function buildOpenAIPayload(body: any): UnifiedLLMPayload {
    // TODO: Implement OpenAI payload construction
    // This will be similar to OpenRouter but specific to OpenAI headers/structure if different
    throw new Error('Not implemented');
}

export function convertOpenAIResponse(
    response: unknown,
    modelUsed: string
): AnthropicResponse {
    // TODO: Implement OpenAI response conversion to Anthropic format
    throw new Error('Not implemented');
}
