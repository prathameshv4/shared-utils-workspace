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
 * provideNgSecureFetch({
 *   enableEncryption: true,
 *   publicKeyEndpoint: environment.apiUrl + '/crypto/init',
 *   expectedPublicKeyHash: 'your-sha256-hash-here',
 *   encryptDecryptForEndpoints: ['/insurance/*'],
 *   skipEncryptDecryptForEndpoints: ['/public/*'],
 *   publicKeyHeaderName: 'X-Client-Init',
 *   aesKeyHeaderName: 'X-Request-Context',
 *   ivHeaderName: 'X-Client-Ref',
 *   enableDebugLogging: false,
 *   publicKeyFetchRetries: 3
 * })
 */
export function provideNgSecureFetch(config: SecurityConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SECURITY_CONFIG, useValue: config },
    provideHttpClient(withInterceptors([encryptionInterceptor, decryptionInterceptor])),
    { provide: APP_INITIALIZER, useFactory: initializeNgSecureFetchFactory, multi: true }
  ]);
}
