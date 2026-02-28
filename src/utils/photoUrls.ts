import { supabase } from "../lib/supabase";

/** Extract path from any profile-photos URL (signed or public) */
function getPathFromPhotoUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const path = url.split("/profile-photos/")[1]?.split("?")[0];
  return path || null;
}

/** Convert any photo URLs (signed or public) to public URLs for storing in DB. Data URIs are kept as-is. */
export function toPublicPhotoUrls(urls: string[]): string[] {
  return urls.map((url: string) => {
    if (url.startsWith("data:")) return url;
    const path = getPathFromPhotoUrl(url);
    if (!path) return url;
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  });
}

/** Prepare photos for display: data URIs pass through, URLs get signed. */
export async function preparePhotosForDisplay(urls: string[]): Promise<string[]> {
  const dataUris = urls.filter((u) => typeof u === "string" && u.startsWith("data:"));
  const urlPhotos = urls.filter((u) => typeof u === "string" && !u.startsWith("data:"));
  const signed = urlPhotos.length > 0 ? await getSignedPhotoUrls(urlPhotos) : [];
  return [...dataUris, ...signed];
}

/** Convert storage URLs to signed URLs so images load (works when public access fails) */
export async function getSignedPhotoUrls(urls: string[]): Promise<string[]> {
  return Promise.all(
    urls.map(async (url: string) => {
      if (!url || typeof url !== "string") return url;
      const path = getPathFromPhotoUrl(url);
      if (!path) {
        console.warn("Could not extract path from photo URL:", url?.slice(0, 80));
        return url;
      }
      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(path, 60 * 60); // 1 hour
      if (error) {
        console.error("createSignedUrl failed for path", path, ":", error.message, "- using original URL (may be expired)");
        return url;
      }
      const signed = data?.signedUrl || url;
      return signed;
    })
  );
}
