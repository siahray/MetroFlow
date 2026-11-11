import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Bike, Car, CarFront, Check, Gauge, Pencil, Plus, Trash2, Truck, X } from 'lucide-react-native';

import { useDialog } from './Dialog';
import {
  getActiveVehicleId,
  listGarageVehicles,
  saveGarageVehicles,
  setActiveVehicleId,
  type GarageVehicle,
  type VehicleType,
} from '../myVehicle';
import { fontSize, space, useTheme } from '../theme';

const TYPE_ICON: Record<VehicleType, typeof Car> = { motorcycle: Bike, sedan: Car, suv: CarFront, truck: Truck };
const TYPE_LABEL: Record<VehicleType, string> = {
  motorcycle: 'Motorcycle',
  sedan: 'Sedan',
  suv: 'SUV / Van',
  truck: 'Truck',
};

/** In-progress add/edit form. `vehicle` is null while creating a new one. */
type Draft = { vehicle: GarageVehicle | null; name: string; type: VehicleType; clearance: string };

export function VehicleGarage({ onActiveChange }: { onActiveChange?: () => void }) {
  const { c } = useTheme();
  const { confirm } = useDialog();
  const [vehicles, setVehicles] = useState<GarageVehicle[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    void Promise.all([listGarageVehicles(), getActiveVehicleId()]).then(([list, active]) => {
      setVehicles(list);
      setActiveId(active ?? list[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function selectVehicle(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    await setActiveVehicleId(id);
    onActiveChange?.();
  }

  function openAdd() {
    setDraft({ vehicle: null, name: '', type: 'sedan', clearance: '28' });
  }

  function openEdit(vehicle: GarageVehicle) {
    setDraft({ vehicle, name: vehicle.name, type: vehicle.type, clearance: String(vehicle.clearanceCm) });
  }

  async function removeVehicle(target: GarageVehicle) {
    const ok = await confirm({
      title: 'Remove vehicle?',
      message: `Remove "${target.name}" from your garage? This cannot be undone.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Keep It',
      tone: 'danger',
      destructive: true,
    });
    if (!ok) return;
    const next = (vehicles ?? []).filter((v) => v.id !== target.id);
    await saveGarageVehicles(next);
    setVehicles(next);
    if (activeId === target.id) {
      const nextActive = next[0]?.id ?? null;
      setActiveId(nextActive);
      if (nextActive) await setActiveVehicleId(nextActive);
    }
    onActiveChange?.();
  }

  async function submitDraft() {
    if (!draft) return;
    const name = draft.name.trim();
    const clearance = Math.round(Number(draft.clearance));
    if (!name || !Number.isFinite(clearance) || clearance <= 0) return;

    const list = vehicles ?? [];
    let next: GarageVehicle[];
    let nextActive = activeId;
    if (draft.vehicle) {
      const id = draft.vehicle.id;
      next = list.map((v) => (v.id === id ? { ...v, name, type: draft.type, clearanceCm: clearance } : v));
    } else {
      const created: GarageVehicle = { id: `${Date.now()}`, name, type: draft.type, clearanceCm: clearance };
      next = [...list, created];
      // The first saved vehicle becomes active automatically; later ones need a tap.
      if (!nextActive) nextActive = created.id;
    }

    setSaving(true);
    try {
      await saveGarageVehicles(next);
      setVehicles(next);
      if (nextActive !== activeId) {
        setActiveId(nextActive);
        await setActiveVehicleId(nextActive!);
      }
      setDraft(null);
      onActiveChange?.();
    } finally {
      setSaving(false);
    }
  }

  if (vehicles === null) return null;

  return (
    <View style={{ gap: space[10] }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space[10], paddingRight: space[4] }}
      >
        {vehicles.map((vehicle) => {
          const Icon = TYPE_ICON[vehicle.type];
          const active = vehicle.id === activeId;
          return (
            <TouchableOpacity
              key={vehicle.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${vehicle.name}${active ? ', active' : ''}`}
              onPress={() => void selectVehicle(vehicle.id)}
              onLongPress={() => openEdit(vehicle)}
              style={{
                width: 134,
                borderRadius: 14,
                borderWidth: active ? 2 : 1,
                borderColor: active ? c.slate900 : c.slate200,
                backgroundColor: active ? c.slate50 : c.white,
                padding: space[12],
                gap: space[6],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    backgroundColor: active ? c.slate900 : c.slate100,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} color={active ? c.white : c.slate600} />
                </View>
                {active ? (
                  <Check size={14} color={c.green600} />
                ) : (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${vehicle.name}`}
                    onPress={() => openEdit(vehicle)}
                    hitSlop={8}
                  >
                    <Pencil size={12} color={c.slate400} />
                  </TouchableOpacity>
                )}
              </View>
              <Text numberOfLines={1} style={{ fontSize: fontSize.label, fontWeight: '800', color: c.slate900 }}>
                {vehicle.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
                <Gauge size={11} color={c.slate400} />
                <Text style={{ fontSize: fontSize.caption, color: c.slate500 }}>
                  Clearance: {vehicle.clearanceCm} cm
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add new vehicle"
          onPress={openAdd}
          style={{
            width: 134,
            borderRadius: 14,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.slate300,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[6],
            padding: space[12],
          }}
        >
          <Plus size={20} color={c.slate400} />
          <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: c.slate500 }}>Add New Vehicle</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={draft !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!saving) setDraft(null);
        }}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityLabel="Dismiss"
            onPress={() => !saving && setDraft(null)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)' }}
          />
          <View style={{ flex: 1, justifyContent: 'center', padding: space[20] }} pointerEvents="box-none">
            <View
              style={{
                backgroundColor: c.surfaceHigh,
                borderWidth: 1,
                borderColor: c.slate200,
                borderRadius: 18,
                padding: space[20],
                gap: space[14],
                shadowColor: c.black,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 24,
                elevation: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: fontSize.heading, fontWeight: '800', color: c.slate900 }}>
                  {draft?.vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setDraft(null)}
                  hitSlop={8}
                >
                  <X size={20} color={c.slate500} />
                </TouchableOpacity>
              </View>

              <TextInput
                value={draft?.name ?? ''}
                onChangeText={(value) => setDraft((d) => d && { ...d, name: value })}
                placeholder="Name (e.g. Daily Commuter)"
                placeholderTextColor={c.slate400}
                style={{
                  borderWidth: 1,
                  borderColor: c.slate200,
                  borderRadius: 10,
                  padding: space[10],
                  fontSize: fontSize.label,
                  color: c.slate900,
                }}
              />

              <View style={{ flexDirection: 'row', gap: space[8] }}>
                {(Object.keys(TYPE_ICON) as VehicleType[]).map((type) => {
                  const Icon = TYPE_ICON[type];
                  const selected = draft?.type === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      accessibilityRole="button"
                      accessibilityLabel={TYPE_LABEL[type]}
                      onPress={() => setDraft((d) => d && { ...d, type })}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: space[4],
                        paddingVertical: space[10],
                        borderRadius: 10,
                        backgroundColor: selected ? c.slate900 : c.slate100,
                      }}
                    >
                      <Icon size={16} color={selected ? c.white : c.slate600} />
                      <Text
                        style={{
                          fontSize: fontSize.tiny,
                          fontWeight: '700',
                          color: selected ? c.white : c.slate600,
                        }}
                      >
                        {TYPE_LABEL[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
                <TextInput
                  value={draft?.clearance ?? ''}
                  onChangeText={(value) => setDraft((d) => d && { ...d, clearance: value })}
                  keyboardType="number-pad"
                  placeholder="28"
                  placeholderTextColor={c.slate400}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: c.slate200,
                    borderRadius: 10,
                    padding: space[10],
                    fontSize: fontSize.label,
                    color: c.slate900,
                  }}
                />
                <Text style={{ fontSize: fontSize.body, color: c.slate500 }}>cm clearance</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: space[10], marginTop: space[4] }}>
                {draft?.vehicle ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Remove this vehicle"
                    onPress={() => {
                      const target = draft.vehicle!;
                      setDraft(null);
                      void removeVehicle(target);
                    }}
                    style={{
                      width: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: c.red200,
                      borderRadius: 10,
                    }}
                  >
                    <Trash2 size={16} color={c.red600} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  onPress={() => setDraft(null)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: c.slate200,
                    borderRadius: 10,
                    paddingVertical: space[12],
                  }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: c.slate700 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Save vehicle"
                  disabled={saving || !draft?.name.trim()}
                  onPress={() => void submitDraft()}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    borderRadius: 10,
                    paddingVertical: space[12],
                    backgroundColor: c.slate900,
                    opacity: saving || !draft?.name.trim() ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: '800', color: c.white }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
