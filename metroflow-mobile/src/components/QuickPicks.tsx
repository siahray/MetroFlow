import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Building2,
  Dumbbell,
  HeartPulse,
  Home,
  MapPin,
  MapPinOff,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react-native';

import { getNetworkState, type NetworkState, type NodeFeature } from '../api';
import { listQuickPicks, saveQuickPicks, type QuickPick, type QuickPickIcon } from '../quickPicks';
import { fontSize, space, colors, useTheme } from '../theme';

const ICONS: Record<QuickPickIcon, typeof Home> = {
  home: Home,
  work: Building2,
  gym: Dumbbell,
  mall: ShoppingBag,
  hospital: HeartPulse,
  other: Building2,
};

/** The in-progress edit. `pick` is null while creating a new Quick Pick. */
type Draft = {
  pick: QuickPick | null;
  name: string;
  icon: QuickPickIcon;
  query: string;
  /** A newly chosen road-network point; null keeps the pick's saved coordinates. */
  node: NodeFeature | null;
};

/** At most one confirmation is on screen: save an edit, or remove a pick. */
type Confirm = { kind: 'save' } | { kind: 'remove'; pick: QuickPick };

export function QuickPicks({
  visible,
  onClose,
  clearanceCm = 28,
}: {
  visible: boolean;
  onClose: () => void;
  clearanceCm?: number;
}) {
  const insets = useSafeAreaInsets();
  const [picks, setPicks] = useState<QuickPick[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      listQuickPicks().then(
        (next) => {
          setPicks(next);
          setLoadError(false);
        },
        () => setLoadError(true),
      ),
    [],
  );

  // Fresh data every time the modal opens, so a write from another screen is not
  // stale. Transient edit/confirm state is cleared by close(), not here, so the
  // React compiler's set-state-in-effect rule stays happy.
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void listQuickPicks().then(
      (next) => {
        if (!live) return;
        setPicks(next);
        setLoadError(false);
      },
      () => live && setLoadError(true),
    );
    getNetworkState(clearanceCm).then(
      (state) => live && setNetwork(state),
      () => live && setNetwork(null),
    );
    return () => {
      live = false;
    };
  }, [visible, clearanceCm]);

  const draftReady =
    !!draft && draft.name.trim().length > 0 && (draft.node !== null || draft.pick !== null);

  const results =
    draft && draft.query.trim().length > 0 && network
      ? network.nodes.features
          .filter((n) =>
            (n.properties.name ?? '').toLowerCase().includes(draft.query.trim().toLowerCase()),
          )
          .slice(0, 6)
      : [];

  // The saved point behind an edit, so the form shows where it currently goes.
  const currentName = draft?.pick
    ? network?.nodes.features.find((n) => n.properties.node_id === draft.pick?.nodeId)?.properties
        .name ??
      `${draft.pick.latitude.toFixed(4)}, ${draft.pick.longitude.toFixed(4)}`
    : null;

  function openAdd() {
    setError(null);
    setDraft({ pick: null, name: '', icon: 'other', query: '', node: null });
  }

  function openEdit(pick: QuickPick) {
    setError(null);
    setDraft({ pick, name: pick.name, icon: pick.icon, query: '', node: null });
  }

  function cancelDraft() {
    setDraft(null);
    setError(null);
  }

  async function persist(next: QuickPick[]) {
    await saveQuickPicks(next);
    setPicks(next);
  }

  async function submitDraft() {
    if (!draft || !draftReady) return;
    const base = draft.pick;
    const node = draft.node;
    const [longitude, latitude] = node
      ? node.geometry.coordinates
      : [base?.longitude ?? 0, base?.latitude ?? 0];
    const next: QuickPick = {
      id: base?.id ?? `${Date.now()}`,
      name: draft.name.trim(),
      nodeId: node?.properties.node_id ?? base?.nodeId ?? 0,
      latitude,
      longitude,
      icon: draft.icon,
    };
    const updated = base
      ? (picks ?? []).map((p) => (p.id === base.id ? next : p))
      : [...(picks ?? []), next];

    setBusy(true);
    setError(null);
    try {
      await persist(updated);
      setDraft(null);
      setConfirm(null);
    } catch {
      // Nothing was persisted: keep the draft so the driver can retry.
      setConfirm(null);
      setError('Could not save your changes. Nothing was updated — please try again.');
    } finally {
      setBusy(false);
    }
  }

  function requestSave() {
    if (!draft || !draftReady || busy) return;
    if (draft.pick) {
      setConfirm({ kind: 'save' });
    } else {
      void submitDraft();
    }
  }

  async function submitRemove() {
    if (confirm?.kind !== 'remove') return;
    const updated = (picks ?? []).filter((p) => p.id !== confirm.pick.id);
    setBusy(true);
    setError(null);
    try {
      // Only the association is dropped; the pick's own coords stay on the device
      // history and nothing is deleted on the server.
      await persist(updated);
      setConfirm(null);
    } catch {
      setConfirm(null);
      setError('Could not remove this Quick Pick. It is still saved — please try again.');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    // Clear the edit so the next open starts on the list, not a half-finished form.
    setDraft(null);
    setConfirm(null);
    setError(null);
    onClose();
  }

  function handleBack() {
    if (busy) return;
    if (confirm) {
      setConfirm(null);
      return;
    }
    if (draft) {
      cancelDraft();
      return;
    }
    close();
  }

  const headerTitle = draft ? (draft.pick ? 'Edit Quick Pick' : 'New Quick Pick') : 'Quick Picks';
  const confirmRemove = confirm?.kind === 'remove' ? confirm.pick : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBack}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityLabel="Dismiss Quick Picks"
          onPress={() => {
            if (!draft && !confirm) close();
          }}
          style={{ ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.55)' }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: space[16],
            paddingTop: insets.top + space[16],
            paddingBottom: insets.bottom + space[16],
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: '100%',
              alignSelf: 'center',
              backgroundColor: colors.white,
              borderRadius: 20,
              overflow: 'hidden',
              shadowColor: colors.black,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.18,
              shadowRadius: 24,
              elevation: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: space[12],
                paddingHorizontal: space[20],
                paddingTop: space[18],
                paddingBottom: space[12],
                borderBottomWidth: 1,
                borderColor: colors.slate100,
              }}
            >
              <View style={{ flex: 1, gap: space[2] }}>
                <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: colors.slate900 }}>
                  {headerTitle}
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: colors.slate500 }}>
                  Saved destinations for faster safe routes
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close"
                disabled={busy}
                hitSlop={10}
                onPress={close}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: colors.slate100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <X size={16} color={colors.slate500} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ padding: space[20], gap: space[14] }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {picks === null ? (
                <View style={{ alignItems: 'center', gap: space[10], paddingVertical: space[28] }}>
                  {loadError ? (
                    <>
                      <AlertTriangle size={26} color={colors.amber600} />
                      <Text style={{ fontSize: fontSize.lead, fontWeight: '800', color: colors.slate900 }}>
                        Could not load Quick Picks
                      </Text>
                      <Text style={{ fontSize: fontSize.body, color: colors.slate500, textAlign: 'center' }}>
                        Your saved destinations are still on this device.
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Retry loading Quick Picks"
                        onPress={() => void load()}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.slate200,
                          borderRadius: 10,
                          paddingHorizontal: space[16],
                          paddingVertical: space[10],
                        }}
                      >
                        <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: colors.slate900 }}>
                          Try Again
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator color={colors.blue600} />
                      <Text style={{ fontSize: fontSize.body, color: colors.slate500 }}>
                        Loading Quick Picks…
                      </Text>
                    </>
                  )}
                </View>
              ) : draft ? (
                <>
                  <View style={{ gap: space[6] }}>
                    <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: colors.slate700 }}>
                      Name
                    </Text>
                    <TextInput
                      value={draft.name}
                      onChangeText={(name) => setDraft((d) => (d ? { ...d, name } : d))}
                      accessibilityLabel="Quick Pick name"
                      placeholder="Name (e.g. Work HQ)"
                      placeholderTextColor={colors.slate400}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.slate200,
                        borderRadius: 10,
                        paddingHorizontal: space[12],
                        paddingVertical: space[10],
                        fontSize: fontSize.label,
                        color: colors.slate900,
                      }}
                    />
                  </View>

                  <View style={{ gap: space[6] }}>
                    <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: colors.slate700 }}>
                      Icon
                    </Text>
                    <View style={{ flexDirection: 'row', gap: space[8] }}>
                      {(Object.keys(ICONS) as QuickPickIcon[]).map((key) => {
                        const Icon = ICONS[key];
                        const selected = draft.icon === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            accessibilityRole="button"
                            accessibilityLabel={`Icon: ${key}`}
                            accessibilityState={{ selected }}
                            onPress={() => setDraft((d) => (d ? { ...d, icon: key } : d))}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 9,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: selected ? colors.slate900 : colors.slate100,
                            }}
                          >
                            <Icon size={16} color={selected ? colors.white : colors.slate600} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={{ gap: space[6] }}>
                    <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: colors.slate700 }}>
                      Destination
                    </Text>
                    <TextInput
                      value={draft.query}
                      onChangeText={(query) => setDraft((d) => (d ? { ...d, query, node: null } : d))}
                      accessibilityLabel="Search destinations"
                      placeholder="Search the road network for a named point"
                      placeholderTextColor={colors.slate400}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.slate200,
                        borderRadius: 10,
                        paddingHorizontal: space[12],
                        paddingVertical: space[10],
                        fontSize: fontSize.label,
                        color: colors.slate900,
                      }}
                    />
                    {draft.node ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space[6],
                          backgroundColor: colors.blue50,
                          borderRadius: 8,
                          paddingHorizontal: space[10],
                          paddingVertical: space[8],
                        }}
                      >
                        <MapPin size={13} color={colors.blue700} />
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: fontSize.body, fontWeight: '700', color: colors.blue700 }}
                        >
                          {draft.node.properties.name ?? 'Selected point'}
                        </Text>
                      </View>
                    ) : draft.pick ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}>
                        <MapPin size={13} color={colors.slate400} />
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: fontSize.caption, color: colors.slate500 }}
                        >
                          {currentName ? `Current: ${currentName}` : 'Current point saved'}. Search to move it.
                        </Text>
                      </View>
                    ) : null}
                    {results.map((node) => (
                      <TouchableOpacity
                        key={node.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Destination: ${node.properties.name}`}
                        onPress={() =>
                          setDraft((d) =>
                            d
                              ? { ...d, node, query: node.properties.name ?? '' }
                              : d,
                          )
                        }
                        style={{
                          paddingHorizontal: space[10],
                          paddingVertical: space[10],
                          borderRadius: 8,
                          backgroundColor: draft.node?.id === node.id ? colors.blue50 : colors.slate50,
                        }}
                      >
                        <Text style={{ fontSize: fontSize.body, color: colors.slate800 }}>
                          {node.properties.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {draft.query.trim().length > 0 && !draft.node && results.length === 0 ? (
                      <Text style={{ fontSize: fontSize.caption, color: colors.slate500 }}>
                        {network
                          ? 'No matching points on the road network.'
                          : 'The road network is unavailable. Try again when you are back online.'}
                      </Text>
                    ) : null}
                  </View>

                  {error ? (
                    <View
                      accessibilityRole="alert"
                      style={{ backgroundColor: colors.red50, borderRadius: 10, padding: space[10] }}
                    >
                      <Text style={{ fontSize: fontSize.body, color: colors.red700 }}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', gap: space[10] }}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Cancel editing"
                      disabled={busy}
                      onPress={cancelDraft}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.slate200,
                        borderRadius: 10,
                        paddingVertical: space[12],
                        opacity: busy ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: colors.slate700 }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={draft.pick ? 'Save Changes' : 'Add Quick Pick'}
                      disabled={!draftReady || busy}
                      onPress={requestSave}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: space[6],
                        backgroundColor: colors.slate900,
                        borderRadius: 10,
                        paddingVertical: space[12],
                        opacity: !draftReady || busy ? 0.5 : 1,
                      }}
                    >
                      {busy ? <ActivityIndicator size="small" color={colors.white} /> : null}
                      <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: colors.white }}>
                        {draft.pick ? 'Save Changes' : 'Add Quick Pick'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : picks.length === 0 ? (
                <View style={{ alignItems: 'center', gap: space[10], paddingVertical: space[20] }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.blue50,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MapPinOff size={28} color={colors.blue600} />
                  </View>
                  <Text style={{ fontSize: fontSize.heading, fontWeight: '800', color: colors.slate900 }}>
                    No Quick Picks Yet
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.body,
                      color: colors.slate500,
                      textAlign: 'center',
                      maxWidth: 280,
                    }}
                  >
                    Save your favorite destinations for faster access to safe routes.
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Add a Quick Pick"
                    onPress={openAdd}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[6],
                      backgroundColor: colors.slate900,
                      borderRadius: 10,
                      paddingHorizontal: space[20],
                      paddingVertical: space[12],
                      marginTop: space[4],
                    }}
                  >
                    <Plus size={16} color={colors.white} />
                    <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: colors.white }}>
                      Add a Quick Pick
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {error ? (
                    <View
                      accessibilityRole="alert"
                      style={{ backgroundColor: colors.red50, borderRadius: 10, padding: space[10] }}
                    >
                      <Text style={{ fontSize: fontSize.body, color: colors.red700 }}>{error}</Text>
                    </View>
                  ) : null}
                  {picks.map((pick) => {
                    const Icon = ICONS[pick.icon];
                    return (
                      <View
                        key={pick.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space[12],
                          borderWidth: 1,
                          borderColor: colors.slate200,
                          borderRadius: 12,
                          paddingHorizontal: space[12],
                          paddingVertical: space[10],
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: colors.blue50,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon size={18} color={colors.slate900} />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: fontSize.lead, fontWeight: '700', color: colors.slate900 }}
                        >
                          {pick.name}
                        </Text>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${pick.name}`}
                          onPress={() => openEdit(pick)}
                          hitSlop={8}
                          style={{ padding: space[4] }}
                        >
                          <Pencil size={16} color={colors.slate500} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${pick.name}`}
                          onPress={() => {
                            setError(null);
                            setConfirm({ kind: 'remove', pick });
                          }}
                          hitSlop={8}
                          style={{ padding: space[4] }}
                        >
                          <Trash2 size={16} color={colors.red600} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Add a Quick Pick"
                    onPress={openAdd}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: space[6],
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: colors.slate300,
                      borderRadius: 12,
                      paddingVertical: space[12],
                    }}
                  >
                    <Plus size={16} color={colors.blue600} />
                    <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: colors.blue600 }}>
                      Add a Quick Pick
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {confirm ? (
          <Pressable
            accessibilityLabel="Dismiss confirmation"
            onPress={() => {
              if (!busy) setConfirm(null);
            }}
            style={{
              ...StyleSheet.absoluteFill,
              backgroundColor: 'rgba(15,23,42,0.45)',
              justifyContent: 'center',
              padding: space[20],
            }}
          >
            <Pressable
              accessibilityViewIsModal
              onPress={() => {}}
              style={{
                width: '100%',
                maxWidth: 340,
                alignSelf: 'center',
                backgroundColor: colors.white,
                borderRadius: 18,
                padding: space[20],
                gap: space[12],
                shadowColor: colors.black,
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
                  backgroundColor: confirmRemove ? colors.red50 : colors.blue50,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {confirmRemove ? (
                  <AlertTriangle size={20} color={colors.red600} />
                ) : (
                  <MapPin size={20} color={colors.blue600} />
                )}
              </View>
              <Text style={{ fontSize: fontSize.heading, fontWeight: '800', color: colors.slate900 }}>
                {confirmRemove ? 'Remove Quick Pick?' : 'Save Changes?'}
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.slate500 }}>
                {confirmRemove
                  ? 'Are you sure you want to remove this destination from your Quick Picks? This action will remove it from your saved shortcuts.'
                  : "You're about to update this Quick Pick. Would you like to save your changes?"}
              </Text>
              <View style={{ flexDirection: 'row', gap: space[10], marginTop: space[4] }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={confirmRemove ? 'Keep It' : 'Cancel'}
                  disabled={busy}
                  onPress={() => setConfirm(null)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.slate200,
                    borderRadius: 10,
                    paddingVertical: space[12],
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: colors.slate700 }}>
                    {confirmRemove ? 'Keep It' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={confirmRemove ? 'Remove' : 'Confirm Save Changes'}
                  disabled={busy}
                  onPress={confirmRemove ? () => void submitRemove() : () => void submitDraft()}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: space[6],
                    backgroundColor: confirmRemove ? colors.red600 : colors.slate900,
                    borderRadius: 10,
                    paddingVertical: space[12],
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {busy ? <ActivityIndicator size="small" color={colors.white} /> : null}
                  <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: colors.white }}>
                    {confirmRemove ? 'Remove' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * Home-screen entry point: the saved destinations as tappable cards, plus a
 * Manage link into the modal above. Mirrors the pre-redesign section without
 * the live per-pick route/hazard status, which needed the driver's location.
 */
export function QuickPickList({ clearanceCm = 28 }: { clearanceCm?: number }) {
  const router = useRouter();
  const { c } = useTheme();
  const [picks, setPicks] = useState<QuickPick[] | null>(null);
  const [managing, setManaging] = useState(false);

  const refresh = useCallback(() => void listQuickPicks().then(setPicks), []);
  useFocusEffect(refresh);

  function closeManaging() {
    setManaging(false);
    // Edits/removals happen inside the modal, so re-read on the way out.
    refresh();
  }

  return (
    <View style={{ gap: space[10] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: fontSize.heading, fontWeight: '800', color: c.slate900 }}>Quick Picks</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Manage quick picks"
          onPress={() => setManaging(true)}
          hitSlop={8}
        >
          <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.blue600 }}>Manage</Text>
        </TouchableOpacity>
      </View>

      {picks === null ? null : picks.length === 0 ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add a quick pick"
          onPress={() => setManaging(true)}
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.slate300,
            padding: space[16],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[6],
          }}
        >
          <Plus size={18} color={c.slate400} />
          <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: c.slate500 }}>Add a Quick Pick</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[10] }}>
          {picks.map((pick) => {
            const Icon = ICONS[pick.icon];
            return (
              <TouchableOpacity
                key={pick.id}
                accessibilityRole="button"
                accessibilityLabel={`Route to ${pick.name}`}
                onPress={() =>
                  router.push({
                    pathname: '/route',
                    params: { destination: `${pick.latitude},${pick.longitude}` },
                  })
                }
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[10],
                  backgroundColor: c.white,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: c.slate200,
                  padding: space[12],
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    backgroundColor: c.blue50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={17} color={c.slate900} />
                </View>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontSize: fontSize.label, fontWeight: '700', color: c.slate900 }}
                >
                  {pick.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <QuickPicks visible={managing} onClose={closeManaging} clearanceCm={clearanceCm} />
    </View>
  );
}
