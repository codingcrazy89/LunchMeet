/**
 * The storage port.
 *
 * Four operations is everything profile photos need. Keeping the surface this
 * small is what makes an in-memory fake practical for tests, and what would
 * make a different provider a day's work rather than a rewrite.
 */
export interface StoragePort {
  /** A time-limited URL the client can PUT directly to. */
  presignUpload(key: string, contentType: string): Promise<PresignedUpload>;
  /** A time-limited URL for reading a private object. */
  presignDownload(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface PresignedUpload {
  url: string;
  key: string;
  /** Headers the client must send with the PUT for the signature to match. */
  headers: Record<string, string>;
  expiresAt: Date;
}

export const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
export const DOWNLOAD_URL_TTL_MS = 60 * 60 * 1000;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function isAllowedImageType(value: string): value is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

/**
 * Object keys are namespaced by owner.
 *
 * This is the fix for v1's storage policies, which allowed any authenticated
 * user to update or delete any object in the profile-photos bucket. Ownership
 * is now structural: a key that does not start with the caller's prefix is not
 * theirs, and the API will not sign it.
 */
export function profilePhotoKey(userId: string, photoId: string, extension: string): string {
  return `profiles/${userId}/${photoId}.${extension}`;
}

export function isOwnedBy(key: string, userId: string): boolean {
  return key.startsWith(`profiles/${userId}/`);
}

export function extensionFor(contentType: AllowedImageType): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}
