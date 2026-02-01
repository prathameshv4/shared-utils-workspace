# ng-secure-fetch Workspace

This is the development workspace for **ng-secure-fetch** - a zero-dependency Angular library providing RSA-2048-OAEP + AES-256-GCM hybrid encryption with automatic HTTP request/response encryption.

## About ng-secure-fetch

ng-secure-fetch is a browser-only Angular library (16+) that uses the Web Crypto API to provide transparent encryption/decryption for HTTP requests and responses.

**Key Features:**
- Hybrid encryption: RSA-2048-OAEP + AES-256-GCM
- Automatic HTTP interceptors
- SessionStorage caching (95% faster page refresh)
- Public key pinning (SHA-256 hash verification)
- Advanced pattern matching with dynamic segments
- Zero dependencies

For complete documentation, see: [`projects/ng-secure-fetch/README.md`](./projects/ng-secure-fetch/README.md)

## Building the Library

To build the ng-secure-fetch library:

```bash
ng build ng-secure-fetch
```

Build artifacts will be stored in the `dist/ng-secure-fetch/` directory.

## Running Tests

To execute the library unit tests:

```bash
ng test ng-secure-fetch
```

## Publishing to npm

### Publish Steps

# Example workflow

1. Build the library:
```bash
ng build ng-secure-fetch
```
2. Copy .npmrc file to the dist/ng-secure-fetch/ folder:
```bash
cp .npmrc dist/ng-secure-fetch/
```

2. Navigate to the dist folder:
```bash
cd dist/ng-secure-fetch
```

3. Publish to npm:
```bash
npm publish --access public
```

**Note:** The `.npmrc` file contains your npm token and is excluded from git for security.

## Development

This workspace is configured for Angular library development using Angular CLI version 20.3.3.

### Project Structure

```
shared-utils-workspace/
├── projects/
│   └── ng-secure-fetch/           # Library source code
│       ├── src/
│       │   ├── lib/
│       │   │   ├── config/
│       │   │   ├── initializers/
│       │   │   ├── interceptors/
│       │   │   ├── models/
│       │   │   └── services/
│       │   └── public-api.ts
│       ├── package.json
│       └── README.md
└── dist/
    └── ng-secure-fetch/           # Build output
```

## Additional Resources

- [ng-secure-fetch Documentation](./projects/ng-secure-fetch/README.md)
- [Angular CLI Documentation](https://angular.dev/tools/cli)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
