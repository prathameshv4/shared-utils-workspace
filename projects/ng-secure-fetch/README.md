# ng-secure-fetch

Zero-dependency Angular library providing **RSA-2048-OAEP + AES-256-GCM hybrid encryption** with automatic HTTP request/response encryption and sessionStorage caching.

**Browser-only library** using the Web Crypto API - requires browser environment.

## Features

- Hybrid encryption: RSA-2048-OAEP + AES-256-GCM
- Automatic HTTP interceptors (transparent encryption/decryption)
- SessionStorage caching (95% faster page refresh)
- Public key pinning (SHA-256 hash verification)
- Advanced pattern matching with dynamic segments
- Per-request unique AES keys
- Zero dependencies (Web Crypto API)
- Browser environment only

## Compatibility

- **Angular**: 17+ (compatible with Angular 17 and all future versions)
- **Environment**: Browser only (uses `window.crypto` Web Crypto API)
- **Node.js**: Not supported in standard Node.js environments without polyfills

## Installation

```bash
npm install ng-secure-fetch
```

## Quick Start

### 1. Import and Configure

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideNgSecureFetch } from 'ng-secure-fetch';
import { environment } from './environments/environment';

// In your app.config.ts (standalone) or app.module.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideNgSecureFetch({
      enableEncryption: true,
      publicKeyEndpoint: environment.apiUrl + '/crypto/init',
      expectedPublicKeyHash: 'your-sha256-hash-here',
      encryptDecryptForEndpoints: ['*'],
      skipEncryptDecryptForEndpoints: ['/public/*'],
      publicKeyHeaderName: 'X-Client-Init',
      aesKeyHeaderName: 'X-Request-Context',
      ivHeaderName: 'X-Client-Ref',
      enableDebugLogging: true,
      publicKeyFetchRetries: 3
    })
  ]
};
```

### 2. Get Your Public Key Hash

Enable debug logging temporarily to get your public key hash:

```typescript
enableDebugLogging: true
```

Check console output:
```
[ng-secure-fetch] Public key hash: abc123def456...your-actual-hash...
```

Copy the hash to `expectedPublicKeyHash` in your configuration.

### 3. Done!

All HTTP requests matching your endpoint patterns are now automatically encrypted.

## Configuration

```typescript
interface SecurityConfig {
  enableEncryption?: boolean;                  // Master switch (default: true)
  publicKeyEndpoint?: string;                  // API endpoint for public key
  expectedPublicKeyHash?: string;              // SHA-256 hash for MITM prevention
  encryptDecryptForEndpoints?: string[];       // Endpoint patterns (default: ['*'])
  skipEncryptDecryptForEndpoints?: string[];   // Exclude patterns (higher priority)
  publicKeyHeaderName?: string;                // Custom public key header (default: 'X-Client-Init')
  aesKeyHeaderName?: string;                   // Custom AES key header (default: 'X-Request-Context')
  ivHeaderName?: string;                       // Custom IV header (default: 'X-Client-Ref')
  enableDebugLogging?: boolean;                // Console logs (default: false)
  publicKeyFetchRetries?: number;              // Retry attempts (default: 3)
}
```

## Endpoint Pattern Matching

Supports advanced pattern matching with dynamic segments and exclusion patterns:

| Pattern | Description | Examples |
|---------|-------------|----------|
| `['*']` | Match all endpoints | Any URL |
| `['/api/*']` | Glob pattern | `/api/users`, `/api/products` |
| `['/exact/path']` | Exact substring | URLs containing `/exact/path` |
| `['v1/{ignore}/users']` | Dynamic segment | `v1/MT1/users`, `v1/MT2/users` |
| `['/api/{ignore}/items/{ignore}']` | Multiple dynamic | `/api/v1/items/123` |

### Dynamic Segments with `{ignore}`

```typescript
// Pattern: 'v1/universal/business/applicationform/{ignore}/pocketInsurance'
// Matches:
//   ✅ v1/universal/business/applicationform/MT1/pocketInsurance
//   ✅ v1/universal/business/applicationform/MT2/pocketInsurance
//   ✅ v1/universal/business/applicationform/ABC123/pocketInsurance
//   ❌ v1/universal/business/applicationform/pocketInsurance (missing segment)

