import { EnvironmentProviders, makeEnvironmentProviders, APP_INITIALIZER } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { SecurityConfig, SECURITY_CONFIG } from '../models/ng-secure-fetch-config.interface';
import { encryptionInterceptor } from '../interceptors/encryption.interceptor';
import { decryptionInterceptor } from '../interceptors/decryption.interceptor';
import { initializeNgSecureFetchFactory } from '../initializers/ng-secure-fetch.initializer';

/**
 * Complete ng-secure-fetch provider: config + interceptors + APP_INITIALIZER
 * App blocks until public key is fetched and verified
 * 
 * @example
 * // Option 1: Fetch public key from API
 * provideNgSecureFetch({
 *   enableEncryption: true,
 *   publicKeyEndpoint: environment.baseApiUrl + '/crypto/init',
 *   expectedPublicKeyHash: 'your-sha256-hash-here',
 *   publicKeyHeaderName: 'X-Client-Init',
 *   publicKeyFetchRetries: 3,
 *   aesKeyHeaderName: 'X-Request-Context',
 *   ivHeaderName: 'X-Client-Ref',
 *   enableDebugLogging: false,
 *   encryptDecryptForEndpoints: ['/insurance/*'],
 *   skipEncryptDecryptForEndpoints: ['/public/*']
 * })
 * 
 * @example
 * // Option 2: Provide public key directly (skips API call)
 * provideNgSecureFetch({
 *   enableEncryption: true,
 *   publicKey: '-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----',
 *   aesKeyHeaderName: 'X-Request-Context',
 *   ivHeaderName: 'X-Client-Ref',
 *   enableDebugLogging: false,
 *   encryptDecryptForEndpoints: ['/insurance/*'],
 *   skipEncryptDecryptForEndpoints: ['/public/*']
 * })
 */
export function provideNgSecureFetch(config: SecurityConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SECURITY_CONFIG, useValue: config },
    provideHttpClient(withInterceptors([encryptionInterceptor, decryptionInterceptor])),
    { provide: APP_INITIALIZER, useFactory: initializeNgSecureFetchFactory, multi: true }
  ]);
}
