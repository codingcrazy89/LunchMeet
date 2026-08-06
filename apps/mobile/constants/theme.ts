/**
 * LunchMeet design system — Meetup / Hinge inspired
 * Warm, social, content-first. Clean cards, generous spacing, pill buttons.
 */
import { Platform } from "react-native";

export const Colors = {
  primary: "#E85D4C",
  primaryDark: "#D04A3A",
  primaryLight: "#FFE8E5",
  background: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#1A1A1A",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  success: "#10B981",
  successBg: "#D1FAE5",
  error: "#DC2626",
  errorBg: "#FEE2E2",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  destructive: "#DC2626",
  link: "#E85D4C",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#E85D4C",
  cardOverlay: "rgba(0,0,0,0.04)",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 9999,
};

export const Typography = {
  largeTitle: { fontSize: 28, fontWeight: "700" as const, color: Colors.text, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700" as const, color: Colors.text, letterSpacing: 0.2 },
  titleSmall: { fontSize: 18, fontWeight: "600" as const, color: Colors.text },
  body: { fontSize: 16, color: Colors.text, lineHeight: 24 },
  bodySecondary: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  caption: { fontSize: 13, color: Colors.textMuted },
  label: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
  button: { fontSize: 17, fontWeight: "600" as const },
  buttonSmall: { fontSize: 15, fontWeight: "600" as const },
};

export const Shadows = Platform.select({
  ios: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    cardSubtle: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
    },
    button: {
      shadowColor: "#E85D4C",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
  },
  default: {
    card: { elevation: 4 },
    cardSubtle: { elevation: 2 },
    button: { elevation: 2 },
  },
});
