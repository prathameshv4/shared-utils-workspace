import { InjectionToken } from '@angular/core';

/** Default header name for public key exchange */
export const DEFAULT_PUBLIC_KEY_HEADER_NAME = 'X-Client-Init';

/** Default header name for AES key in request/response */
export const DEFAULT_AES_KEY_HEADER_NAME = 'X-Request-Context';

/** Default header name for IV in request/response */
export const DEFAULT_IV_HEADER_NAME = 'X-Client-Ref';

/** Security library configuration */
export interface SecurityConfig {
  /** Master switch: true = fetch key + encrypt/decrypt, false = bypass all (default: true) */
  enableEncryption?: boolean;

  /** Full public key endpoint URL (required if enableEncryption is true and publicKey is not provided) */
  publicKeyEndpoint?: string;

  /** Direct public key in PEM format (if provided, skips API call to publicKeyEndpoint) */
  publicKey?: string;

  /** Expected SHA-256 hash for public key pinning (MITM protection) - optional if publicKey is provided directly */
  expectedPublicKeyHash?: string;

  /** Endpoint patterns to encrypt: ['*'] = all, ['/api/*'] = glob, ['/exact/path'] = exact (default: ['*']) */
  encryptDecryptForEndpoints?: string[];

  /** Endpoint patterns to skip encryption (higher priority than encryptDecryptForEndpoints) */
  skipEncryptDecryptForEndpoints?: string[];

  /** Custom header name for public key exchange (default: 'X-Client-Init') - optional if publicKey is provided directly */
  publicKeyHeaderName?: string;

  /** Custom header name for AES key in request/response (default: 'X-Request-Context') */
  aesKeyHeaderName?: string;

  /** Custom header name for IV in request/response (default: 'X-Client-Ref') */
  ivHeaderName?: string;

  /** Enable debug logging (default: true) */
  enableDebugLogging?: boolean;

  /** Retry attempts for public key fetch (default: 3) - optional if publicKey is provided directly */
  publicKeyFetchRetries?: number;
}

/** Injection token for security config */
export const SECURITY_CONFIG = new InjectionToken<SecurityConfig>('SecurityConfig');

/** Default configuration with placeholder values - replace with your actual values */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  publicKeyEndpoint: 'https://your-api-domain.com/crypto/init',
  expectedPublicKeyHash: 'your-sha256-hash-replace-this-with-actual-hash-from-console',
  encryptDecryptForEndpoints: ['*'],
  skipEncryptDecryptForEndpoints: [],
  publicKeyHeaderName: DEFAULT_PUBLIC_KEY_HEADER_NAME,
  aesKeyHeaderName: DEFAULT_AES_KEY_HEADER_NAME,
  ivHeaderName: DEFAULT_IV_HEADER_NAME,
  enableDebugLogging: false,
  enableEncryption: true,
  publicKeyFetchRetries: 3
};
