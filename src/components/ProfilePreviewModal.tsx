import { router } from "expo-router";
import {
    Button,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ProfilePreviewModal({
  visible,
  profiles,
  startIndex,
  onClose,
}: {
  visible: boolean;
  profiles: any[];
  startIndex: number;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <FlatList
          data={profiles}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>
                {item.name || "Unnamed User"}
              </Text>

              {item.age && (
                <Text style={styles.meta}>
                  Age: {item.age}
                </Text>
              )}

              {item.gender && (
                <Text style={styles.meta}>
                  Gender: {item.gender}
                </Text>
              )}

              {item.bio && (
                <Text style={styles.bio}>
                  {item.bio}
                </Text>
              )}

              {item.interests?.length > 0 && (
                <View style={styles.interestsBox}>
                  <Text style={styles.sectionTitle}>
                    Interests
                  </Text>
                  {item.interests.map((i: string) => (
                    <Text key={i} style={styles.interest}>
                      • {i}
                    </Text>
                  ))}
                </View>
              )}

              <View style={{ marginTop: 20 }}>
                <Button
                  title="View Full Profile"
                  onPress={() => {
                    onClose();
                    router.push({
                      pathname: "/profile/[id]",
                      params: { id: item.id },
                    });
                  }}
                />
              </View>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    height: "60%",
    backgroundColor: "#F6F7FB",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
  },
  card: {
    width: SCREEN_WIDTH,
    padding: 20,
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
  },
  meta: {
    marginTop: 4,
    color: "#555",
  },
  bio: {
    marginTop: 10,
    fontSize: 15,
  },
  sectionTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  interestsBox: {
    marginTop: 6,
  },
  interest: {
    fontSize: 14,
    color: "#444",
  },
});

