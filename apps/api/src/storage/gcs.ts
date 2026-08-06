import { Storage } from "@google-cloud/storage";
import { env } from "../env.js";
import {
  DOWNLOAD_URL_TTL_MS,
  UPLOAD_URL_TTL_MS,
  type PresignedUpload,
  type StoragePort,
} from "./port.js";

/**
 * Google Cloud Storage adapter.
 *
 * Credentials resolve through Application Default Credentials, so on Cloud Run
 * or GKE a service account attached to the workload is enough and no key file
 * is needed. A downloaded JSON key is a long-lived credential that cannot be
 * rotated without a redeploy, so it is only used when running off GCP.
 */
export function createGcsStorage(): StoragePort {
  return env.STORAGE_EMULATOR_HOST ? emulatorStorage(env.STORAGE_EMULATOR_HOST) : realStorage();
}

function realStorage(): StoragePort {
  const storage = new Storage({
    projectId: env.GCP_PROJECT_ID,
    ...(env.GCP_SERVICE_ACCOUNT_JSON
      ? { credentials: JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON) as object }
      : {}),
  });

  const bucket = storage.bucket(env.GCS_BUCKET);

  return {
    async presignUpload(key, contentType): Promise<PresignedUpload> {
      const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS);
      const [url] = await bucket.file(key).getSignedUrl({
        version: "v4",
        action: "write",
        expires: expiresAt,
        contentType,
      });
      return { url, key, headers: { "Content-Type": contentType }, expiresAt };
    },

    async presignDownload(key): Promise<string> {
      const [url] = await bucket.file(key).getSignedUrl({
        version: "v4",
        action: "read",
        expires: new Date(Date.now() + DOWNLOAD_URL_TTL_MS),
      });
      return url;
    },

    async delete(key): Promise<void> {
      await bucket.file(key).delete({ ignoreNotFound: true });
    },

    async exists(key): Promise<boolean> {
      const [exists] = await bucket.file(key).exists();
      return exists;
    },
  };
}

/**
 * Development adapter talking to fake-gcs-server over its REST API.
 *
 * The Google SDK's emulator support did not route to the emulator here: writes
 * appeared to succeed while exists() and delete() silently operated on nothing,
 * which would have made /photos/confirm reject every valid upload. Addressing
 * the emulator directly keeps development behaviour deterministic.
 *
 * This path is unreachable in production: assertProductionSafety() refuses to
 * boot when STORAGE_EMULATOR_HOST is set with NODE_ENV=production.
 */
function emulatorStorage(host: string): StoragePort {
  const base = host.replace(/\/$/, "");
  const bucket = env.GCS_BUCKET;
  const objectUrl = (key: string) =>
    `${base}/storage/v1/b/${bucket}/o/${encodeURIComponent(key)}`;

  // The emulator starts empty and loses state on restart, so create the bucket
  // on first use rather than making every developer run a curl by hand.
  let bucketReady: Promise<void> | undefined;
  const ensureBucket = () => {
    bucketReady ??= (async () => {
      const existing = await fetch(`${base}/storage/v1/b/${bucket}`);
      if (existing.ok) return;
      await fetch(`${base}/storage/v1/b?project=${env.GCP_PROJECT_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: bucket }),
      });
    })().catch((error: unknown) => {
      bucketReady = undefined;
      throw error;
    });
    return bucketReady;
  };

  return {
    async presignUpload(key, contentType): Promise<PresignedUpload> {
      await ensureBucket();
      return {
        url: `${base}/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(key)}`,
        key,
        headers: { "Content-Type": contentType },
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_MS),
      };
    },

    async presignDownload(key): Promise<string> {
      return `${objectUrl(key)}?alt=media`;
    },

    async delete(key): Promise<void> {
      const response = await fetch(objectUrl(key), { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Emulator delete failed: HTTP ${response.status}`);
      }
    },

    async exists(key): Promise<boolean> {
      const response = await fetch(objectUrl(key), { method: "GET" });
      return response.ok;
    },
  };
}
