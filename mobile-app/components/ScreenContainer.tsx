import { ReactNode, useState, useCallback } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../src/lib/useBranding";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
  /** Called when user pulls to refresh. Provide to enable swipe-to-refresh. */
  onRefresh?: () => void | Promise<void>;
};

/**
 * Standard screen wrapper: handles safe-area insets and a cream background.
 * Pass `scroll` to enable vertical scrolling. Pass `onRefresh` to enable
 * pull-to-refresh (only works when scroll is true).
 *
 * On web, the root layout already constrains the app to a phone-like
 * column, so this component just fills its parent.
 */
export function ScreenContainer({
  children,
  scroll,
  className,
  onRefresh,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const inner = (
    <View className={`flex-1 px-5 ${className ?? ""}`}>{children}</View>
  );

  return (
    // No `edges={["top"]}` — the navigation header already accounts for the
    // status bar inset, and adding it here causes an extra blank strip on
    // Android (visible as a gap between the header and the page content).
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: theme.cream }}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.primary}
                colors={[theme.primary, theme.saffron]}
              />
            ) : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}