encryptDecryptForEndpoints: [
  'v1/universal/business/applicationform/{ignore}/pocketInsurance'
]
```

The `{ignore}` placeholder matches any non-slash characters, perfect for dynamic IDs or version numbers.

### Skip Patterns (Exclusion with Higher Priority)

Use `skipEncryptDecryptForEndpoints` to exclude specific endpoints even if they match `encryptDecryptForEndpoints`:

```typescript
provideNgSecureFetch({
  enableEncryption: true,
  
  // Encrypt all API endpoints
  encryptDecryptForEndpoints: ['*'],
  
  // But skip these specific endpoints (higher priority)
  skipEncryptDecryptForEndpoints: [
    '/v1/public/*',                    // Skip all public APIs
    '/v1/health/check',                // Skip health check
    'v1/user/{ignore}/profile/image'   // Skip profile image endpoints
  ],
  
  // ...other config
})
```

**Priority:**
1. `skipEncryptDecryptForEndpoints` is checked **first** (if match → skip encryption)
2. `encryptDecryptForEndpoints` is checked **second** (if match → encrypt)
3. If neither matches → no encryption

**Example Scenarios:**
```typescript
// Scenario 1: Encrypt all except public endpoints
encryptDecryptForEndpoints: ['*']
skipEncryptDecryptForEndpoints: ['/v1/public/*']
// Result: /v1/public/data → not encrypted
//         /v1/private/data → encrypted

// Scenario 2: Encrypt specific endpoints but skip one
encryptDecryptForEndpoints: ['v1/api/{ignore}/process']
skipEncryptDecryptForEndpoints: ['v1/api/health/process']
// Result: v1/api/MT1/process → encrypted
//         v1/api/health/process → not encrypted (skip has priority)

// Scenario 3: Fine-grained control
encryptDecryptForEndpoints: ['/v1/business/*', '/v2/universal/*']
skipEncryptDecryptForEndpoints: ['/v1/business/public/*']
// Result: /v1/business/public/data → not encrypted (skip wins)
//         /v1/business/private/data → encrypted
//         /v2/universal/anything → encrypted
```

## How It Works

### Initialization
1. Check sessionStorage for cached PEM key
2. If found: validate hash, import key, continue (5-10ms)
3. If not found: fetch from API, verify hash, cache, continue (200-300ms)

### Request Encryption (POST/PUT/PATCH)
1. Generate random AES-256-GCM key + IV
2. Encrypt payload with AES-GCM
3. Encrypt AES key + IV with RSA public key
4. Send encrypted data in body, keys in headers

### Response Decryption
1. Extract AES key + IV from response headers
2. Decrypt response body with AES-GCM
3. Return decrypted data to component

## Backend Requirements

### 1. Public Key Endpoint (GET /crypto/init)

```
HTTP/1.1 200 OK
X-Client-Init: -----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
Access-Control-Expose-Headers: X-Client-Init
```

**CORS is critical:** Without `Access-Control-Expose-Headers`, Angular cannot access the header even if visible in Network tab.

### 2. Decrypt Requests

- Extract `X-Request-Context` (RSA-encrypted AES key)
- Extract `X-Client-Ref` (RSA-encrypted IV)
- Decrypt with RSA private key
- Decrypt request body with AES-256-GCM
- Remove padding (split by `||`)

### 3. Encrypt Responses

```
HTTP/1.1 200 OK
X-Request-Context: <base64-raw-aes-key>
X-Client-Ref: <base64-raw-iv>
Access-Control-Expose-Headers: X-Request-Context, X-Client-Ref

<Base64 encrypted data>
```

**Important:** Response headers contain raw AES key/IV (not RSA-encrypted), just base64-encoded.

## Custom Header Names

By default, the library expects the public key in the `X-Client-Init` header. You can customize this:

```typescript
// app.config.ts or app.module.ts
provideNgSecureFetch({
  enableEncryption: true,
  publicKeyEndpoint: environment.apiUrl + '/crypto/init',
  publicKeyHeaderName: 'X-Custom-Public-Key',  // Custom header name
  expectedPublicKeyHash: 'your-sha256-hash-here',
  encryptDecryptForEndpoints: ['*'],
  enableDebugLogging: false,
  publicKeyFetchRetries: 3
})
```

**Backend Response:**
```
HTTP/1.1 200 OK
X-Custom-Public-Key: -----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
Access-Control-Expose-Headers: X-Custom-Public-Key
```

**Use Cases:**
- Corporate proxy requirements (some proxies block certain headers)
- Compliance with company header naming conventions
- Avoiding conflicts with existing headers
- Custom security policies

### Custom AES Key and IV Headers

You can also customize the headers used for AES key and IV exchange:

```typescript
// app.config.ts or app.module.ts
provideNgSecureFetch({
  enableEncryption: true,
  publicKeyEndpoint: environment.apiUrl + '/crypto/init',
  publicKeyHeaderName: 'X-Custom-Public-Key',
  aesKeyHeaderName: 'X-Custom-AES-Key',      // Custom AES key header
  ivHeaderName: 'X-Custom-IV',                // Custom IV header
  expectedPublicKeyHash: 'your-sha256-hash-here',
  encryptDecryptForEndpoints: ['*'],
  enableDebugLogging: false,
  publicKeyFetchRetries: 3
})
```

**Request Headers (Frontend sends):**
```http
POST /api/data
X-Custom-AES-Key: <encrypted-aes-key-base64>
X-Custom-IV: <encrypted-iv-base64>
Content-Type: text/plain

