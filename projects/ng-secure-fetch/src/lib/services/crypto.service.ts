import { Injectable, signal, inject } from '@angular/core';
import { SECURITY_CONFIG } from '../models/ng-secure-fetch-config.interface';
import { EncryptedPayload } from '../models/encrypted-payload.interface';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private readonly config = inject(SECURITY_CONFIG);
  private readonly publicKey = signal<CryptoKey | null>(null);
  private readonly STORAGE_KEY = 'ng_secure_fetch_public_key_pem';

  /** 
   * Pattern matcher with support for dynamic segments:
   * - '*' = matches all URLs
   * - '/api/*' = matches URLs containing '/api/'
   * - '/exact/path' = exact substring match
   * - '/path/{ignore}/resource' = matches with dynamic segment (e.g., '/path/anything/resource')
   * - Multiple {ignore} placeholders supported: '/api/{ignore}/items/{ignore}/details'
   * 
   * @param url - The URL to check
   * @param patterns - Array of patterns to match against
   * @param skipPatterns - Optional array of patterns to exclude (higher priority)
   * @returns true if URL matches patterns and doesn't match skipPatterns
   */
  matchesPattern(url: string, patterns: string[], skipPatterns?: string[]): boolean {
    // Check skip patterns first (higher priority)
    if (skipPatterns && skipPatterns.length > 0) {
      const shouldSkip = skipPatterns.some(pattern => {
        if (pattern === '*') return true;
        
        if (pattern.endsWith('/*')) {
          return url.includes(pattern.slice(0, -2));
        }
        
        if (pattern.includes('{ignore}')) {
          let regexPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\{ignore\\}/g, '[^/]+');
          const regex = new RegExp(regexPattern);
          return regex.test(url);
        }
        
        return url.includes(pattern);
      });
      
      if (shouldSkip) {
        this.config.enableDebugLogging && console.log(`[ng-secure-fetch] Skipped ${url}`);
        return false;
      }
    }
    
    // Check if URL matches any include pattern
    return patterns.some(pattern => {
      // Match all
      if (pattern === '*') return true;
      
      // Glob pattern (e.g., '/api/*')
      if (pattern.endsWith('/*')) {
        return url.includes(pattern.slice(0, -2));
      }
      
      // Pattern with {ignore} placeholders for dynamic segments
      if (pattern.includes('{ignore}')) {
        // Convert pattern to regex:
        // 'v1/universal/business/applicationform/{ignore}/pocketInsurance'
        // becomes: v1\/universal\/business\/applicationform\/[^\/]+\/pocketInsurance
        
        // Escape special regex characters except {ignore}
        let regexPattern = pattern
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
          .replace(/\\{ignore\\}/g, '[^/]+');       // Replace {ignore} with pattern to match any non-slash chars
        
        // Create regex that checks if the pattern exists anywhere in the URL
        const regex = new RegExp(regexPattern);
        
        if (this.config.enableDebugLogging) {
          console.log(`[ng-secure-fetch] Pattern "${pattern}" ${regex.test(url) ? 'matched' : 'failed'} for ${url}`);
        }
        
        return regex.test(url);
      }
      
      // Exact substring match
      return url.includes(pattern);
    });
  }

  /** Verify public key hash (SHA-256) to prevent MITM attacks */
  async verifyPublicKeyHash(pemKey: string): Promise<boolean> {
    const expectedHash = this.config.expectedPublicKeyHash || 'REPLACE_WITH_YOUR_PUBLIC_KEY_HASH';

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pemKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      this.config.enableDebugLogging && console.log(`[ng-secure-fetch] Public key hash: ${hashHex}`);
      
      if (expectedHash === 'REPLACE_WITH_YOUR_PUBLIC_KEY_HASH') {
        console.warn(`[ng-secure-fetch] Public key pinning not configured! Use hash: ${hashHex}`);
        return false;
      }
      
      const matches = hashHex === expectedHash;
      
      if (!matches) {
        console.error(`[ng-secure-fetch] Hash mismatch! Expected: ${expectedHash.substring(0, 16)}..., Got: ${hashHex.substring(0, 16)}...`);
      } else {
        this.config.enableDebugLogging && console.log('[ng-secure-fetch] Public key hash verified');
      }
      
      return matches;
    } catch (error) {
      console.error('[ng-secure-fetch] Hash verification error:', error);
      return false;
    }
  }

  /** Set RSA public key for encryption and cache in sessionStorage */
  setPublicKey(key: CryptoKey, pemKey?: string): void {
    this.publicKey.set(key);
    
    if (pemKey) {
      try {
        sessionStorage.setItem(this.STORAGE_KEY, pemKey);
        this.config.enableDebugLogging && console.log('[ng-secure-fetch] Public key cached');
      } catch (error) {
        console.warn('[ng-secure-fetch] Cache storage failed:', error);
      }
    }
  }

  /** Get current RSA public key */
  getPublicKey(): CryptoKey | null {
    return this.publicKey();
  }

  /** Get cached PEM key from sessionStorage */
  getCachedPemKey(): string | null {
    try {
      return sessionStorage.getItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('[ng-secure-fetch] Cache read failed:', error);
      return null;
    }
  }

  /** Clear cached public key from sessionStorage */
  clearCachedPublicKey(): void {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
      this.config.enableDebugLogging && console.log('[ng-secure-fetch] Cache cleared');
    } catch (error) {
      console.warn('[ng-secure-fetch] Cache clear failed:', error);
    }
  }

  /** Generate random AES-256-GCM key */
  private async generateAESKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /** Import AES key from raw bytes (one-time use from response header) */
  private async importAESKey(keyBytes: ArrayBuffer): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  /** Generate random 12-byte IV for AES-GCM */
  private generateIV(): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(12));
  }

  /** Generate random string for padding and obfuscation */
  private generateRandomString(minLength: number, maxLength: number): string {
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(length));
    return this.arrayBufferToBase64(randomBytes.buffer);
  }

  /** Encrypt data using AES-GCM */
  private async encryptWithAES(data: string, aesKey: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    return await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, aesKey, dataBuffer);
  }

  /** Encrypt AES key with RSA-OAEP public key */
  private async encryptAESKeyWithRSA(aesKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<ArrayBuffer> {
    const aesKeyBuffer = await window.crypto.subtle.exportKey('raw', aesKey);
    return await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, aesKeyBuffer);
  }

  /** Encrypt IV with RSA-OAEP public key */
  private async encryptIVWithRSA(iv: Uint8Array, rsaPublicKey: CryptoKey): Promise<ArrayBuffer> {
    return await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, iv as BufferSource);
  }

  /** Convert ArrayBuffer to Base64 */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /** Convert Base64 to ArrayBuffer */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /** Encrypt payload with AES-GCM + variable padding + RSA-encrypted keys */
  async encryptPayload(payload: Record<string, unknown>): Promise<EncryptedPayload | null> {
    const rsaPublicKey = this.getPublicKey();
    if (!rsaPublicKey) return null;

    const aesKey = await this.generateAESKey();
    const iv = this.generateIV();
    const payloadString = JSON.stringify(payload);
    const padding = this.generateRandomString(16, 256);
    const paddedData = `${payloadString}||${padding}`;

    const [encryptedData, encryptedAesKey, encryptedIV] = await Promise.all([
      this.encryptWithAES(paddedData, aesKey, iv),
      this.encryptAESKeyWithRSA(aesKey, rsaPublicKey),
      this.encryptIVWithRSA(iv, rsaPublicKey)
    ]);

    return {
      encryptedData: this.arrayBufferToBase64(encryptedData),
      encryptedAesKey: this.arrayBufferToBase64(encryptedAesKey),
      iv: this.arrayBufferToBase64(encryptedIV)
    };
  }

  /** Generate RSA-encrypted AES key and IV for GET requests (backend decrypts, uses for response) */
  async generateEncryptedHeaders(): Promise<{ encryptedAesKey: string; encryptedIV: string } | null> {
    const rsaPublicKey = this.getPublicKey();
    if (!rsaPublicKey) return null;

    const aesKey = await this.generateAESKey();
    const iv = this.generateIV();

    const [encryptedAesKey, encryptedIV] = await Promise.all([
      this.encryptAESKeyWithRSA(aesKey, rsaPublicKey),
      this.encryptIVWithRSA(iv, rsaPublicKey)
    ]);

    const result = {
      encryptedAesKey: this.arrayBufferToBase64(encryptedAesKey),
      encryptedIV: this.arrayBufferToBase64(encryptedIV)
    }

    this.config.enableDebugLogging && console.log('[ng-secure-fetch] Generated encrypted headers');

    return result;
  }

  /** Create obfuscated envelope with short field names (d=data, k=key, s=salt/IV) */
  async createEncryptedEnvelope(originalPayload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const encryptedPayload = await this.encryptPayload(originalPayload);
    if (!encryptedPayload) return originalPayload;

    return {
      d: encryptedPayload.encryptedData,
      k: encryptedPayload.encryptedAesKey,
      s: encryptedPayload.iv
    };
  }

  /** Decrypt response using raw AES key and IV from headers (sent over HTTPS) */
  async decryptResponsePayload(
    encryptedData: string,
    aesKeyBase64: string,
    ivBase64: string
  ): Promise<Record<string, unknown> | null> {
    const encryptedBytes = this.base64ToArrayBuffer(encryptedData);
    const aesKeyBytes = this.base64ToArrayBuffer(aesKeyBase64);
    const ivBytes = this.base64ToArrayBuffer(ivBase64);
    const aesKey = await this.importAESKey(aesKeyBytes);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      aesKey,
      encryptedBytes
    );

    const decoder = new TextDecoder();
    const decryptedWithPadding = decoder.decode(decryptedBuffer);
    const [actualData] = decryptedWithPadding.split('||');

    this.config.enableDebugLogging && console.log('[ng-secure-fetch] Response decrypted');

    return JSON.parse(actualData);
  }

  /** Import RSA public key from PEM format to CryptoKey */
  async importPublicKey(pemKey: string): Promise<CryptoKey> {
    const pemHeader = '-----BEGIN PUBLIC KEY-----';
    const pemFooter = '-----END PUBLIC KEY-----';
    const pemContents = pemKey.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
    
    this.config.enableDebugLogging && console.log('[ng-secure-fetch] Importing PEM key');
    
    const binaryDer = atob(pemContents);
    const binaryDerArray = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      binaryDerArray[i] = binaryDer.charCodeAt(i);
    }

    const cryptoKey = await window.crypto.subtle.importKey(
      'spki',
      binaryDerArray.buffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['encrypt']
    );

    this.config.enableDebugLogging && console.log('[ng-secure-fetch] Key imported successfully');

    return cryptoKey;
  }
}
