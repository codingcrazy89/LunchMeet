import { Redirect } from "expo-router";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../src/AuthContext";

function BrandHeader() {
  return (
    <View style={styles.brandHeader}>
      <Text style={styles.logo}>🍽️</Text>
      <Text style={styles.brandTitle}>Lunch Meet</Text>
    </View>
  );
}

export default function LoginScreen() {
  const { user, loading, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (!loading && user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    await signInWithEmail(email);
    setSent(true);
  };

  return (
    <View style={styles.wrapper}>
      <BrandHeader />
      <View style={styles.container}>
        {sent ? (
          <Text>Check your email for the login link.</Text>
        ) : (
          <>
            <TextInput
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <Button title="Send Login Link" onPress={handleLogin} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#fff",
  },
  brandHeader: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0066cc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderBottomWidth: 2,
    borderColor: "#0052a3",
  },
  logo: {
    fontSize: 28,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    marginBottom: 12,
    borderRadius: 6,
  },
});


