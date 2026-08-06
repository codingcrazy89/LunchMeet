import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Spacing } from "../constants/theme";

type StarRatingProps = {
  value: number;
  onChange: (rating: number) => void;
  max?: number;
};

export default function StarRating({ value, onChange, max = 5 }: StarRatingProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          style={styles.star}
        >
          <Text style={[styles.starText, star <= value && styles.starFilled]}>
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  star: {
    padding: Spacing.xs,
  },
  starText: {
    fontSize: 32,
    color: Colors.border,
  },
  starFilled: {
    color: Colors.warning,
  },
});
