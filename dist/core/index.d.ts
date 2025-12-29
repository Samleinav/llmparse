import { CanonicalRequest, CanonicalResponse, CanonicalContentPart } from '../types';
/**
 * Base abstract class for all LLM Providers.
 * Provides the contract for 'parse' and 'build' operations.
 */
export declare abstract class BaseProvider {
    /**
     * Provider Name (e.g. 'anthropic', 'openrouter', 'openai')
     */
    abstract readonly name: string;
    /**
     * Parses a native provider request body into a Canonical Request.
     * @param body The raw request body from the provider/client.
     */
    abstract parseRequest(body: any): CanonicalRequest;
    /**
     * Builds a native provider request payload from a Canonical Request.
     * @param canonical The canonical request to transform.
     */
    abstract buildRequest(canonical: CanonicalRequest): any;
    /**
     * Parses a native provider API response into a Canonical Response.
     * @param body The raw response body from the provider's API.
     */
    abstract parseResponse(body: any): CanonicalResponse;
    /**
     * Builds a native provider client response from a Canonical Response.
     * @param canonical The canonical response to transform.
     */
    abstract buildResponse(canonical: CanonicalResponse): any;
}
/**
 * Shared Utility Class for Canonical Transformations
 */
export declare class CanonicalUtils {
    /**
     * Helper to normalize text content from various formats into a string.
     */
    static extractText(content: string | CanonicalContentPart[]): string;
    /**
     * Helper to check if a request contains images.
     */
    static hasImages(request: CanonicalRequest): boolean;
}
