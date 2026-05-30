// Reusable themed search bar. Used by the Library and Audio screens to
// filter their lists. Stays on-brand (cream/saffron/primary) and exposes
// a clear "x" button when the user has typed something.

import { Pressable, TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Optional bottom margin for tighter / looser layouts. */
  style?: { marginTop?: number; marginBottom?: number };
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search…",
  style,
}: Props) {
  return (
    <View
      style={{
        marginTop: style?.marginTop ?? 12,
        marginBottom: style?.marginBottom ?? 0,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "rgba(244,162,97,0.35)",
        shadowColor: "#B8336A",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      <Search color="#F4A261" size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={{
          flex: 1,
          marginLeft: 8,
          paddingVertical: 10,
          fontSize: 15,
          color: "#18181B",
        }}
      />
      {value.length > 0 ? (
        <Pressable
          hitSlop={10}
          onPress={() => onChangeText("")}
          style={{
            height: 26,
            width: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F4F4F5",
          }}
        >
          <X color="#71717A" size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}
