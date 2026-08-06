import { Image, StyleProp, ImageStyle, ImageResizeMode } from "react-native";

type Props = {
  source: { uri: string };
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
};

export default function ProfilePhotoImage({ source, style, resizeMode = "cover" }: Props) {
  if (!source?.uri) return null;
  return (
    <Image
      source={{ uri: source.uri }}
      style={[{ width: 90, height: 90 }, style]}
      resizeMode={resizeMode}
    />
  );
}
