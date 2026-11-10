import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, Info } from "lucide-react-native";

import { fontSize, space, useTheme } from "../theme";

/** Matches the Quick Picks dialogs so every prompt in the app looks the same. */
export type DialogTone = "info" | "warning" | "danger";

export type DialogRequest = {
  title: string;
  message: string;
  tone?: DialogTone;
  /** Omit for a notice: one OK button instead of cancel/confirm. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Fills the confirm button red, for actions that cannot be undone. */
  destructive?: boolean;
};

type Dialog = {
  /** Resolves true only when the confirm button is pressed. */
  confirm: (request: DialogRequest) => Promise<boolean>;
  notice: (request: DialogRequest) => Promise<void>;
};

const DialogContext = createContext<Dialog | null>(null);

export function useDialog(): Dialog {
  const dialog = useContext(DialogContext);
  if (!dialog) throw new Error("useDialog must be used inside DialogProvider");
  return dialog;
}

type Pending = DialogRequest & { resolve: (confirmed: boolean) => void };

export function DialogProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const [pending, setPending] = useState<Pending | null>(null);
  const current = useRef<Pending | null>(null);

  const open = useCallback(
    (request: DialogRequest) =>
      new Promise<boolean>((resolve) => {
        // One dialog at a time; a superseded prompt is treated as dismissed.
        current.current?.resolve(false);
        const next = { ...request, resolve };
        current.current = next;
        setPending(next);
      }),
    [],
  );

  const close = useCallback((confirmed: boolean) => {
    current.current?.resolve(confirmed);
    current.current = null;
    setPending(null);
  }, []);

  // Separate promise so the context value stays stable across renders.
  const notice = useCallback(
    (request: DialogRequest) => open(request).then(() => undefined),
    [open],
  );

  const tone: DialogTone = pending?.tone ?? "info";
  const accent =
    tone === "danger"
      ? { icon: c.red600, bg: c.red50 }
      : tone === "warning"
        ? { icon: c.amber800, bg: c.amber100 }
        : { icon: c.blue600, bg: c.blue50 };

  return (
    <DialogContext.Provider value={{ confirm: open, notice }}>
      {children}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => close(false)}
      >
        <Pressable
          accessibilityLabel="Dismiss dialog"
          onPress={() => close(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.45)",
            justifyContent: "center",
            padding: space[20],
          }}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 340,
              alignSelf: "center",
              backgroundColor: c.white,
              borderRadius: 18,
              padding: space[20],
              gap: space[12],
              shadowColor: c.black,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: accent.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {tone === "info" ? (
                <Info size={20} color={accent.icon} />
              ) : (
                <AlertTriangle size={20} color={accent.icon} />
              )}
            </View>
            <Text style={{ fontSize: fontSize.heading, fontWeight: "800", color: c.slate900 }}>
              {pending?.title}
            </Text>
            <Text style={{ fontSize: fontSize.body, color: c.slate500 }}>{pending?.message}</Text>
            <View style={{ flexDirection: "row", gap: space[10], marginTop: space[4] }}>
              {pending?.confirmLabel ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={pending.cancelLabel ?? "Cancel"}
                  onPress={() => close(false)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: c.slate200,
                    borderRadius: 10,
                    paddingVertical: space[12],
                  }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: "800", color: c.slate700 }}>
                    {pending.cancelLabel ?? "Cancel"}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={pending?.confirmLabel ?? "OK"}
                onPress={() => close(true)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  borderRadius: 10,
                  paddingVertical: space[12],
                  backgroundColor: pending?.destructive ? c.red600 : c.slate900,
                }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: "800", color: c.white }}>
                  {pending?.confirmLabel ?? "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}
