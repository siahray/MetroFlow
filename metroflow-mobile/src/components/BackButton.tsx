import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { TouchableOpacity } from "react-native";

import { useTheme } from "../theme";

/** The one back affordance used on every screen, so headers stay consistent. */
export function BackButton({
  label = "Go back",
  onPress,
}: {
  label?: string;
  /** Defaults to router.back(). */
  onPress?: () => void;
}) {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ?? (() => router.back())}
      style={{
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.slate50,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.slate200,
      }}
    >
      <ArrowLeft size={18} color={c.slate800} />
    </TouchableOpacity>
  );
}
