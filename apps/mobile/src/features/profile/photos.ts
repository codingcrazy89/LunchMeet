import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import { queryKeys } from "../../api/queryClient";

/**
 * Profile photo upload.
 *
 * The bytes go straight from the device to storage using a signed URL; they
 * never pass through the API. v1 base64-encoded every photo into a Postgres
 * column that was selected on almost every screen.
 */

interface PresignedUpload {
  url: string;
  key: string;
  headers: Record<string, string>;
  expiresAt: string;
}

function contentTypeFor(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function useUploadPhoto() {
  const client = useQueryClient();

  return useMutation({
    async mutationFn(localUri: string) {
      const contentType = contentTypeFor(localUri);

      const presignResponse = await api.v1.photos["upload-url"].$post({
        json: { contentType },
      });
      const { upload } = await unwrap<{ upload: PresignedUpload }>(presignResponse);

      // fetch on React Native streams a file:// URI when given a Blob, which
      // avoids loading the whole image into JS memory.
      const file = await fetch(localUri);
      const blob = await file.blob();

      const put = await fetch(upload.url, {
        method: "POST",
        headers: upload.headers,
        body: blob,
      });
      if (!put.ok) {
        throw new Error(`Upload failed (${put.status}).`);
      }

      const confirmResponse = await api.v1.photos.confirm.$post({
        json: { key: upload.key },
      });
      return unwrap<{ photoKeys: string[] }>(confirmResponse);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}

export function useDeletePhoto() {
  const client = useQueryClient();

  return useMutation({
    async mutationFn(key: string) {
      const response = await api.v1.photos[":key{.+}"].$delete({ param: { key } });
      return unwrap<{ ok: boolean }>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}

/**
 * Resolves storage keys to signed URLs.
 *
 * Photos are private objects, so a key is not a URL. v1 made the entire bucket
 * world-readable, which meant any profile photo was public to anyone who could
 * guess a path.
 */
export function usePhotoUrls(keys: string[] | undefined) {
  return useQuery({
    queryKey: ["photo-urls", ...(keys ?? [])],
    enabled: Boolean(keys && keys.length > 0),
    staleTime: 45 * 60 * 1000,
    async queryFn() {
      if (!keys || keys.length === 0) return {};
      const response = await api.v1.photos.urls.$post({ json: { keys } });
      const data = await unwrap<{ urls: { key: string; url: string }[] }>(response);
      return Object.fromEntries(data.urls.map((entry) => [entry.key, entry.url]));
    },
  });
}
