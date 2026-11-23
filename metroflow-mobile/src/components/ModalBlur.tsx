import React, { createContext, useContext, useRef } from 'react';
import { View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';

type BlurTarget = React.ComponentRef<typeof View>;

const BlurTargetContext = createContext<React.RefObject<BlurTarget | null> | null>(null);

/**
 * Mounted once at the root. iOS blurs whatever is behind the backdrop view, but
 * expo-blur on Android needs a ref to the content being blurred (SDK 58).
 * Rendering this around the app also keeps a single blur target for every modal.
 */
export function ModalBlurProvider({ children }: { children: React.ReactNode }) {
  const target = useRef<BlurTarget | null>(null);
  return (
    <BlurTargetContext.Provider value={target}>
      <BlurTargetView ref={target} style={{ flex: 1 }}>
        {children}
      </BlurTargetView>
    </BlurTargetContext.Provider>
  );
}

/** Blurred scrim for a dialog; render as the first child of its backdrop. */
export function ModalBlur() {
  const target = useContext(BlurTargetContext);
  const fill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
  return (
    <>
      <BlurView
        blurTarget={target ?? undefined}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={90}
        tint="dark"
        pointerEvents="none"
        style={fill}
      />
      {/* On top of the blur, not behind it: otherwise the red SOS/report UI
          behind the modal gets sampled and tinted into a red backdrop. */}
      <View pointerEvents="none" style={{ ...fill, backgroundColor: 'rgba(16, 41, 49, 0.84)' }} />
    </>
  );
}
