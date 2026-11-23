import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, Clock3, X, XCircle } from 'lucide-react-native';
import type { SOSRequest } from '../api';
import {
  SOS_STAGES,
  sosPhase,
  sosStepStates,
  type SOSStepState,
} from '../sosStatus';
import { fontSize, space, useTheme, type ThemeColors } from '../theme';

type AlertMeta = {
  label: string;
  title: string;
  body: string;
  bg: string;
  fg: string;
  border: string;
  Icon: typeof CheckCircle2;
};

/** The alert itself changes with dispatch's decision, not just a status chip. */
function alertMeta(phase: ReturnType<typeof sosPhase>, c: ThemeColors): AlertMeta {
  switch (phase) {
    case 'accepted':
      return {
        label: 'Request accepted',
        title: 'Help is on the way',
        body: 'A rescue unit has been dispatched to your location. Keep your phone close and stay where you are.',
        bg: c.blue50,
        fg: c.blue700,
        border: c.blue600,
        Icon: CheckCircle2,
      };
    case 'rejected':
      return {
        label: 'Request rejected',
        title: 'Signal closed as a false alarm',
        body: 'Dispatch has closed this SOS. If you are still in danger, send a new request.',
        bg: c.red50,
        fg: c.red700,
        border: c.red600,
        Icon: XCircle,
      };
    case 'completed':
      return {
        label: 'Rescue completed',
        title: 'You are all clear',
        body: 'Dispatch has resolved this SOS and released the rescue unit. Stay safe.',
        bg: c.green50,
        fg: c.green700,
        border: c.green600,
        Icon: CheckCircle2,
      };
    default:
      return {
        label: 'Signal received',
        title: 'Waiting for dispatch',
        body: 'Your SOS is with dispatch. A responder is reviewing it now — keep this screen open for updates.',
        bg: c.amber100,
        fg: c.amber800,
        border: c.amber800,
        Icon: Clock3,
      };
  }
}

const STEP_LABEL: Record<SOSStepState, string> = {
  done: 'Done',
  current: 'Now',
  upcoming: 'Waiting',
  skipped: 'Skipped',
};

/**
 * The driver's own view of what dispatch has done with their SOS so far
 * (FSD-FR-036/043/074): an alert for the current decision, a step-by-step
 * progress track.
 * Mounted once at the app root (SOSTrackerProvider) so it can pop up on a
 * status change no matter which screen the driver is on.
 */
export function SOSUpdateModal({
  visible,
  sos,
  onClose,
}: {
  visible: boolean;
  sos: SOSRequest | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const phase = sosPhase(sos?.status);
  const alert = alertMeta(phase, c);
  const AlertIcon = alert.Icon;
  const steps = sosStepStates(sos?.status);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: space[20] }}
        onPress={onClose}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={() => {}}
          style={{
            backgroundColor: c.surfaceHigh,
            borderWidth: 1,
            borderColor: c.slate200,
            borderRadius: 24,
            padding: space[20],
            maxHeight: '82%',
            gap: space[14],
            shadowColor: c.black,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 28,
            elevation: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View>
              <Text
                style={{
                  fontSize: fontSize.micro,
                  fontWeight: '800',
                  color: c.slate400,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                SOS #{sos?.sos_id}
              </Text>
              <Text style={{ fontSize: fontSize.subtitle, fontWeight: '800', color: c.slate900, marginTop: space[2] }}>
                Dispatch Update
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: c.slate100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} color={c.slate600} />
            </TouchableOpacity>
          </View>

          {/* Initial alert, acceptance/rejection, or completion — one treatment. */}
          <View
            style={{
              flexDirection: 'row',
              gap: space[12],
              backgroundColor: alert.bg,
              borderWidth: 1,
              borderColor: alert.border,
              borderRadius: 16,
              padding: space[14],
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceHigh, alignItems: 'center', justifyContent: 'center' }}>
              <AlertIcon size={22} color={alert.fg} />
            </View>
            <View style={{ flex: 1, gap: space[3] }}>
              <Text style={{ fontSize: fontSize.micro, fontWeight: '800', color: alert.fg, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {alert.label}
              </Text>
              <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: c.slate900 }}>
                {alert.title}
              </Text>
              <Text style={{ fontSize: fontSize.body, color: c.slate700, lineHeight: 19 }}>{alert.body}</Text>
            </View>
          </View>

          {/* Step-by-step status: what has happened, what happens next. */}
          <View style={{ gap: space[2] }}>
            {SOS_STAGES.map((stage, index) => {
              const state = steps[index];
              const rejectedReview = phase === 'rejected' && index === 1;
              const fg = rejectedReview ? c.red700 : state === 'done' ? c.green700 : state === 'current' ? c.blue700 : c.slate400;
              const bg = rejectedReview ? c.red50 : state === 'done' ? c.green50 : state === 'current' ? c.blue50 : c.slate100;
              const isLast = index === SOS_STAGES.length - 1;
              return (
                <View key={stage} style={{ flexDirection: 'row', alignItems: 'stretch', gap: space[10], minHeight: 38 }}>
                  <View style={{ width: 24, alignItems: 'center' }}>
                    <View
                      style={{
                        width: state === 'current' ? 24 : 20,
                        height: state === 'current' ? 24 : 20,
                        borderRadius: 12,
                        borderWidth: state === 'current' ? 2 : 1,
                        borderColor: fg,
                        backgroundColor: bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {rejectedReview ? (
                        <XCircle size={12} color={fg} />
                      ) : state === 'done' ? (
                        <CheckCircle2 size={12} color={fg} />
                      ) : state === 'current' ? (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: fg }} />
                      ) : (
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.slate300 }} />
                      )}
                    </View>
                    {!isLast ? (
                      <View
                        style={{
                          width: 2,
                          flex: 1,
                          marginTop: space[2],
                          marginBottom: 2,
                          backgroundColor: state === 'done' ? c.green600 : c.slate200,
                        }}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center', paddingBottom: isLast ? 0 : space[8] }}>
                    <Text style={{ fontSize: fontSize.body, fontWeight: state === 'current' ? '700' : '600', color: state === 'upcoming' || state === 'skipped' ? c.slate400 : c.slate800 }}>
                      {stage}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.micro,
                      fontWeight: '800',
                      color: rejectedReview ? c.red700 : fg,
                      alignSelf: 'center',
                      paddingBottom: isLast ? 0 : space[8],
                    }}
                  >
                    {rejectedReview ? 'Rejected' : STEP_LABEL[state]}
                  </Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Got it"
            style={{ paddingVertical: space[14], backgroundColor: c.inkBg, borderRadius: 14, alignItems: 'center' }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: c.onInk }}>Got it</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
