import {
    CanonicalRequest,
    CanonicalResponse,
    CanonicalContentPart
} from '../types';

/**
 * Base abstract class for all LLM Providers.
 * Provides the contract for 'parse' and 'build' operations.
 */
export abstract class BaseProvider {
    /**
     * Provider Name (e.g. 'anthropic', 'openrouter', 'openai')
     */
    abstract readonly name: string;

    // ----------------------------------------------------------------------
    // REQUEST HANDLING
    // ----------------------------------------------------------------------

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


    // ----------------------------------------------------------------------
    // RESPONSE HANDLING
    // ----------------------------------------------------------------------

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
export class CanonicalUtils {
    /**
     * Helper to normalize text content from various formats into a string.
     */
    static extractText(content: string | CanonicalContentPart[]): string {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .filter(p => p.type === 'text')
                .map(p => p.text)
                .join('\n');
        }
        return '';
    }

    /**
     * Helper to check if a request contains images.
     */
    static hasImages(request: CanonicalRequest): boolean {
        return request.messages.some(msg =>
            Array.isArray(msg.content) && msg.content.some(p => p.type === 'image')
        );
    }
}
