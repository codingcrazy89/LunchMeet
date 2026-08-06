import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { reportError } from "../src/lib/observability";

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * v1 caught render errors and showed them, but told nobody. A user seeing
   * this screen was invisible unless they wrote in about it.
   */
  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack });
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{this.state.error.message}</Text>
            {__DEV__ && this.state.error.stack ? (
              <Text style={styles.stack}>{this.state.error.stack}</Text>
            ) : null}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#0f172a",
  },
  scroll: { maxHeight: 300 },
  message: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 8,
  },
  stack: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#64748b",
  },
});
