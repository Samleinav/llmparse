# LLMParse

A standalone TypeScript library for parsing and transforming LLM (Large Language Model) requests and responses between different provider formats.

This library implements a **Canonical Schema** to standardize interactions across providers (Anthropic, OpenAI, Google Gemini, OpenRouter), enabling robust "Bring Your Own Key" (BYOK) integrations and simplified routing logic.

## Architecture: The Canonical Pipeline

The core design follows a `Provider <-> Canonical <-> Provider` pipeline. All transformations pass through a universal intermediate format (`CanonicalRequest` / `CanonicalResponse`).

### BaseProvider Abstraction

All providers extend the `BaseProvider` class, ensuring a consistent interface:

- `parseRequest(body)`: Transforms a native request (from client) -> `CanonicalRequest`.
- `buildRequest(canonical)`: Transforms `CanonicalRequest` -> native request payload (for API).
- `parseResponse(body)`: Transforms a native API response -> `CanonicalResponse`.
- `buildResponse(canonical)`: Transforms `CanonicalResponse` -> native client response.

## Supported Providers

- **OpenRouter**: Full Proxy Support (Canonical -> OpenRouter API -> Canonical).
- **Anthropic**: Full Client Support (Anthropic Client -> Canonical -> Anthropic Client).
- **OpenAI**: Scaffolded.
- **Gemini**: Scaffolded.

## Usage

### 1. Basic Proxy Flow (Anthropic Client -> OpenRouter API)

This is the primary use case: acting as a proxy that accepts Anthropic SDK requests but routes them to OpenRouter (or OpenAI/Gemini).

```typescript
import { Anthropic, OpenRouter } from './llmparse';

export async function POST(req: Request) {
    const body = await req.json();

    // 1. Parse inbound request (Anthropic format) to Canonical
    const canonicalReq = Anthropic.parseRequest(body);

    // 2. Build outbound payload for OpenRouter
    // (Optional: Modify canonicalReq.model here if needed)
    const openRouterPayload = OpenRouter.buildRequest(canonicalReq);

    // 3. Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify(openRouterPayload),
        headers: { 
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` 
        }
    });
    const responseJson = await response.json();

    // 4. Parse outbound response to Canonical
    const canonicalRes = OpenRouter.parseResponse(responseJson);

    // 5. Build final response for Anthropic Client
    const clientResponse = Anthropic.buildResponse(canonicalRes);

    return Response.json(clientResponse);
}
```

### 2. Manual / Dynamic Routing

You can inspect the `CanonicalRequest` to decide which provider to use.

```typescript
import { Anthropic, OpenRouter, OpenAI } from './llmparse';

const canonicalReq = Anthropic.parseRequest(body);

let backendResponse;

if (canonicalReq.model.startsWith('gpt')) {
    const payload = OpenAI.buildRequest(canonicalReq);
    // call OpenAI...
    backendResponse = OpenAI.parseResponse(rawOpenAIRes);
} else {
    const payload = OpenRouter.buildRequest(canonicalReq);
    // call OpenRouter...
    backendResponse = OpenRouter.parseResponse(rawOpenRouterRes);
}

const finalRes = Anthropic.buildResponse(backendResponse);
```

## Directory Structure

- `src/core/`: Base abstractions (`BaseProvider`, `CanonicalUtils`).
- `src/types/`: Shared interface definitions (Canonical Schema, Native Types).
- `src/providers/`: Provider specific implementations.
    - `anthropic/`
    - `openrouter/`
    - `openai/`
    - `gemini/`

## Development

To add a new provider (e.g. **Gemini**):

1.  Create `src/providers/gemini/index.ts`.
2.  Extend `BaseProvider`.
3.  Implement transformation methods (using `CanonicalUtils` helpers where possible).
4.  Export singleton instance.
