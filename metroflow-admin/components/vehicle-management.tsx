"use client";

import { Trash2, Edit, Plus, Search, Truck } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { listVehicles, type Vehicle, type VehicleCreate } from "@/lib/dispatch";
import { useToast } from "./toast-provider";
import { ErrorNotice } from "./error-notice";
import { Skeleton } from "./skeleton";

export function VehicleManagement() {
  const { show } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<VehicleCreate>({
    call_sign: "",
    vehicle_type: "RESCUE_BOAT",
    clearance_cm: 50,
    status: "AVAILABLE",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVehicles = async () => {
    try {
      setVehicles(await listVehicles());
      setLoadError(null);
    } catch {
      setLoadError("Could not load vehicles. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/vehicles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Failed to create vehicle");
      show("Vehicle created successfully");
      setIsCreateModalOpen(false);
      setFormData({
        call_sign: "",
        vehicle_type: "RESCUE_BOAT",
        clearance_cm: 50,
        status: "AVAILABLE",
      });
      loadVehicles();
    } catch {
      show("Failed to create vehicle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/vehicles/${editingVehicle.vehicle_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(formData),
        },
      );
      if (!response.ok) throw new Error("Failed to update vehicle");
      show("Vehicle updated successfully");
      setIsEditModalOpen(false);
      setEditingVehicle(null);
      setFormData({
        call_sign: "",
        vehicle_type: "RESCUE_BOAT",
        clearance_cm: 50,
        status: "AVAILABLE",
      });
      loadVehicles();
    } catch {
      show("Failed to update vehicle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (vehicleId: number, callSign: string) => {
    if (!confirm(`Are you sure you want to delete vehicle "${callSign}"?`)) return;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/vehicles/${vehicleId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to delete vehicle");
      }
      show("Vehicle deleted successfully");
      loadVehicles();
    } catch {
      show("Failed to delete vehicle");
    }
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      call_sign: vehicle.call_sign,
      vehicle_type: vehicle.vehicle_type,
      clearance_cm: vehicle.clearance_cm || 50,
      status: vehicle.status,
    });
    setIsEditModalOpen(true);
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.call_sign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vehicle_type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    const load = async () => {
      try {
        setVehicles(await listVehicles());
        setLoadError(null);
      } catch {
        setLoadError("Could not load vehicles. Check your connection and retry.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      {loadError && <ErrorNotice message={loadError} onRetry={loadVehicles} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Fleet Management</h2>
          <p className="text-sm text-slate-500">Add, edit, and remove rescue units</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Vehicle
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search vehicles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        />
      </div>

      {/* Vehicle List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Truck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No vehicles found</p>
          <p className="text-xs text-slate-500">Add your first rescue unit to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.vehicle_id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-slate-900">{vehicle.call_sign}</p>
                  <p className="text-xs text-slate-500">{vehicle.vehicle_type}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
                    vehicle.status === "AVAILABLE"
                      ? "bg-emerald-100 text-emerald-800"
                      : vehicle.status === "DISPATCHED"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-slate-200 text-slate-600",
                  )}
                >
                  {vehicle.status}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-slate-400 uppercase">Clearance</p>
                  <p className="font-semibold text-slate-800">
                    {vehicle.clearance_cm != null ? `${vehicle.clearance_cm} cm` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase">Speed</p>
                  <p className="font-semibold text-slate-800">
                    {vehicle.speed_kmh != null ? `${vehicle.speed_kmh} km/h` : "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(vehicle)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(vehicle.vehicle_id, vehicle.call_sign)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Add Vehicle</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Call Sign</label>
                <input
                  type="text"
                  required
                  value={formData.call_sign}
                  onChange={(e) => setFormData({ ...formData, call_sign: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  placeholder="e.g., RU-01"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Vehicle Type
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vehicle_type: e.target.value as
                        "RESCUE_BOAT" | "AMBULANCE" | "FIRE_TRUCK" | "PATROL",
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option value="RESCUE_BOAT">Rescue Boat</option>
                  <option value="AMBULANCE">Ambulance</option>
                  <option value="FIRE_TRUCK">Fire Truck</option>
                  <option value="PATROL">Patrol Unit</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Clearance (cm)
                </label>
                <input
                  type="number"
                  required
                  value={formData.clearance_cm}
                  onChange={(e) =>
                    setFormData({ ...formData, clearance_cm: parseInt(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as "AVAILABLE" | "OUT_OF_SERVICE",
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="OUT_OF_SERVICE">Out of Service</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Edit Vehicle</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Call Sign</label>
                <input
                  type="text"
                  required
                  value={formData.call_sign}
                  onChange={(e) => setFormData({ ...formData, call_sign: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Vehicle Type
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vehicle_type: e.target.value as
                        "RESCUE_BOAT" | "AMBULANCE" | "FIRE_TRUCK" | "PATROL",
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option value="RESCUE_BOAT">Rescue Boat</option>
                  <option value="AMBULANCE">Ambulance</option>
                  <option value="FIRE_TRUCK">Fire Truck</option>
                  <option value="PATROL">Patrol Unit</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Clearance (cm)
                </label>
                <input
                  type="number"
                  required
                  value={formData.clearance_cm}
                  onChange={(e) =>
                    setFormData({ ...formData, clearance_cm: parseInt(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as "AVAILABLE" | "DISPATCHED" | "OUT_OF_SERVICE",
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="DISPATCHED">Dispatched</option>
                  <option value="OUT_OF_SERVICE">Out of Service</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
