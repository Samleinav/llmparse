import {
    AnthropicMessage,
    AnthropicRequest,
    AnthropicResponse,
    AnthropicContentBlock,
    CanonicalRequest,
    CanonicalResponse,
    CanonicalMessage,
    CanonicalContentPart,
    CanonicalToolDefinition
} from '../../types';
import { BaseProvider } from '../../core';

export class AnthropicProvider extends BaseProvider {
    readonly name = 'anthropic';

    // ----------------------------------------------------------------------
    // REQUEST HANDLING
    // ----------------------------------------------------------------------

    /**
     * Client Request -> Canonical Request
     */
    parseRequest(body: any): CanonicalRequest {
        const request = body as AnthropicRequest;
        const messages: CanonicalMessage[] = [];

        // System prompt in Anthropic is top-level, move to messages[0] if present
        if (request.system) {
            let content: string | CanonicalContentPart[] = '';
            if (typeof request.system === 'string') {
                content = request.system;
            } else if (Array.isArray(request.system)) {
                content = request.system.map((item) => this.toCanonicalContent(item));
            }
            messages.push({
                role: 'system',
                content
            });
        }

        // Convert Messages
        for (const msg of request.messages) {
            let content: string | CanonicalContentPart[] = '';
            if (typeof msg.content === 'string') {
                content = msg.content;
            } else if (Array.isArray(msg.content)) {
                content = msg.content.map((item) => this.toCanonicalContent(item));
            }

            messages.push({
                role: msg.role as 'user' | 'assistant',
                content
            });
        }

        // Convert Tools
        let tools: CanonicalToolDefinition[] | undefined;
        if (request.tools) {
            tools = request.tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.input_schema
            }));
        }

        // Convert Tool Choice
        let toolChoice: CanonicalRequest['tool_choice'] = 'auto';
        if (request.tool_choice) {
            if (request.tool_choice.type === 'any') toolChoice = 'required';
            else if (request.tool_choice.type === 'auto') toolChoice = 'auto';
            else if (request.tool_choice.type === 'tool' && request.tool_choice.name) {
                toolChoice = { type: 'function', function: { name: request.tool_choice.name } };
            }
        }

        return {
            provider: this.name,
            model: request.model,
            messages,
            tools,
            tool_choice: toolChoice,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stop: request.stop_sequences,
            stream: request.stream,
        };
    }

    /**
     * Canonical Request -> Client Payload (Not typically used unless Anthropic is the backend)
     */
    buildRequest(canonical: CanonicalRequest): AnthropicRequest {
        throw new Error("AnthropicProvider.buildRequest not implemented.");
    }

    // ----------------------------------------------------------------------
    // RESPONSE HANDLING
    // ----------------------------------------------------------------------

    /**
     * Canonical Response -> Client Response
     */
    buildResponse(canonical: CanonicalResponse): AnthropicResponse {
        const choice = canonical.choices[0];
        const message = choice.message;

        // Convert Content
        let content: string | Array<AnthropicContentBlock> = '';

        if (typeof message.content === 'string') {
            content = message.content;
        } else if (Array.isArray(message.content)) {
            content = message.content.map(part => {
                if (part.type === 'text') return { type: 'text', text: part.text || '' };
                if (part.type === 'tool_use') return {
                    type: 'tool_use',
                    id: part.id || 'call_unknown',
                    name: part.name || 'unknown',
                    input: part.input || {}
                };
                return { type: 'text', text: '' };
            }) as Array<AnthropicContentBlock>;
        }

        // Map Finish Reason
        let stopReason: AnthropicResponse['stop_reason'] = null;
        let stopSequence: string | null = null; // not standard in canonical yet

        if (choice.finish_reason === 'stop') stopReason = 'end_turn';
        else if (choice.finish_reason === 'length') stopReason = 'max_tokens';
        else if (choice.finish_reason === 'tool_calls') stopReason = 'tool_use';

        return {
            id: canonical.id,
            type: 'message',
            role: 'assistant',
            model: canonical.model,
            content,
            stop_reason: stopReason,
            stop_sequence: stopSequence,
            usage: {
                input_tokens: canonical.usage?.input_tokens ?? 0,
                output_tokens: canonical.usage?.output_tokens ?? 0
            }
        };
    }

    /**
     * Client API Response -> Canonical Response (Not typically used unless receiving from Anthropic)
     */
    parseResponse(body: any): CanonicalResponse {
        throw new Error("AnthropicProvider.parseResponse not implemented.");
    }

    // ----------------------------------------------------------------------
    // HELPERS
    // ----------------------------------------------------------------------

    private toCanonicalContent(block: AnthropicContentBlock | string): CanonicalContentPart {
        if (typeof block === 'string') {
            return { type: 'text', text: block };
        }

        switch (block.type) {
            case 'text':
                return { type: 'text', text: block.text };
            case 'image':
                if (block.source && block.source.type === 'base64') {
                    return {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: block.source.media_type,
                            data: block.source.data
                        }
                    };
                }
                return { type: 'text', text: '[Image]' };
            case 'tool_use':
                return {
                    type: 'tool_use',
                    id: block.id,
                    name: block.name,
                    input: block.input
                };
            case 'tool_result':
                let content: string | CanonicalContentPart[] = '';
                if (typeof block.content === 'string') {
                    content = block.content;
                } else if (Array.isArray(block.content)) {
                    content = block.content.map((item) => this.toCanonicalContent(item));
                }
                return {
                    type: 'tool_result',
                    tool_use_id: block.tool_use_id,
                    content,
                    is_error: block.is_error
                };
            default:
                return { type: 'text', text: '' };
        }
    }
}

// Singleton Instance
export const Anthropic = new AnthropicProvider();


// ----------------------------------------------------------------------
// EXPORT COMPATIBILITY OBJECTS (Matches previous Request/Response structure)
// ----------------------------------------------------------------------
// This ensures we don't break the code we just documented or implemented elsewhere.

export const Request = {
    parse: (body: any) => Anthropic.parseRequest(body),
    build: (canonical: CanonicalRequest) => Anthropic.buildRequest(canonical)
};

export const Response = {
    parse: (body: any) => Anthropic.parseResponse(body),
    build: (canonical: CanonicalResponse) => Anthropic.buildResponse(canonical)
};

// Internal Helpers (Deprecated but kept for now)
export function isAnthropicMessage(msg: any): msg is AnthropicMessage {
    return (
        typeof msg === 'object' &&
        typeof msg.role === 'string' &&
        (typeof msg.content === 'string' || Array.isArray(msg.content))
    );
}

// Deprecated aliases
export const toCanonical = Request.parse;
export const fromCanonical = Response.build;
