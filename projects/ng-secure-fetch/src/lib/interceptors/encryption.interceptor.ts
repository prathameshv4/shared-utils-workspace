import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { CryptoService } from '../services/crypto.service';
import { SECURITY_CONFIG, SecurityConfig, DEFAULT_AES_KEY_HEADER_NAME, DEFAULT_IV_HEADER_NAME } from '../models/ng-secure-fetch-config.interface';

/** Encrypts requests: POST/PUT/PATCH body + headers, GET generates keys for response encryption */
export const encryptionInterceptor: HttpInterceptorFn = (req, next) => {
  const cryptoService = inject(CryptoService);
  const config = inject(SECURITY_CONFIG, { optional: true }) as SecurityConfig | null;

  if (config?.enableEncryption === false) return next(req);

  const encryptPatterns = config?.encryptDecryptForEndpoints || ['*'];
  const skipPatterns = config?.skipEncryptDecryptForEndpoints;
  const shouldEncrypt = cryptoService.matchesPattern(req.url, encryptPatterns, skipPatterns);

  if (!shouldEncrypt) return next(req);
  if (config?.publicKeyEndpoint && req.url === config.publicKeyEndpoint) return next(req);

  const aesKeyHeader = config?.aesKeyHeaderName || DEFAULT_AES_KEY_HEADER_NAME;
  const ivHeader = config?.ivHeaderName || DEFAULT_IV_HEADER_NAME;

  if (req.method === 'GET') {
    return from(cryptoService.generateEncryptedHeaders()).pipe(
      switchMap((headers: { encryptedAesKey: string; encryptedIV: string } | null) => {
        if (!headers) return next(req);
        const encryptedReq = req.clone({
          setHeaders: {
            [aesKeyHeader]: headers.encryptedAesKey,
            [ivHeader]: headers.encryptedIV
          }
        });
        return next(encryptedReq);
      })
    );
  }

  if (!req.body || typeof req.body !== 'object') return next(req);
  if (req.method === 'DELETE' || req.method === 'HEAD' || req.method === 'OPTIONS') return next(req);

  config?.enableDebugLogging && console.log(`[ng-secure-fetch] Encrypting ${req.method} request`);

  return from(cryptoService.createEncryptedEnvelope(req.body as Record<string, unknown>)).pipe(
    switchMap((encryptedBody: Record<string, unknown>) => {
      const envelope = encryptedBody as Record<string, unknown>;
      const encryptedReq = req.clone({
        body: envelope['d'],
        setHeaders: {
          'Content-Type': 'text/plain',
          [aesKeyHeader]: envelope['k'] as string,
          [ivHeader]: envelope['s'] as string
        }
      });
      return next(encryptedReq);
    })
  );
};
