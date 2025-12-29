"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanonicalUtils = exports.BaseProvider = void 0;
/**
 * Base abstract class for all LLM Providers.
 * Provides the contract for 'parse' and 'build' operations.
 */
class BaseProvider {
}
exports.BaseProvider = BaseProvider;
/**
 * Shared Utility Class for Canonical Transformations
 */
class CanonicalUtils {
    /**
     * Helper to normalize text content from various formats into a string.
     */
    static extractText(content) {
        if (typeof content === 'string')
            return content;
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
    static hasImages(request) {
        return request.messages.some(msg => Array.isArray(msg.content) && msg.content.some(p => p.type === 'image'));
    }
}
exports.CanonicalUtils = CanonicalUtils;
