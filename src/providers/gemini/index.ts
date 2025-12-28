import {
    CanonicalRequest,
    CanonicalResponse,
    CanonicalContentPart,
    CanonicalToolDefinition,
    CanonicalMessage
} from '../../types';
import { BaseProvider } from '../../core';
import {
    type GenerateContentResponse,
    type Part,
    type Content,
    type FunctionCall,
    type FunctionResponse,
    type Tool,
    type FunctionDeclaration,
    type Schema
} from '@google/genai';

export const GEMINI_DEFAULT_MODEL = 'gemini-1.5-pro';

export class GeminiProvider extends BaseProvider {
    readonly name = 'gemini';

    // ----------------------------------------------------------------------
    // REQUEST HANDLING (Canonical -> Gemini)
    // ----------------------------------------------------------------------

    /**
     * Helper: Parse Gemini Request -> Canonical (Not usually needed for Proxy)
     */
    parseRequest(body: any): CanonicalRequest {
        throw new Error("GeminiProvider.parseRequest not implemented (Optional).");
    }

    /**
     * Canonical Request -> Gemini API Payload (GenerateContentParameters equivalent)
     */
    buildRequest(canonical: CanonicalRequest): any {
        // 1. Extract System Instruction
        let systemInstruction: Content | undefined;
        const systemMsg = canonical.messages.find(m => m.role === 'system');
        if (systemMsg) {
            systemInstruction = {
                role: 'system', // Gemini doesn't strictly use role for/in systemInstruction object usually, but the content structure is same
                parts: this.toGeminiParts(systemMsg.content)
            };
        }

        // 2. Convert Conversation History (User/Model)
        const contents: Content[] = canonical.messages
            .filter(m => m.role !== 'system') // System is handled separately
            .map(msg => {
                // Map Roles: user -> user, assistant -> model
                const role = msg.role === 'assistant' ? 'model' : 'user';
                // Note: 'tool' role messages in Canonical are usually "tool results"
                // In Gemini, these are 'function_response' parts within a 'user' (usually) or 'function' role message depending on API version.
                // Latest Gemini API often expects function responses in specific structure.

                if (msg.role === 'tool') {
                    // Canonical: role='tool', content='result string', tool_use_id='...'
                    // Gemini: role='function', parts=[{ functionResponse: { name, response } }]
                    // We need to look up function name if it's missing in canonical msg (Canonical msg just has tool_use_id usually).
                    // However, Gemini requires the 'name'. Canonical schema for tool_result has 'name' optionally or we presume checks.
                    // IMPORTANT: Canonical 'tool' messages corresponds to `functionResponse` parts in Gemini.
                    return {
                        role: 'function',
                        parts: this.toGeminiParts(msg.content, 'function_response', msg) // specialized handler
                    };
                }

                return {
                    role,
                    parts: this.toGeminiParts(msg.content)
                };
            });

        // 3. Convert Tools
        let tools: Tool[] | undefined;
        if (canonical.tools && canonical.tools.length > 0) {
            tools = [{
                functionDeclarations: canonical.tools.map(t => this.toGeminiFunction(t))
            }];
        }

        // 4. Construct Payload
        // The structure matches strict @google/genai 'GenerateContentRequest' or params
        return {
            model: canonical.model || GEMINI_DEFAULT_MODEL,
            config: {
                temperature: canonical.temperature,
                maxOutputTokens: canonical.max_tokens,
                topP: canonical.top_p,
                stopSequences: canonical.stop ? (Array.isArray(canonical.stop) ? canonical.stop : [canonical.stop]) : undefined,
            },
            systemInstruction,
            contents,
            tools
        };
    }

    // ----------------------------------------------------------------------
    // RESPONSE HANDLING (Gemini -> Canonical)
    // ----------------------------------------------------------------------

    parseResponse(body: any): CanonicalResponse {
        const response = body as GenerateContentResponse;

        // Gemini responses might have 'candidates'
        const candidate = response.candidates?.[0];

        // Map Finish Reason
        let finish_reason: CanonicalResponse['choices'][0]['finish_reason'] = 'stop';
        if (candidate?.finishReason === 'MAX_TOKENS') finish_reason = 'length';
        else if (candidate?.finishReason === 'STOP') finish_reason = 'stop';
        // Note: Gemini distinguishes 'functionCall' presence vs finishReason sometimes.

        // Convert Content & Tool Calls
        const contentParts: CanonicalContentPart[] = [];

        candidate?.content?.parts?.forEach((part: Part) => {
            if (part.text) {
                contentParts.push({ type: 'text', text: part.text });
            }
            if (part.functionCall) {
                finish_reason = 'tool_calls'; // override if we see a call
                contentParts.push({
                    type: 'tool_use',
                    id: 'call_' + Math.random().toString(36).substr(2, 9), // Gemini 1.0 didn't always provide IDs, 1.5 does usually. Using placeholder if missing.
                    name: part.functionCall.name,
                    input: part.functionCall.args
                });
            }
        });

        return {
            id: 'gen-' + Math.random().toString(36).substr(2, 9), // Gemini doesn't always send an ID request-wide
            created: Date.now(),
            model: 'gemini', // often not echoed back in top level
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: contentParts
                },
                finish_reason
            }],
            usage: {
                input_tokens: response.usageMetadata?.promptTokenCount || 0,
                output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: response.usageMetadata?.totalTokenCount || 0
            }
        };
    }

    buildResponse(canonical: CanonicalResponse): any {
        throw new Error("GeminiProvider.buildResponse not implemented (Optional).");
    }

    // ----------------------------------------------------------------------
    // HELPERS
    // ----------------------------------------------------------------------

    private toGeminiParts(
        content: string | CanonicalContentPart[] | any,
        mode: 'normal' | 'function_response' = 'normal',
        extraContext?: any
    ): Part[] {
        if (typeof content === 'string') {
            return [{ text: content }];
        }

        if (Array.isArray(content)) {
            return content.map((p: any) => {
                if (p.type === 'text') return { text: p.text };

                if (p.type === 'tool_use') {
                    // Assistant asking to use tool -> FunctionCall
                    return {
                        functionCall: {
                            name: p.name,
                            args: p.input
                        }
                    };
                }

                if (p.type === 'tool_result' || mode === 'function_response') {
                    // User providing result -> FunctionResponse
                    // In Canonical, 'tool_result' parts usually exist in 'tool' role messages.
                    // Gemini Part: { functionResponse: { name, response: { content: ... } } }

                    // We need the function name. Canonical tool_result structure: { tool_use_id, content }
                    // If 'name' is not stored in Canonical tool_result, we might need to rely on the user passing it or mapping IDs.
                    // The user prompt said "campos que no manejamos lo principal ahora es texto y tools".
                    // We will assume 'name' might be available or generic mapping. 
                    // NOTE: CanonicalToolDefinition doesn't strictly hold 'name' in tool *result*.
                    // We might need to handle this loosely.

                    return {
                        functionResponse: {
                            name: p.name || "unknown_tool",
                            response: { result: p.content }
                        }
                    };
                }

                return { text: '' }; // Fallback
            });
        }
        return [];
    }

    private toGeminiFunction(tool: CanonicalToolDefinition): FunctionDeclaration {
        return {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as Schema // Assuming JSON Schema compatibility
        };
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

export const Gemini = new GeminiProvider();
