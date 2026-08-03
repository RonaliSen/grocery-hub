import { inject, Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly storage = inject(Storage);
  private storageReady: Promise<Storage> | null = null;

  initialize(): Promise<Storage> {
    if (!this.storageReady) {
      this.storageReady = this.storage.create();
    }

    return this.storageReady;
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    const instance = await this.initialize();
    const value = await instance.get(key);
    return (value ?? fallback) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const instance = await this.initialize();
    await instance.set(key, value);
  }

  async clear(): Promise<void> {
    const instance = await this.initialize();
    await instance.clear();
  }
}
