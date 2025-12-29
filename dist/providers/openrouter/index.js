"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCanonical = exports.fromCanonical = exports.Response = exports.Request = exports.OpenRouter = exports.OpenRouterProvider = exports.OPENROUTER_DEFAULT_MODEL = void 0;
exports.buildOpenRouterPayload = buildOpenRouterPayload;
exports.convertToAnthropicResponse = convertToAnthropicResponse;
exports.extractTextFromOpenRouter = extractTextFromOpenRouter;
exports.bodyTools = bodyTools;
const AnthropicAdapter = __importStar(require("../anthropic"));
const core_1 = require("../../core");
exports.OPENROUTER_DEFAULT_MODEL = 'openai/gpt-3.5-turbo';
class OpenRouterProvider extends core_1.BaseProvider {
    constructor() {
        super(...arguments);
        this.name = 'openrouter';
        this.request = {
            parse: (body) => this.parseRequest(body),
            build: (canonical) => this.buildRequest(canonical)
        };
        this.response = {
            parse: (body) => this.parseResponse(body),
            build: (canonical) => this.buildResponse(canonical)
        };
    }
    // ----------------------------------------------------------------------
    // REQUEST HANDLING
    // ----------------------------------------------------------------------
    /**
     * Parse Request (Not typically used unless treating OpenRouter as a Client Input)
     */
    parseRequest(body) {
        throw new Error("OpenRouterProvider.parseRequest not implemented (Optional: for receiving OpenRouter payloads as input)");
    }
    /**
     * Canonical Request -> Provider Payload
     */
    buildRequest(canonical) {
        const messages = canonical.messages.flatMap((msg) => {
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
                        }
                        else if (Array.isArray(part.content)) {
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
                    if (p.type === 'text')
                        return { type: 'text', text: p.text };
                    return null;
                }).filter(Boolean);
                if (standardContent.length > 0) {
                    return [{ role, content: standardContent }];
                }
            }
            return [];
        });
        // Tools
        let tools;
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
            model: canonical.model ?? exports.OPENROUTER_DEFAULT_MODEL,
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
    parseResponse(body) {
        return {
            id: body.id,
            created: body.created,
            model: body.model,
            choices: (body.choices || []).map((c) => {
                const msg = c.message || {};
                let content = msg.content || '';
                // If tool calls exist, they become 'tool_use' parts in Canonical
                if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                    const currentParts = [];
                    if (content && typeof content === 'string' && content.trim().length > 0) {
                        currentParts.push({ type: 'text', text: content });
                    }
                    msg.tool_calls.forEach((tc) => {
                        currentParts.push({
                            type: 'tool_use',
                            id: tc.id,
                            name: tc.function?.name,
                            input: (() => {
                                if (typeof tc.function?.arguments === 'string') {
                                    try {
                                        return JSON.parse(tc.function.arguments);
                                    }
                                    catch {
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
    buildResponse(canonical) {
        throw new Error("OpenRouterProvider.buildResponse not implemented (Optional).");
    }
}
exports.OpenRouterProvider = OpenRouterProvider;
// Singleton Instance
exports.OpenRouter = new OpenRouterProvider();
// ----------------------------------------------------------------------
// EXPORT COMPATIBILITY OBJECTS
// ----------------------------------------------------------------------
exports.Request = {
    parse: (body) => exports.OpenRouter.parseRequest(body),
    build: (canonical) => exports.OpenRouter.buildRequest(canonical)
};
exports.Response = {
    parse: (body) => exports.OpenRouter.parseResponse(body),
    build: (canonical) => exports.OpenRouter.buildResponse(canonical)
};
// ----------------------------------------------------------------------
// LEGACY / ADAPTER FUNCTIONS
// ----------------------------------------------------------------------
function buildOpenRouterPayload(body, overrides) {
    // 1. Convert Anthropic Body -> Canonical Request
    const canonicalReq = AnthropicAdapter.Request.parse(body);
    // 2. Apply Overrides (mutate canonical req)
    if (overrides?.model)
        canonicalReq.model = overrides.model;
    if (overrides?.temperature !== undefined)
        canonicalReq.temperature = overrides.temperature;
    if (overrides?.maxTokens !== undefined)
        canonicalReq.max_tokens = overrides.maxTokens;
    if (overrides?.stream !== undefined)
        canonicalReq.stream = overrides.stream;
    // Explicit override handling for pre-converted messages (Legacy)
    if (overrides?.messages) {
        const partialPayload = exports.OpenRouter.buildRequest(canonicalReq);
        partialPayload.messages = overrides.messages;
        return partialPayload;
    }
    // 3. Convert Canonical Request -> OpenRouter Payload
    return exports.OpenRouter.buildRequest(canonicalReq);
}
function convertToAnthropicResponse(response, modelUsed, options) {
    // 1. OpenRouter Response -> Canonical Response
    const canonicalRes = exports.OpenRouter.parseResponse(response);
    // Ensure Model is passed through if missing
    if (!canonicalRes.model && modelUsed)
        canonicalRes.model = modelUsed;
    // 2. Canonical Response -> Anthropic Response
    return AnthropicAdapter.Response.build(canonicalRes);
}
// Re-export helpers if needed by other legacy parts (or keep as stubs)
function extractTextFromOpenRouter(response) {
    const choices = response?.choices;
    if (Array.isArray(choices) && choices.length > 0) {
        const content = choices[0]?.message?.content;
        if (typeof content === 'string')
            return content.trim();
    }
    return '';
}
function bodyTools(body) {
    if (body && typeof body === 'object' && 'tools' in body) {
        const tools = body.tools;
        if (Array.isArray(tools))
            return tools;
    }
    return undefined;
}
// Deprecated aliases
exports.fromCanonical = exports.Request.build;
exports.toCanonical = exports.Response.parse;
