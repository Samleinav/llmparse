import { CanonicalRequest, CanonicalResponse } from '../../types';
import { BaseProvider } from '../../core';
export declare const GEMINI_DEFAULT_MODEL = "gemini-1.5-pro";
export declare class GeminiProvider extends BaseProvider {
    readonly name = "gemini";
    /**
     * Helper: Parse Gemini Request -> Canonical (Not usually needed for Proxy)
     */
    parseRequest(body: any): CanonicalRequest;
    /**
     * Canonical Request -> Gemini API Payload (GenerateContentParameters equivalent)
     */
    buildRequest(canonical: CanonicalRequest): any;
    parseResponse(body: any): CanonicalResponse;
    buildResponse(canonical: CanonicalResponse): any;
    private toGeminiParts;
    private toGeminiFunction;
    request: {
        parse: (body: any) => CanonicalRequest;
        build: (canonical: CanonicalRequest) => any;
    };
    response: {
        parse: (body: any) => CanonicalResponse;
        build: (canonical: CanonicalResponse) => any;
    };
}
export declare const Gemini: GeminiProvider;
