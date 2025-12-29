export type CanonicalRole = 'system' | 'user' | 'assistant' | 'tool';
export interface CanonicalContentPart {
    type: 'text' | 'image' | 'tool_use' | 'tool_result';
    text?: string;
    image_url?: {
        url: string;
        detail?: 'auto' | 'low' | 'high';
    };
    source?: {
        type: 'base64';
        media_type: string;
        data: string;
    };
    id?: string;
    name?: string;
    input?: Record<string, any>;
    tool_use_id?: string;
    content?: string | Array<CanonicalContentPart>;
    is_error?: boolean;
}
export interface CanonicalMessage {
    role: CanonicalRole;
    content: string | CanonicalContentPart[];
    name?: string;
}
export interface CanonicalToolDefinition {
    name: string;
    description?: string;
    parameters: Record<string, any>;
}
export interface CanonicalRequest {
    provider: string;
    model: string;
    messages: CanonicalMessage[];
    tools?: CanonicalToolDefinition[];
    tool_choice?: 'auto' | 'none' | 'required' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string | string[];
    stream?: boolean;
    user_id?: string;
}
export interface CanonicalUsage {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
}
export interface CanonicalResponse {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: CanonicalMessage;
        finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | null;
    }>;
    usage?: CanonicalUsage;
    error?: {
        code: string;
        message: string;
    };
}
export interface AnthropicMessage {
    role: string;
    content: string | Array<AnthropicContentBlock>;
}
export interface AnthropicContentBlock {
    type: 'text' | 'image' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, any>;
    tool_use_id?: string;
    content?: string | Array<AnthropicContentBlock>;
    source?: {
        type: 'base64';
        media_type: string;
        data: string;
    };
    is_error?: boolean;
}
export interface AnthropicTool {
    name: string;
    description?: string;
    input_schema: Record<string, any>;
}
export interface AnthropicRequest {
    model: string;
    messages: AnthropicMessage[];
    system?: string | Array<AnthropicContentBlock>;
    max_tokens: number;
    metadata?: any;
    stop_sequences?: string[];
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    tools?: AnthropicTool[];
    tool_choice?: {
        type: 'auto' | 'any' | 'tool';
        name?: string;
    };
}
export interface UnifiedLLMPayload extends Partial<CanonicalRequest> {
}
export interface AnthropicResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: string | Array<AnthropicContentBlock>;
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
    stop_sequence: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}
