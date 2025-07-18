/**
 * Secure storage solution using IndexedDB with encryption
 * Replaces localStorage for sensitive A/B testing data
 */

import { v4 as uuidv4 } from 'uuid';

interface StorageItem {
  id: string;
  key: string;
  value: string;
  timestamp: number;
  encrypted: boolean;
}

export class SecureStorage {
  private dbName = 'spheroseg_secure_storage';
  private storeName = 'encrypted_data';
  private db: IDBDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;

  async initialize(): Promise<void> {
    // Initialize encryption key from server or generate one
    this.encryptionKey = await this.getOrCreateEncryptionKey();

    // Open IndexedDB
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('key', 'key', { unique: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async getOrCreateEncryptionKey(): Promise<CryptoKey> {
    // In production, this should be derived from user session or server
    const keyMaterial = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt'],
    );

    return keyMaterial;
  }

  private async encrypt(data: string): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      this.encryptionKey,
      encoder.encode(data),
    );

    return { encrypted, iv };
  }

  private async decrypt(encrypted: ArrayBuffer, iv: Uint8Array): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      this.encryptionKey,
      encrypted,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  async setItem(key: string, value: any): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const stringValue = JSON.stringify(value);
    const { encrypted, iv } = await this.encrypt(stringValue);

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64 for storage
    const base64 = btoa(String.fromCharCode(...combined));

    const item: StorageItem = {
      id: uuidv4(),
      key,
      value: base64,
      timestamp: Date.now(),
      encrypted: true,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // First, delete any existing item with the same key
      const index = store.index('key');
      const deleteRequest = index.openCursor(IDBKeyRange.only(key));

      deleteRequest.onsuccess = () => {
        const cursor = deleteRequest.result;
        if (cursor) {
          cursor.delete();
        }

        // Then add the new item
        const addRequest = store.add(item);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      };
    });
  }

  async getItem(key: string): Promise<any | null> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('key');
      const request = index.get(key);

      request.onsuccess = async () => {
        const item = request.result as StorageItem | undefined;
        if (!item) {
          resolve(null);
          return;
        }

        try {
          // Decode base64
          const combined = Uint8Array.from(atob(item.value), (c) => c.charCodeAt(0));

          // Extract IV and encrypted data
          const iv = combined.slice(0, 12);
          const encrypted = combined.slice(12);

          // Decrypt
          const decrypted = await this.decrypt(encrypted.buffer, iv);
          resolve(JSON.parse(decrypted));
        } catch (error) {
          console.error('Failed to decrypt item:', error);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async removeItem(key: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('key');
      const request = index.openCursor(IDBKeyRange.only(key));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
        }
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clean up old entries (older than 30 days)
  async cleanup(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(IDBKeyRange.upperBound(thirtyDaysAgo));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let secureStorageInstance: SecureStorage | null = null;

export function getSecureStorage(): SecureStorage {
  if (!secureStorageInstance) {
    secureStorageInstance = new SecureStorage();
  }
  return secureStorageInstance;
}

// Migration utility from localStorage to secure storage
export async function migrateFromLocalStorage(keys: string[]): Promise<void> {
  const secureStorage = getSecureStorage();
  await secureStorage.initialize();

  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        const parsed = JSON.parse(value);
        await secureStorage.setItem(key, parsed);
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to migrate key ${key}:`, error);
      }
    }
  }
}
