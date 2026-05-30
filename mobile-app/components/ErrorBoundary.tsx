import React from "react";
import { ScrollView, Text, View } from "react-native";

type Props = {
  label?: string;
  children: React.ReactNode;
};

type State = {
  error: Error | null;
  info: { componentStack?: string } | null;
};

/**
 * Catches render-time errors in its subtree and shows the message + the
 * React component stack so we can see *which* component actually threw,
 * instead of the misleading frame React reports in production overlays.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.setState({ error, info });
    // Surface to Metro console too.
    // eslint-disable-next-line no-console
    console.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`,
      error,
      info?.componentStack
    );
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: "#FFF8F0" }}
          contentContainerStyle={{ padding: 16 }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "#F4A26155",
            }}
          >
            <Text
              style={{
                color: "#B8336A",
                fontWeight: "700",
                fontSize: 16,
                marginBottom: 8,
              }}
            >
              {this.props.label ? `${this.props.label} crashed` : "Something went wrong"}
            </Text>
            <Text
              selectable
              style={{
                color: "#7f1d1d",
                fontFamily: "Menlo",
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {String(this.state.error?.message ?? this.state.error)}
            </Text>
            {this.state.info?.componentStack ? (
              <Text
                selectable
                style={{
                  color: "#52525b",
                  fontFamily: "Menlo",
                  fontSize: 11,
                }}
              >
                {this.state.info.componentStack}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
