
import {
    AnthropicResponse,
    UnifiedLLMPayload,
    CanonicalRequest,
    CanonicalResponse,
    CanonicalContentPart,
    CanonicalMessage,
    CanonicalToolDefinition
} from '../../types';
import * as AnthropicAdapter from '../anthropic';
import { BaseProvider } from '../../core';

export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-3.5-turbo';

export class OpenRouterProvider extends BaseProvider {
    readonly name = 'openrouter';

    // ----------------------------------------------------------------------
    // REQUEST HANDLING
    // ----------------------------------------------------------------------

    /**
     * Parse Request (Not typically used unless treating OpenRouter as a Client Input)
     */
    parseRequest(body: any): CanonicalRequest {
        throw new Error("OpenRouterProvider.parseRequest not implemented (Optional: for receiving OpenRouter payloads as input)");
    }

    /**
     * Canonical Request -> Provider Payload
     */
    buildRequest(canonical: CanonicalRequest): UnifiedLLMPayload {
        const messages = canonical.messages.flatMap((msg): any[] => {
            // OpenRouter/OpenAI uses 'tool' role for results usually, or 'function'.
            const role = msg.role === 'tool' ? 'tool' : msg.role;

            // If content is just string, return simple object
            if (typeof msg.content === 'string') {
                return [{ role, content: msg.content }];
            }

            // If content is array, we might need to separate tool_calls from text
            if (Array.isArray(msg.content)) {
                const toolUseParts = msg.content.filter(p => p.type === 'tool_use');
                const toolResultParts = msg.content.filter(p => p.type === 'tool_result');

                // Handle Tool Calls (Assistant requesting execution)
                if (toolUseParts.length > 0) {
                    const tool_calls = toolUseParts.map(p => ({
                        id: p.id,
                        type: 'function',
                        function: {
                            name: p.name,
                            arguments: JSON.stringify(p.input || {})
                        }
                    }));

                    // Text content can coexist with tool calls
                    const textParts = msg.content.filter(p => p.type === 'text');
                    const textContent = textParts.map(p => p.text).join('\n');

                    return [{
                        role,
                        content: textContent || null,
                        tool_calls
                    }];
                }

                // Handle Tool Results (User/Tool responding to execution)
                if (toolResultParts.length > 0) {
                    return toolResultParts.map(part => {
                        let contentStr = '';
                        if (typeof part.content === 'string') {
                            contentStr = part.content;
                        } else if (Array.isArray(part.content)) {
                            contentStr = part.content
                                .filter(p => p.type === 'text')
                                .map(p => p.text || '')
                                .join('\n');
                        }
                        return {
                            role: 'tool',
                            tool_call_id: part.tool_use_id,
                            content: contentStr
                        };
                    });
                }

                // Regular content (images/text)
                const standardContent = msg.content.map(p => {
                    if (p.type === 'image') {
                        if (p.source && p.source.type === 'base64') {
                            return {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${p.source.media_type};base64,${p.source.data}`
                                }
                            };
                        }
                        if (p.image_url) {
                            return {
                                type: 'image_url',
                                image_url: { ...p.image_url }
                            };
                        }
                        return null;
                    }
                    if (p.type === 'text') return { type: 'text', text: p.text };
                    return null;
                }).filter(Boolean);

                if (standardContent.length > 0) {
                    return [{ role, content: standardContent }];
                }
            }

            return [];
        });

        // Tools
        let tools: any[] | undefined;
        if (canonical.tools) {
            tools = canonical.tools.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters
                }
            }));
        }

        return {
            model: canonical.model ?? OPENROUTER_DEFAULT_MODEL,
            messages,
            temperature: canonical.temperature,
            max_tokens: canonical.max_tokens,
            stream: canonical.stream,
            tools,
            tool_choice: canonical.tool_choice
        };
    }

    // ----------------------------------------------------------------------
    // RESPONSE HANDLING
    // ----------------------------------------------------------------------

    /**
     * Provider API Response -> Canonical Response
     */
    parseResponse(body: any): CanonicalResponse {
        return {
            id: body.id,
            created: body.created,
            model: body.model,
            choices: (body.choices || []).map((c: any) => {
                const msg = c.message || {};
                let content: string | CanonicalContentPart[] = msg.content || '';

                // If tool calls exist, they become 'tool_use' parts in Canonical
                if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                    const currentParts: CanonicalContentPart[] = [];
                    if (content && typeof content === 'string' && content.trim().length > 0) {
                        currentParts.push({ type: 'text', text: content });
                    }

                    msg.tool_calls.forEach((tc: any) => {
                        currentParts.push({
                            type: 'tool_use',
                            id: tc.id,
                            name: tc.function?.name,
                            input: (() => {
                                if (typeof tc.function?.arguments === 'string') {
                                    try {
                                        return JSON.parse(tc.function.arguments);
                                    } catch {
                                        return {};
                                    }
                                }
                                return tc.function?.arguments ?? {};
                            })()
                        });
                    });
                    content = currentParts;
                }

                return {
                    index: c.index,
                    finish_reason: c.finish_reason,
                    message: {
                        role: msg.role,
                        content
                    }
                };
            }),
            usage: body.usage ? {
                input_tokens: body.usage.prompt_tokens,
                output_tokens: body.usage.completion_tokens,
                total_tokens: body.usage.total_tokens
            } : undefined
        };
    }

    /**
     * Canonical Response -> Provider Client Response (Not typically used unless needed for mocking)
     */
    buildResponse(canonical: CanonicalResponse): any {
        throw new Error("OpenRouterProvider.buildResponse not implemented (Optional).");
    }

    request = {
        parse: (body: any) => this.parseRequest(body),
        build: (canonical: CanonicalRequest) => this.buildRequest(canonical)
    };

    response = {
        parse: (body: any) => this.parseResponse(body),
        build: (canonical: CanonicalResponse) => this.buildResponse(canonical)
    };
}

// Singleton Instance
export const OpenRouter = new OpenRouterProvider();

// ----------------------------------------------------------------------
// EXPORT COMPATIBILITY OBJECTS
// ----------------------------------------------------------------------

export const Request = {
    parse: (body: any) => OpenRouter.parseRequest(body),
    build: (canonical: CanonicalRequest) => OpenRouter.buildRequest(canonical)
};

export const Response = {
    parse: (body: any) => OpenRouter.parseResponse(body),
    build: (canonical: CanonicalResponse) => OpenRouter.buildResponse(canonical)
};


// ----------------------------------------------------------------------
// LEGACY / ADAPTER FUNCTIONS
// ----------------------------------------------------------------------

export function buildOpenRouterPayload(
    body: any,
    overrides?: {
        messages?: any[];
        temperature?: number;
        maxTokens?: number;
        stream?: boolean;
        model?: string;
    }
): UnifiedLLMPayload {
    // 1. Convert Anthropic Body -> Canonical Request
    const canonicalReq = AnthropicAdapter.Request.parse(body);

    // 2. Apply Overrides (mutate canonical req)
    if (overrides?.model) canonicalReq.model = overrides.model;
    if (overrides?.temperature !== undefined) canonicalReq.temperature = overrides.temperature;
    if (overrides?.maxTokens !== undefined) canonicalReq.max_tokens = overrides.maxTokens;
    if (overrides?.stream !== undefined) canonicalReq.stream = overrides.stream;

    // Explicit override handling for pre-converted messages (Legacy)
    if (overrides?.messages) {
        const partialPayload = OpenRouter.buildRequest(canonicalReq);
        partialPayload.messages = overrides.messages;
        return partialPayload;
    }

    // 3. Convert Canonical Request -> OpenRouter Payload
    return OpenRouter.buildRequest(canonicalReq);
}

export function convertToAnthropicResponse(
    response: unknown,
    modelUsed: string,
    options?: { forceToolUse?: boolean; tools?: Array<{ name?: string }> },
): AnthropicResponse {
    // 1. OpenRouter Response -> Canonical Response
    const canonicalRes = OpenRouter.parseResponse(response);

    // Ensure Model is passed through if missing
    if (!canonicalRes.model && modelUsed) canonicalRes.model = modelUsed;

    // 2. Canonical Response -> Anthropic Response
    return AnthropicAdapter.Response.build(canonicalRes);
}

// Re-export helpers if needed by other legacy parts (or keep as stubs)
export function extractTextFromOpenRouter(response: any): string {
    const choices = (response as any)?.choices;
    if (Array.isArray(choices) && choices.length > 0) {
        const content = choices[0]?.message?.content;
        if (typeof content === 'string') return content.trim();
    }
    return '';
}

export function bodyTools(body: unknown): Array<{ name?: string }> | undefined {
    if (body && typeof body === 'object' && 'tools' in body) {
        const tools = (body as Record<string, unknown>).tools;
        if (Array.isArray(tools)) return tools as Array<{ name?: string }>;
    }
    return undefined;
}

// Deprecated aliases
export const fromCanonical = Request.build;
export const toCanonical = Response.parse;
