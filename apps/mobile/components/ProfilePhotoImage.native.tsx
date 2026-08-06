import { cacheDirectory, downloadAsync } from "expo-file-system/legacy";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleProp, ImageStyle } from "react-native";
import Constants from "expo-constants";

type Props = {
  source: { uri: string };
  style?: StyleProp<ImageStyle>;
  resizeMode?: "contain" | "cover" | "stretch" | "center" | "repeat";
};

export default function ProfilePhotoImage({ source, style, resizeMode = "cover" }: Props) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const uri = source?.uri;

  useEffect(() => {
    if (!uri) return;
    if (uri.startsWith("data:")) {
      setLocalUri(uri);
      return;
    }
    const isSupabase = uri.includes("supabase.co/storage");
    if (!isSupabase) {
      setLocalUri(uri);
      return;
    }
    const dir = cacheDirectory;
    if (!dir) return;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;
    const headers = anonKey ? { Authorization: `Bearer ${anonKey}` } : undefined;
    const filename = uri.split("/").pop()?.split("?")[0] || "photo.jpg";
    const cachePath = `${dir}profile-photo-${filename}`;

    downloadAsync(uri, cachePath, { headers })
      .then(({ uri: downloadedUri, status }) => {
        if (status === 200 && downloadedUri) setLocalUri(downloadedUri);
      })
      .catch((err) => {
        console.warn("ProfilePhoto download failed:", err?.message || err);
      });
  }, [uri]);

  if (!uri) return null;
  if (!localUri) return null;

  // Map React Native resizeMode to expo-image contentFit
  const contentFit = resizeMode === "stretch" ? "fill" : resizeMode === "center" ? "none" : resizeMode;

  return (
    <Image
      source={{ uri: localUri }}
      style={[{ width: 90, height: 90, borderRadius: 8 }, style]}
      contentFit={contentFit as any}
      cachePolicy="none"
    />
  );
}
