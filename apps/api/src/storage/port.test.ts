import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./memory.js";
import { extensionFor, isAllowedImageType, isOwnedBy, profilePhotoKey } from "./port.js";

/**
 * Ownership is enforced by key structure, so these are the tests that matter:
 * v1 let any authenticated user overwrite or delete anyone's photos.
 */
describe("object ownership", () => {
  const key = profilePhotoKey("user-a", "photo-1", "jpg");

  it("namespaces keys by owner", () => {
    expect(key).toBe("profiles/user-a/photo-1.jpg");
  });

  it("accepts the owner", () => {
    expect(isOwnedBy(key, "user-a")).toBe(true);
  });

  it("rejects a different user", () => {
    expect(isOwnedBy(key, "user-b")).toBe(false);
  });

  it("rejects a prefix that only looks like the owner", () => {
    // "user-a" must not match a key belonging to "user-abc".
    expect(isOwnedBy("profiles/user-abc/photo.jpg", "user-a")).toBe(false);
  });

  it("rejects traversal out of the owner's prefix", () => {
    expect(isOwnedBy("profiles/user-b/../user-a/photo.jpg", "user-a")).toBe(false);
  });
});

describe("content types", () => {
  it("allows the supported image types", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(isAllowedImageType("application/pdf")).toBe(false);
    expect(isAllowedImageType("text/html")).toBe(false);
  });

  it("maps each type to a file extension", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
  });
});

describe("memory storage", () => {
  it("round-trips an object", async () => {
    const storage = createMemoryStorage();
    const key = profilePhotoKey("user-a", "photo-1", "jpg");

    expect(await storage.exists(key)).toBe(false);
    await storage.presignUpload(key, "image/jpeg");
    expect(await storage.exists(key)).toBe(true);

    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });
});
