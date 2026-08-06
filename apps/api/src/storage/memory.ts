import {
  DOWNLOAD_URL_TTL_MS,
  UPLOAD_URL_TTL_MS,
  type PresignedUpload,
  type StoragePort,
} from "./port.js";

/**
 * In-memory storage for tests.
 *
 * The reason the port exists: unit tests should not need a bucket, a network,
 * or a container to assert that a caller cannot sign an upload for someone
 * else's key.
 */
export function createMemoryStorage(): StoragePort & { objects: Map<string, string> } {
  const objects = new Map<string, string>();

  return {
    objects,

    async presignUpload(key, contentType): Promise<PresignedUpload> {
      objects.set(key, contentType);
      return {
        url: `memory://upload/${key}`,
        key,
        headers: { "Content-Type": contentType },
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_MS),
      };
    },

    async presignDownload(key): Promise<string> {
      return `memory://download/${key}?expires=${Date.now() + DOWNLOAD_URL_TTL_MS}`;
    },

    async delete(key): Promise<void> {
      objects.delete(key);
    },

    async exists(key): Promise<boolean> {
      return objects.has(key);
    },
  };
}
