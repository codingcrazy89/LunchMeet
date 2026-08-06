import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { profiles } from "@lunchmeet/db";
import { db } from "../db.js";
import { notFound } from "../lib/errors.js";
import { currentUser, requireAuth, type AppVariables } from "../middleware/session.js";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  age: z.number().int().min(18).max(120).nullish(),
  gender: z.string().max(50).nullish(),
  bio: z.string().max(2000).nullish(),
  socialMediaUrl: z.url().max(500).nullish(),
  lookingFor: z.array(z.string().max(50)).max(20).optional(),
  photoKeys: z.array(z.string().max(500)).max(6).optional(),
});

/**
 * Fields safe to expose on another user's profile.
 *
 * Note what is missing: suspension state, and anything about ratings received.
 * v1 exposed `suspended` to any client that selected the row.
 */
const publicProfileColumns = {
  userId: profiles.userId,
  name: profiles.name,
  age: profiles.age,
  gender: profiles.gender,
  bio: profiles.bio,
  socialMediaUrl: profiles.socialMediaUrl,
  lookingFor: profiles.lookingFor,
  photoKeys: profiles.photoKeys,
};

export const profileRoutes = new Hono<{ Variables: AppVariables }>()

  .get("/me", requireAuth, async (c) => {
    const user = currentUser(c);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    if (!profile) {
      // First sign-in: create the profile lazily from the auth record.
      const [created] = await db
        .insert(profiles)
        .values({ userId: user.id, name: user.name })
        .onConflictDoNothing()
        .returning();
      return c.json({ profile: created ?? null, email: user.email });
    }

    return c.json({ profile, email: user.email });
  })

  .patch("/me", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
    const user = currentUser(c);
    const input = c.req.valid("json");

    const [updated] = await db
      .update(profiles)
      .set({
        ...input,
        age: input.age ?? undefined,
        gender: input.gender ?? undefined,
        bio: input.bio ?? undefined,
        socialMediaUrl: input.socialMediaUrl ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, user.id))
      .returning();

    if (!updated) throw notFound("Profile not found.");
    return c.json({ profile: updated });
  })

  .get("/:userId", requireAuth, async (c) => {
    const [profile] = await db
      .select(publicProfileColumns)
      .from(profiles)
      .where(eq(profiles.userId, c.req.param("userId")))
      .limit(1);

    if (!profile) throw notFound("Profile not found.");
    return c.json({ profile });
  });
