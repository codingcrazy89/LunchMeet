import { env } from "../env.js";
import { createGcsStorage } from "./gcs.js";
import { createMemoryStorage } from "./memory.js";
import type { StoragePort } from "./port.js";

let instance: StoragePort | undefined;

export function storage(): StoragePort {
  if (!instance) {
    instance = env.NODE_ENV === "test" ? createMemoryStorage() : createGcsStorage();
  }
  return instance;
}

/** Lets tests substitute the in-memory implementation. */
export function setStorage(port: StoragePort): void {
  instance = port;
}

export * from "./port.js";
export { createMemoryStorage } from "./memory.js";