<encrypted-payload>
```

**Response Headers (Backend sends):**
```http
HTTP/1.1 200 OK
X-Custom-AES-Key: <raw-aes-key-base64>
X-Custom-IV: <raw-iv-base64>
Access-Control-Expose-Headers: X-Custom-AES-Key, X-Custom-IV

<encrypted-response>
```

**Important:** 
- Request headers contain RSA-encrypted AES key and IV (frontend → backend)
- Response headers contain raw (base64) AES key and IV (backend → frontend)
- All custom headers must be included in `Access-Control-Expose-Headers`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Hash mismatch | Check console for actual hash, update `expectedPublicKeyHash` |
| Header not found | Backend must add: `Access-Control-Expose-Headers: X-Client-Init` (or custom header name) |
| Custom header not found | Set `publicKeyHeaderName` in config and ensure backend sends that header |
| Custom AES/IV headers not found | Set `aesKeyHeaderName` and `ivHeaderName` in config; backend must send custom headers and expose them in CORS |
| App won't load | Check network tab for `/crypto/init`, verify endpoint reachable |
| Not encrypting | Check URL matches endpoint patterns, try `['*']` to test |
| Decryption fails | Verify backend sends AES key and IV headers (default: `X-Request-Context`, `X-Client-Ref` or your custom names) |
| Pattern not matching | Enable debug logging to see pattern matching details |

## Key Improvements

### SessionStorage Caching
- First load: ~200-300ms (API call + RSA import)
- Page refresh: ~5-10ms (cached key) - **95% faster**
- Cache cleared on: browser close, hash mismatch, validation failure

### Centralized Pattern Matching
- `matchesPattern()` method in `CryptoService`
- Shared between encryption and decryption interceptors
- Supports dynamic segments with `{ignore}` placeholder

### CORS-Aware Error Messages
- Clear error messages when headers are blocked by CORS
- Distinguishes between "header not sent" vs "header blocked by browser"

## Architecture

### File Structure

```
ng-secure-fetch/
├── config/ng-secure-fetch.config.ts       # provideNgSecureFetch()
├── initializers/ng-secure-fetch.initializer.ts   # APP_INITIALIZER
├── interceptors/
│   ├── encryption.interceptor.ts          # Request encryption
│   └── decryption.interceptor.ts          # Response decryption
├── models/
│   ├── ng-secure-fetch-config.interface.ts   # Config interface
│   └── encrypted-payload.interface.ts     # Payload structure
└── services/crypto.service.ts             # Core crypto + pattern matching
```

### Key Concepts

- **RSA-OAEP**: Asymmetric encryption for key exchange (slow, secure)
- **AES-256-GCM**: Symmetric encryption for data (fast, secure, authenticated)
- **Hybrid Encryption**: Use RSA to encrypt AES key, use AES to encrypt data
- **Web Crypto API**: Browser-native crypto (no external libraries)
- **Browser Only**: Requires `window.crypto` - not compatible with standard Node.js
- **APP_INITIALIZER**: Angular DI token to run code before app loads
- **HTTP Interceptors**: Middleware for HTTP requests/responses
- **SessionStorage**: Browser storage that persists across page refreshes (tab-scoped)

## Changelog

### v1.0.0 (Current)
- Renamed from "security" to "ng-secure-fetch"
- Updated function name from `provideSecurity()` to `provideNgSecureFetch()`
- Added npm publishing metadata
- Browser environment only (Web Crypto API)
- `skipEncryptDecryptForEndpoints` configuration (exclusion patterns with higher priority)
- Error response decryption (4xx, 5xx status codes)
- Enhanced error structure with `Object.assign()` for backward compatibility
- Updated `matchesPattern()` to support skip patterns
- Added debug logging for POST/PUT/PATCH request bodies
- Added dynamic segment support with `{ignore}` placeholder
- Moved `matchesPattern()` to `CryptoService` (DRY principle)
- Improved CORS error messages
- SessionStorage caching (95% faster refresh)
- Automatic HTTP interceptors
- Public key pinning

## Building the Library

To build the library for distribution:

```bash
ng build ng-secure-fetch
```

Build artifacts will be in `dist/ng-secure-fetch/`.

## Publishing to npm

```bash
cd dist/ng-secure-fetch
npm publish
```

## Running Tests

```bash
ng test ng-secure-fetch
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/yourusername/ng-secure-fetch/issues) page.
