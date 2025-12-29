import { AnthropicResponse, UnifiedLLMPayload, CanonicalRequest, CanonicalResponse } from '../../types';
import { BaseProvider } from '../../core';
export declare const OPENROUTER_DEFAULT_MODEL = "openai/gpt-3.5-turbo";
export declare class OpenRouterProvider extends BaseProvider {
    readonly name = "openrouter";
    /**
     * Parse Request (Not typically used unless treating OpenRouter as a Client Input)
     */
    parseRequest(body: any): CanonicalRequest;
    /**
     * Canonical Request -> Provider Payload
     */
    buildRequest(canonical: CanonicalRequest): UnifiedLLMPayload;
    /**
     * Provider API Response -> Canonical Response
     */
    parseResponse(body: any): CanonicalResponse;
    /**
     * Canonical Response -> Provider Client Response (Not typically used unless needed for mocking)
     */
    buildResponse(canonical: CanonicalResponse): any;
    request: {
        parse: (body: any) => CanonicalRequest;
        build: (canonical: CanonicalRequest) => UnifiedLLMPayload;
    };
    response: {
        parse: (body: any) => CanonicalResponse;
        build: (canonical: CanonicalResponse) => any;
    };
}
export declare const OpenRouter: OpenRouterProvider;
export declare const Request: {
    parse: (body: any) => CanonicalRequest;
    build: (canonical: CanonicalRequest) => UnifiedLLMPayload;
};
export declare const Response: {
    parse: (body: any) => CanonicalResponse;
    build: (canonical: CanonicalResponse) => any;
};
export declare function buildOpenRouterPayload(body: any, overrides?: {
    messages?: any[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    model?: string;
}): UnifiedLLMPayload;
export declare function convertToAnthropicResponse(response: unknown, modelUsed: string, options?: {
    forceToolUse?: boolean;
    tools?: Array<{
        name?: string;
    }>;
}): AnthropicResponse;
export declare function extractTextFromOpenRouter(response: any): string;
export declare function bodyTools(body: unknown): Array<{
    name?: string;
}> | undefined;
export declare const fromCanonical: (canonical: CanonicalRequest) => UnifiedLLMPayload;
export declare const toCanonical: (body: any) => CanonicalResponse;
