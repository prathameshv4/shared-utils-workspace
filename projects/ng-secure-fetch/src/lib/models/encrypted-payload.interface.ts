/**
 * Encrypted payload structure for hybrid encryption
 */
export interface EncryptedPayload {
  /**
   * AES-GCM encrypted data (Base64 encoded)
   */
  encryptedData: string;

  /**
   * RSA-OAEP encrypted AES key (Base64 encoded)
   */
  encryptedAesKey: string;

  /**
   * RSA-OAEP encrypted IV (Base64 encoded)
   */
  iv: string;
}

/**
 * Obfuscated encrypted envelope with short field names
 */
export interface EncryptedEnvelope {
  d: string; // encryptedData
  k: string; // encryptedAesKey
  s: string; // iv (salt)
}
