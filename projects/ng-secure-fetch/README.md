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

- **Angular**: 16+ (compatible with Angular 16 and all future versions)
- **Environment**: Browser only (uses `window.crypto` Web Crypto API)
- **Node.js**: Not supported in standard Node.js environments without polyfills

## Installation

```bash
npm install ng-secure-fetch
```

## Quick Start

### 1. Import and Configure

**Option 1: Fetch Public Key from API**

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideNgSecureFetch } from 'ng-secure-fetch';
import { environment } from './environments/environment';

// In your app.config.ts (standalone) or app.module.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideNgSecureFetch({
      enableEncryption: true,
      publicKeyEndpoint: 'https://api.yourdomain.com/crypto/init',
      expectedPublicKeyHash: 'your-sha256-hash-here',
      publicKeyHeaderName: 'X-Client-Init',
      publicKeyFetchRetries: 3,
      aesKeyHeaderName: 'X-Request-Context',
      ivHeaderName: 'X-Client-Ref',
      enableDebugLogging: true,
      encryptDecryptForEndpoints: ['*'],
      skipEncryptDecryptForEndpoints: ['/public/*']
    })
  ]
};
```

**Option 2: Provide Public Key Directly (Skip API Call)**

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideNgSecureFetch({
      enableEncryption: true,
      publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`,
      aesKeyHeaderName: 'X-Request-Context',
      ivHeaderName: 'X-Client-Ref',
      enableDebugLogging: false,
      encryptDecryptForEndpoints: ['/insurance/*'],
      skipEncryptDecryptForEndpoints: ['/public/*']
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
  publicKeyEndpoint?: string;                  // API endpoint for public key (optional if publicKey provided)
  publicKey?: string;                          // Direct public key in PEM format (skips API call)
  expectedPublicKeyHash?: string;              // SHA-256 hash for MITM prevention (optional if publicKey provided)
  publicKeyHeaderName?: string;                // Custom public key header (default: 'X-Client-Init', optional if publicKey provided)
  publicKeyFetchRetries?: number;              // Retry attempts (default: 3, optional if publicKey provided)
  aesKeyHeaderName?: string;                   // Custom AES key header (default: 'X-Request-Context')
  ivHeaderName?: string;                       // Custom IV header (default: 'X-Client-Ref')
  enableDebugLogging?: boolean;                // Console logs (default: false)
  encryptDecryptForEndpoints?: string[];       // Endpoint patterns (default: ['*'])
  skipEncryptDecryptForEndpoints?: string[];   // Exclude patterns (higher priority)
}
```

### Key Configuration Properties

#### `enableEncryption` (default: `true`)
Master switch to enable/disable encryption globally.
- `true`: Encryption is active
- `false`: Bypass all encryption (app continues normally without encryption)

**⚠️ Important:** If `enableEncryption: true` and public key fetch fails, the app will NOT render. To bypass this, set `enableEncryption: false`.

#### Two Ways to Provide Public Key

**Method 1: Fetch from API (Dynamic)**
```typescript
provideNgSecureFetch({
  enableEncryption: true,
  publicKeyEndpoint: 'https://api.yourdomain.com/crypto/init',  // API endpoint to fetch public key
  expectedPublicKeyHash: 'abc123...',  // SHA-256 hash for MITM protection
  publicKeyHeaderName: 'X-Client-Init', // Response header containing public key
  publicKeyFetchRetries: 3              // Number of retry attempts on failure
  // ...rest of config
})
```

**Method 2: Provide Directly (Static)**
```typescript
provideNgSecureFetch({
  enableEncryption: true,
  publicKey: '-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----',
  // No need for: publicKeyEndpoint, expectedPublicKeyHash, publicKeyHeaderName, publicKeyFetchRetries
  // ...rest of config
})
```

**When to use each:**
- **API Method**: Production apps where keys may rotate, requires backend endpoint
- **Direct Method**: Development/testing, static keys, or when you don't have a `/crypto/init` endpoint

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

**If using `publicKey` (direct configuration):**
1. Import provided PEM key from config
2. Verify hash if `expectedPublicKeyHash` is provided
3. Continue app initialization (instant, no API call)

**If using `publicKeyEndpoint` (API fetch):**
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
  publicKeyEndpoint: 'https://api.yourdomain.com/crypto/init',
  expectedPublicKeyHash: 'your-sha256-hash-here',
  publicKeyHeaderName: 'X-Custom-Public-Key',  // Custom header name
  publicKeyFetchRetries: 3,
  aesKeyHeaderName: 'X-Request-Context',
  ivHeaderName: 'X-Client-Ref',
  enableDebugLogging: false,
  encryptDecryptForEndpoints: ['*'],
  skipEncryptDecryptForEndpoints: []
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
  publicKeyEndpoint: 'https://api.yourdomain.com/crypto/init',
  expectedPublicKeyHash: 'your-sha256-hash-here',
  publicKeyHeaderName: 'X-Custom-Public-Key',
  publicKeyFetchRetries: 3,
  aesKeyHeaderName: 'X-Custom-AES-Key',      // Custom AES key header
  ivHeaderName: 'X-Custom-IV',                // Custom IV header
  enableDebugLogging: false,
  encryptDecryptForEndpoints: ['*'],
  skipEncryptDecryptForEndpoints: []
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
| App won't load / white screen | Public key fetch failed. Check network tab for `/crypto/init`, verify endpoint reachable. To bypass encryption and render app, set `enableEncryption: false` |
| Hash mismatch | Check console for actual hash, update `expectedPublicKeyHash` |
| Header not found | Backend must add: `Access-Control-Expose-Headers: X-Client-Init` (or custom header name) |
| Custom header not found | Set `publicKeyHeaderName` in config and ensure backend sends that header |
| Custom AES/IV headers not found | Set `aesKeyHeaderName` and `ivHeaderName` in config; backend must send custom headers and expose them in CORS |
| Not encrypting | Check URL matches endpoint patterns, try `['*']` to test |
| Decryption fails | Verify backend sends AES key and IV headers (default: `X-Request-Context`, `X-Client-Ref` or your custom names) |
| Pattern not matching | Enable debug logging to see pattern matching details |
| Want to skip API call | Use `publicKey` property to provide public key directly in config |

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

### v1.1.1 (Current)
- RSA-2048-OAEP + AES-256-GCM hybrid encryption
- Browser environment only (Web Crypto API)
- Angular 16+ compatibility (requires Signals API)
- Automatic HTTP request/response encryption via interceptors
- SessionStorage caching for public key (95% faster page refresh)
- Public key pinning with SHA-256 hash verification
- Direct public key configuration option (skip API call with `publicKey` property)
- `skipEncryptDecryptForEndpoints` configuration (exclusion patterns with higher priority)
- Dynamic segment support with `{ignore}` placeholder in endpoint patterns
- Advanced pattern matching (glob patterns, exact match, dynamic segments)
- Error response decryption (4xx, 5xx status codes)
- Enhanced error structure with `Object.assign()` for backward compatibility
- Customizable header names (public key, AES key, IV)
- Debug logging for troubleshooting
- Improved CORS-aware error messages
- Zero dependencies (removed tslib)

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/prathameshv4/ng-secure-fetch/issues) page.
