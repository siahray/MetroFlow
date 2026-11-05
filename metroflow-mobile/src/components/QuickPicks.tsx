import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  Home,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react-native';

import { getNetworkState, getRoute, type NetworkState, type NodeFeature } from '../api';
import { listQuickPicks, saveQuickPicks, type QuickPick, type QuickPickIcon } from '../quickPicks';
import { formatDistance, nearestNode, type LatLng } from '../navigation/geo';
import { colors } from '../theme';

const ICONS: Record<QuickPickIcon, typeof Home> = {
  home: Home,
  work: Building2,
  gym: Dumbbell,
  mall: ShoppingBag,
  hospital: HeartPulse,
  other: Building2,
};

type RouteStatus =
  | { state: 'loading' }
  | { state: 'clear'; distanceM: number }
  | { state: 'hazard'; distanceM: number; hazardName: string }
  | { state: 'error' };

const card = {
  backgroundColor: colors.white,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.slate200,
} as const;

export function QuickPicks({ clearanceCm, position }: { clearanceCm: number; position: LatLng | null }) {
  const router = useRouter();
  const [picks, setPicks] = useState<QuickPick[] | null>(null);
  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [status, setStatus] = useState<Record<string, RouteStatus>>({});
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<NodeFeature | null>(null);
  const [iconChoice, setIconChoice] = useState<QuickPickIcon>('other');

  useEffect(() => {
    void listQuickPicks().then(setPicks);
    void getNetworkState(clearanceCm).then(setNetwork).catch(() => setNetwork(null));
  }, [clearanceCm]);

  const startNode = position && network ? nearestNode(network.nodes.features, position) : null;

  useEffect(() => {
    if (!picks || !startNode) return;
    for (const pick of picks) {
      getRoute({ start_node: startNode.properties.node_id, target_node: pick.nodeId, clearance_cm: clearanceCm })
        .then((route) => {
          const blocking = route.hazards.find((h) => h.blocking);
          setStatus((prev) => ({
            ...prev,
            [pick.id]: blocking
              ? { state: 'hazard', distanceM: route.total_distance_m, hazardName: blocking.name }
              : { state: 'clear', distanceM: route.total_distance_m },
          }));
        })
        .catch(() => setStatus((prev) => ({ ...prev, [pick.id]: { state: 'error' } })));
    }
    // Re-run only when the saved list, the start node, or clearance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, startNode?.properties.node_id, clearanceCm]);

  const addPick = useCallback(async () => {
    if (!selectedNode || !nameInput.trim()) return;
    const [longitude, latitude] = selectedNode.geometry.coordinates;
    const next: QuickPick = {
      id: `${Date.now()}`,
      name: nameInput.trim(),
      nodeId: selectedNode.properties.node_id,
      latitude,
      longitude,
      icon: iconChoice,
    };
    const updated = [...(picks ?? []), next];
    setPicks(updated);
    await saveQuickPicks(updated);
    setAdding(false);
    setNameInput('');
    setQuery('');
    setSelectedNode(null);
    setIconChoice('other');
  }, [selectedNode, nameInput, iconChoice, picks]);

  const removePick = useCallback(
    async (id: string) => {
      const updated = (picks ?? []).filter((p) => p.id !== id);
      setPicks(updated);
      await saveQuickPicks(updated);
    },
    [picks],
  );

  const results =
    query.trim().length > 0 && network
      ? network.nodes.features
          .filter((n) => (n.properties.name ?? '').toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 6)
      : [];

  if (picks === null) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.slate900 }}>Quick Picks</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Manage quick picks"
          onPress={() => setManaging(true)}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue600 }}>Custom Pins</Text>
        </TouchableOpacity>
      </View>

      {picks.length === 0 ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add a quick pick"
          onPress={() => {
            setManaging(true);
            setAdding(true);
          }}
          style={{
            ...card,
            borderStyle: 'dashed',
            padding: 20,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Plus size={20} color={colors.slate400} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate500 }}>Add a quick pick</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {picks.map((pick) => {
            const Icon = ICONS[pick.icon];
            const s = status[pick.id] ?? { state: 'loading' };
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
                style={{ ...card, flexBasis: '47%', flexGrow: 1, padding: 14, gap: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: colors.blue50,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color={colors.slate900} />
                  </View>
                  {(s.state === 'clear' || s.state === 'hazard') && (
                    <View style={{ backgroundColor: colors.slate100, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.slate700 }}>
                        {formatDistance(s.distanceM)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate900 }} numberOfLines={1}>
                  {pick.name}
                </Text>
                {s.state === 'clear' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={13} color={colors.green600} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.green700 }}>Clear</Text>
                  </View>
                ) : s.state === 'hazard' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={13} color={colors.red600} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.red600 }} numberOfLines={1}>
                      {s.hazardName}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.slate400 }}>
                    {s.state === 'error' ? 'No route found' : 'Checking…'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Modal visible={managing} animationType="slide" transparent onRequestClose={() => setManaging(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.slate900 }}>Custom Pins</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => {
                  setManaging(false);
                  setAdding(false);
                }}
              >
                <X size={20} color={colors.slate500} />
              </TouchableOpacity>
            </View>

            {(picks ?? []).map((pick) => (
              <View
                key={pick.id}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.slate100 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate800 }}>{pick.name}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${pick.name}`} onPress={() => removePick(pick.id)}>
                  <Trash2 size={16} color={colors.red600} />
                </TouchableOpacity>
              </View>
            ))}

            {adding ? (
              <View style={{ gap: 10, marginTop: 14 }}>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Name (e.g. Work HQ)"
                  placeholderTextColor={colors.slate400}
                  style={{ borderWidth: 1, borderColor: colors.slate200, borderRadius: 10, padding: 10, fontSize: 13 }}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(Object.keys(ICONS) as QuickPickIcon[]).map((key) => {
                    const Icon = ICONS[key];
                    const selected = iconChoice === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        accessibilityRole="button"
                        accessibilityLabel={`Icon: ${key}`}
                        onPress={() => setIconChoice(key)}
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
                <TextInput
                  value={query}
                  onChangeText={(v) => {
                    setQuery(v);
                    setSelectedNode(null);
                  }}
                  placeholder="Search the road network for a named point"
                  placeholderTextColor={colors.slate400}
                  style={{ borderWidth: 1, borderColor: colors.slate200, borderRadius: 10, padding: 10, fontSize: 13 }}
                />
                {results.map((node) => (
                  <TouchableOpacity
                    key={node.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedNode(node);
                      setQuery(node.properties.name ?? '');
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: selectedNode?.id === node.id ? colors.blue50 : colors.slate50,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.slate800 }}>{node.properties.name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Save quick pick"
                  disabled={!selectedNode || !nameInput.trim()}
                  onPress={addPick}
                  style={{
                    backgroundColor: colors.slate900,
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: 'center',
                    opacity: !selectedNode || !nameInput.trim() ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.white }}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add a new quick pick"
                onPress={() => setAdding(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 }}
              >
                <Plus size={16} color={colors.blue600} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.blue600 }}>Add a quick pick</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
