import { Injectable } from '@angular/core';
import { MAX_DATABASE_BYTES } from '../core/domain/ports';

/**
 * The value is a real SQLite file. All read-modify-write operations run inside one
 * IndexedDB readwrite transaction, which serializes writers across browser tabs.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbStorage {
  private openPromise?: Promise<IDBDatabase>;
  private readonly channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nexo-sqlite-changes') : null;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.channel?.addEventListener('message', () => this.listeners.forEach((listener) => listener()));
  }

  onExternalChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private open(): Promise<IDBDatabase> {
    if (!this.openPromise) {
      this.openPromise = new Promise<IDBDatabase>((resolve, reject) => {
        let blocked = false;
        const request = indexedDB.open('nexo-informes', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('sqlite');
        request.onsuccess = () => {
          const db = request.result;
          if (blocked) { db.close(); return; }
          db.onversionchange = () => { db.close(); this.openPromise = undefined; };
          resolve(db);
        };
        request.onerror = () => reject(new Error('No se pudo abrir el almacenamiento del navegador. Revisa los permisos y el espacio disponible.'));
        request.onblocked = () => { blocked = true; reject(new Error('El almacenamiento está bloqueado por otra pestaña. Ciérrala y vuelve a intentar.')); };
      }).catch((error: unknown) => { this.openPromise = undefined; throw error; });
    }
    return this.openPromise;
  }

  async read(): Promise<Uint8Array | undefined> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('sqlite', 'readonly');
      const request = tx.objectStore('sqlite').get('main');
      request.onsuccess = () => resolve(request.result ? new Uint8Array(request.result as Uint8Array) : undefined);
      request.onerror = () => reject(new Error('No se pudo leer la base de datos local.'));
    });
  }

  async modify<T>(operation: (current: Uint8Array | undefined) => { bytes: Uint8Array; result: T }): Promise<T> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('sqlite', 'readwrite');
      const store = tx.objectStore('sqlite');
      const request = store.get('main');
      let outcome: T;
      let failure: unknown;
      request.onsuccess = () => {
        try {
          const current = request.result ? new Uint8Array(request.result as Uint8Array) : undefined;
          const updated = operation(current);
          if (updated.bytes.byteLength > MAX_DATABASE_BYTES) throw new Error('La base alcanzó el límite de 100 MB. Descarga una copia y libera espacio antes de continuar.');
          outcome = updated.result;
          store.put(updated.bytes, 'main');
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        this.channel?.postMessage('updated');
        resolve(outcome);
      };
      tx.onabort = () => reject(failure instanceof Error ? failure : new Error('No se pudieron guardar los cambios. Revisa el espacio disponible.'));
      tx.onerror = () => { /* onabort reports the error without claiming a successful save */ };
    });
  }
}
