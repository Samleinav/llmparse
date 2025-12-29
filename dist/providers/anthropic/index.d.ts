import { AnthropicMessage, AnthropicRequest, AnthropicResponse, CanonicalRequest, CanonicalResponse } from '../../types';
import { BaseProvider } from '../../core';
export declare class AnthropicProvider extends BaseProvider {
    readonly name = "anthropic";
    /**
     * Client Request -> Canonical Request
     */
    parseRequest(body: any): CanonicalRequest;
    /**
     * Canonical Request -> Client Payload (Not typically used unless Anthropic is the backend)
     */
    buildRequest(canonical: CanonicalRequest): AnthropicRequest;
    /**
     * Canonical Response -> Client Response
     */
    buildResponse(canonical: CanonicalResponse): AnthropicResponse;
    /**
     * Client API Response -> Canonical Response (Not typically used unless receiving from Anthropic)
     */
    parseResponse(body: any): CanonicalResponse;
    private toCanonicalContent;
}
export declare const Anthropic: AnthropicProvider;
export declare const Request: {
    parse: (body: any) => CanonicalRequest;
    build: (canonical: CanonicalRequest) => AnthropicRequest;
};
export declare const Response: {
    parse: (body: any) => CanonicalResponse;
    build: (canonical: CanonicalResponse) => AnthropicResponse;
};
export declare function isAnthropicMessage(msg: any): msg is AnthropicMessage;
export declare const toCanonical: (body: any) => CanonicalRequest;
export declare const fromCanonical: (canonical: CanonicalResponse) => AnthropicResponse;
