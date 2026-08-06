import type { ExpoConfig } from "expo/config";
import { parsePublicEnv } from "@lunchmeet/config/public";

/**
 * Expo configuration.
 *
 * Public runtime values come from the source catalogue in packages/config, so
 * there is exactly one declaration of what the client needs. v1 duplicated
 * these into eas.json and then fell back to reading the *development* env
 * block here, which silently shipped development configuration in production
 * builds.
 */

// Validates and applies defaults; throws with a readable message if malformed.
const publicEnv = parsePublicEnv();

/** v1 Supabase values, still required until the client moves to the v2 API. */
const legacySupabase = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  placesProxyUrl: process.env.EXPO_PUBLIC_PLACES_PROXY_URL ?? null,
};

function androidMapsConfig() {
  const mapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!mapsKey) {
    // Release builds without a key silently ship without native maps, which is
    // how v1 shipped Android with a blank map view.
    console.warn(
      "[app.config] No Android Maps API key found. Native maps will not render on Android."
    );
    return {};
  }
  return { config: { googleMaps: { apiKey: mapsKey } } };
}

const config: ExpoConfig = {
  name: "LunchMeet Social",
  slug: "lunchmeet",
  owner: "jpmitchell89",
  scheme: "lunchmeet",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/images/logo.png",
  splash: {
    image: "./assets/images/logo.png",
    resizeMode: "contain",
    backgroundColor: "#FAFAFA",
  },
  ios: {
    bundleIdentifier: "com.lunchmeet.app",
    // Incremented automatically by EAS for production builds.
    buildNumber: "13",
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "LunchMeet needs your location to show nearby restaurants on the map.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "LunchMeet needs your location to show nearby restaurants on the map.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.lunchmeet.app",
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      foregroundImage: "./assets/images/logo.png",
      backgroundColor: "#ffffff",
    },
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    ...androidMapsConfig(),
  },
  plugins: [
    "expo-dev-client",
    "expo-apple-authentication",
    [
      "expo-build-properties",
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          extraProguardRules: "-keepattributes SourceFile,LineNumberTable",
        },
      },
    ],
    "@react-native-community/datetimepicker",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "LunchMeet needs your location to show nearby restaurants on the map.",
      },
    ],
    // Stores the Better Auth session in the platform keychain.
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission:
          "LunchMeet needs access to your photos so you can add them to your profile.",
        // The app never opens the camera or records audio. Declaring unused
        // permissions invites App Review questions and contradicts the privacy
        // policy, so omit them.
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  updates: {
    url: "https://u.expo.dev/7af89ddf-26f2-44b8-99c2-4e8bbdb227da",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  extra: {
    // v2 configuration, validated by packages/config.
    apiUrl: publicEnv.EXPO_PUBLIC_API_URL,
    wsUrl: publicEnv.EXPO_PUBLIC_WS_URL,

    // v1 configuration, removed once the client finishes moving to the v2 API.
    supabaseUrl: legacySupabase.url,
    supabaseAnonKey: legacySupabase.anonKey,
    placesProxyUrl: legacySupabase.placesProxyUrl,

    eas: {
      projectId: "7af89ddf-26f2-44b8-99c2-4e8bbdb227da",
    },
  },
  web: {
    bundler: "metro",
  },
};

export default config;
