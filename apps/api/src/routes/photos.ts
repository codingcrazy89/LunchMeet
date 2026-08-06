import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { profiles } from "@lunchmeet/db";
import { db } from "../db.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { currentUser, requireAuth, type AppVariables } from "../middleware/session.js";
import {
  extensionFor,
  isAllowedImageType,
  isOwnedBy,
  profilePhotoKey,
  storage,
  ALLOWED_IMAGE_TYPES,
} from "../storage/index.js";

const MAX_PHOTOS = 6;

const uploadSchema = z.object({
  contentType: z.string().refine(isAllowedImageType, {
    message: `Must be one of ${ALLOWED_IMAGE_TYPES.join(", ")}`,
  }),
});

const confirmSchema = z.object({ key: z.string().min(1).max(500) });

/**
 * Profile photo upload.
 *
 * The client asks for a signed URL, PUTs the bytes straight to storage, then
 * confirms. Image data never passes through the API, and never lands in
 * Postgres. v1 base64-encoded photos into `profiles.photos`, a column read on
 * nearly every screen, so every profile query carried megabytes of image.
 */
export const photoRoutes = new Hono<{ Variables: AppVariables }>()

  .post("/upload-url", requireAuth, zValidator("json", uploadSchema), async (c) => {
    const user = currentUser(c);
    const { contentType } = c.req.valid("json");

    if (!isAllowedImageType(contentType)) {
      throw badRequest("Unsupported image type.");
    }

    const [profile] = await db
      .select({ photoKeys: profiles.photoKeys })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    if (!profile) throw notFound("Profile not found.");
    if (profile.photoKeys.length >= MAX_PHOTOS) {
      throw badRequest(`You can have at most ${MAX_PHOTOS} photos.`);
    }

    // The key is derived from the session, never supplied by the client, so a
    // caller cannot obtain a signature for somebody else's object.
    const key = profilePhotoKey(user.id, randomUUID(), extensionFor(contentType));
    const upload = await storage().presignUpload(key, contentType);

    return c.json({ upload }, 201);
  })

  /** Records a completed upload against the profile. */
  .post("/confirm", requireAuth, zValidator("json", confirmSchema), async (c) => {
    const user = currentUser(c);
    const { key } = c.req.valid("json");

    if (!isOwnedBy(key, user.id)) {
      throw forbidden("That object does not belong to you.");
    }
    if (!(await storage().exists(key))) {
      throw badRequest("Upload not found. Send the bytes before confirming.");
    }

    const [profile] = await db
      .select({ photoKeys: profiles.photoKeys })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    if (!profile) throw notFound("Profile not found.");
    if (profile.photoKeys.includes(key)) {
      return c.json({ photoKeys: profile.photoKeys });
    }
    if (profile.photoKeys.length >= MAX_PHOTOS) {
      throw badRequest(`You can have at most ${MAX_PHOTOS} photos.`);
    }

    const [updated] = await db
      .update(profiles)
      .set({ photoKeys: [...profile.photoKeys, key], updatedAt: new Date() })
      .where(eq(profiles.userId, user.id))
      .returning({ photoKeys: profiles.photoKeys });

    return c.json({ photoKeys: updated?.photoKeys ?? [] });
  })

  .delete("/:key{.+}", requireAuth, async (c) => {
    const user = currentUser(c);
    const key = c.req.param("key");

    if (!isOwnedBy(key, user.id)) {
      throw forbidden("That object does not belong to you.");
    }

    const [profile] = await db
      .select({ photoKeys: profiles.photoKeys })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    if (!profile) throw notFound("Profile not found.");

    await db
      .update(profiles)
      .set({
        photoKeys: profile.photoKeys.filter((existing) => existing !== key),
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, user.id));

    await storage().delete(key);

    return c.json({ ok: true });
  })

  /**
   * Signed read URLs for a set of keys.
   *
   * Photos are private objects; the bucket is not world-readable. v1 made the
   * whole profile-photos bucket public.
   */
  .post(
    "/urls",
    requireAuth,
    zValidator("json", z.object({ keys: z.array(z.string().max(500)).max(30) })),
    async (c) => {
      const { keys } = c.req.valid("json");
      const port = storage();

      const urls = await Promise.all(
        keys.map(async (key) => ({ key, url: await port.presignDownload(key) }))
      );

      return c.json({ urls });
    }
  );
