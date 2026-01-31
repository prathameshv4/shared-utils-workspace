import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, of, throwError, catchError } from 'rxjs';
import { CryptoService } from '../services/crypto.service';
import { SECURITY_CONFIG, SecurityConfig, DEFAULT_AES_KEY_HEADER_NAME, DEFAULT_IV_HEADER_NAME } from '../models/ng-secure-fetch-config.interface';

/** Decrypts responses using AES keys from headers (X-Request-Context, X-Client-Ref) */
export const decryptionInterceptor: HttpInterceptorFn = (req, next) => {
  const cryptoService = inject(CryptoService);
  const config = inject(SECURITY_CONFIG, { optional: true }) as SecurityConfig | null;

  return next(req).pipe(
    switchMap((event: any) => {
      if (!(event instanceof HttpResponse)) return of(event);
      if (config?.enableEncryption === false) return of(event);

      const encryptPatterns = config?.encryptDecryptForEndpoints || ['*'];
      const skipPatterns = config?.skipEncryptDecryptForEndpoints;
      const shouldDecrypt = cryptoService.matchesPattern(req.url, encryptPatterns, skipPatterns);

      if (!shouldDecrypt) return of(event);
      if (config?.publicKeyEndpoint && req.url === config.publicKeyEndpoint) return of(event);

      return decryptResponse(event, cryptoService, config);
    }),
    catchError((error: HttpErrorResponse) => {
      // Handle error responses (4xx, 5xx)
      if (config?.enableEncryption === false) return throwError(() => error);

      const encryptPatterns = config?.encryptDecryptForEndpoints || ['*'];
      const skipPatterns = config?.skipEncryptDecryptForEndpoints;
      const shouldDecrypt = cryptoService.matchesPattern(req.url, encryptPatterns, skipPatterns);

      if (!shouldDecrypt) return throwError(() => error);
      if (config?.publicKeyEndpoint && req.url === config.publicKeyEndpoint) return throwError(() => error);

      const aesKeyHeader = config?.aesKeyHeaderName || DEFAULT_AES_KEY_HEADER_NAME;
      const ivHeader = config?.ivHeaderName || DEFAULT_IV_HEADER_NAME;

      config?.enableDebugLogging && console.log('[ng-secure-fetch] Error response received, attempting decryption');

      // Check if error has encryption headers
      const aesKeyBase64 = error.headers?.get(aesKeyHeader) || error.headers?.get(aesKeyHeader.toLowerCase());
      const ivBase64 = error.headers?.get(ivHeader) || error.headers?.get(ivHeader.toLowerCase());

      if (!aesKeyBase64 || !ivBase64 || !error.error) {
        config?.enableDebugLogging && console.warn('[ng-secure-fetch] Error response not encrypted');
        return throwError(() => error);
      }

      // Decrypt error response
      return from(
        cryptoService.decryptResponsePayload(
          typeof error.error === 'string' ? error.error : JSON.stringify(error.error),
          aesKeyBase64,
          ivBase64
        ).then(
          (decrypted: Record<string, unknown> | null) => {
            if (decrypted) {
              config?.enableDebugLogging && console.log('[ng-secure-fetch] Error response decrypted');
              
              // Return decrypted error - spread decrypted data to top level for easier access
              // This allows components to access error.errors[0] instead of error.error.errors[0]
              const decryptedError = new HttpErrorResponse({
                error: decrypted,
                headers: error.headers,
                status: error.status,
                statusText: error.statusText,
                url: error.url || undefined
              });
              
              // Merge decrypted properties to top level of error object
              Object.assign(decryptedError, decrypted);
              
              throw decryptedError;
            }
            config?.enableDebugLogging && console.warn('[ng-secure-fetch] Error decryption returned null');
            throw error;
          },
          (decryptError: any) => {
            config?.enableDebugLogging && console.error('[ng-secure-fetch] Failed to decrypt error response:', decryptError);
            throw error;
          }
        )
      );
    })
  );
};

/** Helper function to decrypt successful responses */
function decryptResponse(
  event: HttpResponse<any>,
  cryptoService: CryptoService,
  config: SecurityConfig | null
) {
  const aesKeyHeader = config?.aesKeyHeaderName || DEFAULT_AES_KEY_HEADER_NAME;
  const ivHeader = config?.ivHeaderName || DEFAULT_IV_HEADER_NAME;

  const aesKeyBase64 = event.headers.get(aesKeyHeader) || event.headers.get(aesKeyHeader.toLowerCase());
  const ivBase64 = event.headers.get(ivHeader) || event.headers.get(ivHeader.toLowerCase());

  if (!aesKeyBase64 || !ivBase64 || !event.body) {
    config?.enableDebugLogging && event.body && console.warn('[ng-secure-fetch] Missing encryption headers');
    return of(event);
  }

  config?.enableDebugLogging && console.log('[ng-secure-fetch] Decrypting response');

  return from(
    cryptoService.decryptResponsePayload(event.body as string, aesKeyBase64, ivBase64)
  ).pipe(
    switchMap((decrypted: Record<string, unknown> | null) => {
      if (decrypted) {
        config?.enableDebugLogging && console.log('[ng-secure-fetch] Response decrypted successfully');
        return of(event.clone({ body: decrypted }));
      }
      config?.enableDebugLogging && console.warn('[ng-secure-fetch] Decryption returned null');
      return of(event);
    })
  );
}
