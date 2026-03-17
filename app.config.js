require("dotenv").config();

// Fallback: eas.json env (used when process.env is empty, e.g. dev build loading from Metro)
const easConfig = require("./eas.json");
const easEnv = easConfig?.build?.development?.env || {};

module.exports = {
  expo: {
    name: "LunchMeet",
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
      supportsTablet: true,
      usesAppleSignIn: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "LunchMeet needs your location to show nearby restaurants on the map.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "LunchMeet needs your location to show nearby restaurants on the map.",
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
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
      ],
      ...(function () {
        const mapsKey = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;
        if (!mapsKey) return {};
        return { config: { googleMaps: { apiKey: mapsKey } } };
      })(),
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
          locationWhenInUsePermission: "LunchMeet needs your location to show nearby restaurants on the map.",
        },
      ],
    ],
    updates: {
      url: "https://u.expo.dev/7af89ddf-26f2-44b8-99c2-4e8bbdb227da"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    extra: {
      googleMapsApiKey: process.env.GOOGLE_PLACES_API_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || easEnv.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || easEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      placesProxyUrl: process.env.EXPO_PUBLIC_PLACES_PROXY_URL || easEnv.EXPO_PUBLIC_PLACES_PROXY_URL || null,
      eas: {
        projectId: "7af89ddf-26f2-44b8-99c2-4e8bbdb227da"
      }
    },
    web: {
      bundler: "metro",
    },
  },
};
