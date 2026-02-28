import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";
import { useAuth } from "../src/AuthContext";

function BrandHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.brandHeader, { paddingTop: Math.max(insets.top, 12) }]}>
      <Image 
        source={require("../assets/images/logo.png")} 
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.brandTitle}>Lunch Meet</Text>
    </View>
  );
}

export default function LoginScreen() {
  const { user, loading, suspendedMessage, clearSuspendedMessage, signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    console.log("[Login] Screen mounted - enter email and tap Send Login Link to see auth logs");
  }, []);

  useEffect(() => {
    if (suspendedMessage) {
      if (Platform.OS === "web") {
        alert(suspendedMessage);
      } else {
        Alert.alert("Account Suspended", suspendedMessage, [{ text: "OK", onPress: clearSuspendedMessage }]);
      }
      clearSuspendedMessage();
    }
  }, [suspendedMessage, clearSuspendedMessage]);

  if (!loading && user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    console.log("[Login] handleLogin START - email length:", email?.trim?.()?.length ?? 0);
    setError(null);
    setSending(true);
    try {
      console.log("[Login] Calling signInWithEmail...");
      await signInWithEmail(email);
      console.log("[Login] signInWithEmail returned successfully");
      setSent(true);
    } catch (err: any) {
      console.error("[Login] signInWithEmail error:", err?.message ?? err);
      const msg = err?.message || String(err);
      const isRateLimit =
        /rate|limit|exceeded|too many|quota/i.test(msg);
      if (isRateLimit) {
        const friendly =
          "Too many login emails sent. Please wait about an hour and try again.";
        setError(friendly);
        if (Platform.OS !== "web") {
          Alert.alert("Email limit reached", friendly);
        }
      } else {
        setError(msg || "Failed to send login link. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <BrandHeader />
      <View style={styles.container}>
        {sent ? (
          <Text style={styles.successText}>Check your email for the login link.</Text>
        ) : (
          <>
            <TextInput
              placeholder="Email address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              editable={!sending}
            />
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <Pressable
              onPress={() => {
                const disabled = sending || !email.trim();
                console.log("[Login] Button tapped - disabled:", disabled, "email length:", email.trim().length);
                if (!disabled) handleLogin();
              }}
              style={({ pressed }) => [styles.loginButton, (sending || !email.trim()) && styles.loginButtonDisabled, pressed && styles.loginButtonPressed]}
            >
              <Text style={styles.loginButtonText}>{sending ? "Sending…" : "Send Login Link"}</Text>
            </Pressable>
            <Text style={styles.dividerText}>or</Text>
            <Pressable
              onPress={async () => {
                try {
                  await signInWithGoogle();
                } catch (err: any) {
                  setError(err?.message || "Google sign-in failed");
                }
              }}
              style={({ pressed }) => [styles.socialButton, pressed && styles.loginButtonPressed]}
            >
              <Text style={styles.socialButtonText}>Sign in with Google</Text>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable
                onPress={async () => {
                  try {
                    await signInWithApple();
                  } catch (err: any) {
                    setError(err?.message || "Apple sign-in failed");
                  }
                }}
                style={({ pressed }) => [styles.socialButton, styles.appleButton, pressed && styles.loginButtonPressed]}
              >
                <Text style={styles.appleButtonText}>Sign in with Apple</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  brandHeader: {
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  logo: {
    width: 40,
    height: 40,
  },
  brandTitle: {
    ...Typography.title,
    fontSize: 24,
    color: "#fff",
    letterSpacing: 0.5,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.xxl,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    fontSize: 16,
    backgroundColor: Colors.surface,
  },
  successText: {
    ...Typography.body,
    color: Colors.text,
  },
  errorBox: {
    backgroundColor: Colors.errorBg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: "600",
  },
  loginButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonPressed: {
    opacity: 0.85,
  },
  loginButtonText: {
    color: "#fff",
    ...Typography.button,
  },
  dividerText: {
    ...Typography.bodySecondary,
    textAlign: "center",
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  socialButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appleButton: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  socialButtonText: {
    ...Typography.button,
    color: Colors.text,
  },
  appleButtonText: {
    ...Typography.button,
    color: "#fff",
  },
  logsButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  logsButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
});


