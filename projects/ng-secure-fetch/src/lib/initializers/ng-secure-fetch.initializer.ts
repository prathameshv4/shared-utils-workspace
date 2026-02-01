import { inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError, retry, catchError, switchMap, map, timer, Subscriber } from 'rxjs';
import { CryptoService } from '../services/crypto.service';
import { SECURITY_CONFIG, SecurityConfig, DEFAULT_PUBLIC_KEY_HEADER_NAME } from '../models/ng-secure-fetch-config.interface';

/** APP_INITIALIZER: Fetches public key, verifies hash, blocks app until ready */
export function initializeNgSecureFetchFactory(): () => Observable<void> {
  const http = inject(HttpClient);
  const cryptoService = inject(CryptoService);
  const config = inject(SECURITY_CONFIG);

  return () => {
    if (config.enableEncryption === false) {
      config.enableDebugLogging && console.log('[ng-secure-fetch] Encryption disabled');
      return of(void 0);
    }

    // If public key is provided directly in config, use it
    if (config.publicKey) {
      config.enableDebugLogging && console.log('[ng-secure-fetch] Using public key from config');
      
      return new Observable<void>((subscriber: Subscriber<void>) => {
        validateAndSetPublicKey(cryptoService, config, config.publicKey!).then(() => {
          config.enableDebugLogging && console.log('[ng-secure-fetch] Public key from config validated and imported');
          subscriber.next();
          subscriber.complete();
        }).catch(err => {
          console.error('[ng-secure-fetch] Failed to import public key from config:', err);
          subscriber.error(err);
        });
      });
    }

    if (!config.publicKeyEndpoint) {
      console.error('[ng-secure-fetch] publicKeyEndpoint or publicKey required');
      return throwError(() => new Error('publicKeyEndpoint or publicKey required'));
    }

    // Check for cached public key in sessionStorage first
    return new Observable<void>((subscriber: Subscriber<void>) => {
      const cachedPemKey = cryptoService.getCachedPemKey();
      
      if (cachedPemKey) {
        config.enableDebugLogging && console.log('[ng-secure-fetch] Using cached key');
        
        validateAndSetPublicKey(cryptoService, config, cachedPemKey).then(() => {
          config.enableDebugLogging && console.log('[ng-secure-fetch] Cached key validated');
          subscriber.next();
          subscriber.complete();
        }).catch(err => {
          config.enableDebugLogging && console.warn('[ng-secure-fetch] Cache invalid, fetching fresh key');
          cryptoService.clearCachedPublicKey();
          
          fetchPublicKeyFromAPI(http, cryptoService, config).subscribe({
            next: () => {
              subscriber.next();
              subscriber.complete();
            },
            error: (err: any) => subscriber.error(err)
          });
        });
      } else {
        config.enableDebugLogging && console.log('[ng-secure-fetch] Fetching public key from API');
        
        fetchPublicKeyFromAPI(http, cryptoService, config).subscribe({
          next: () => {
            subscriber.next();
            subscriber.complete();
          },
          error: (err: any) => subscriber.error(err)
        });
      }
    });
  };
}

/** Validate PEM key hash and import it (reusable for both cached and API keys) */
async function validateAndSetPublicKey(
  cryptoService: CryptoService,
  config: SecurityConfig,
  pemKey: string
): Promise<void> {
  const isValid = await cryptoService.verifyPublicKeyHash(pemKey);
  if (!isValid) {
    throw new Error('Public key hash mismatch - possible MITM attack');
  }
  
  const cryptoKey = await cryptoService.importPublicKey(pemKey);
  cryptoService.setPublicKey(cryptoKey, pemKey);
  config.enableDebugLogging && console.log('[ng-secure-fetch] Public key imported & validated');
}

/** Helper function to fetch public key from API */
function fetchPublicKeyFromAPI(http: HttpClient, cryptoService: CryptoService, config: SecurityConfig): Observable<void> {
  const retries = config.publicKeyFetchRetries || 3;

  return http.get<void>(config.publicKeyEndpoint!, { observe: 'response' }).pipe(
    retry({
      count: retries,
      delay: (_error: any, retryCount: number) => {
        config.enableDebugLogging && console.warn(`[ng-secure-fetch] Retry ${retryCount}/${retries}`);
        return timer(Math.pow(2, retryCount - 1) * 1000);
      }
    }),

    switchMap((response: HttpResponse<void>) => {
      const headerName = config.publicKeyHeaderName || DEFAULT_PUBLIC_KEY_HEADER_NAME;
      const pemKey = response.headers.get(headerName) || response.headers.get(headerName.toLowerCase());
      
      if (!pemKey) {
        const availableHeaders = response.headers.keys().join(', ');
        console.error(`[ng-secure-fetch] ${headerName} header missing. Available: ${availableHeaders}`);
        throw new Error(`${headerName} header not found. Set Access-Control-Expose-Headers`);
      }
      
      config.enableDebugLogging && console.log(`[ng-secure-fetch] Public key received from ${headerName}`);
      return validateAndSetPublicKey(cryptoService, config, pemKey);
    }),

    map(() => {
      config.enableDebugLogging && console.log('[ng-secure-fetch] Initialized - encryption ready');
      return void 0;
    }),

    catchError((error: any) => {
      console.error('[ng-secure-fetch] Initialization failed. App will not render until this is resolved.');
      console.error('[ng-secure-fetch] To bypass encryption, set enableEncryption: false');
      return throwError(() => error);
    })
  );
}
