"use client";

import { Shield, Trash2, Edit, Plus, Search, User as UserIcon, Mail, Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { listVehicles, type Vehicle } from "@/lib/dispatch";
import {
  createUser,
  deleteUser,
  listUsers,
  type User,
  type UserCreate,
  type UserUpdate,
  updateUser,
} from "@/lib/users";
import { useToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { ErrorNotice } from "./error-notice";
import { Skeleton } from "./skeleton";

export function UsersManagement() {
  const { show } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Vehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserCreate>({
    name: "",
    email: "",
    password: "",
    role: "LGU_DISPATCHER",
    vehicle_id: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setUsers(await listUsers());
      setLoadError(null);
    } catch {
      setLoadError("Could not load users. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createUser(formData);
      show("User created successfully");
      setIsCreateModalOpen(false);
      setFormData({ name: "", email: "", password: "", role: "LGU_DISPATCHER", vehicle_id: null });
      loadUsers();
    } catch (cause) {
      show(cause instanceof ApiError ? cause.message : "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const updateData: UserUpdate = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        vehicle_id: formData.vehicle_id ?? null,
      };
      await updateUser(editingUser.user_id, updateData);
      show("User updated successfully");
      setIsEditModalOpen(false);
      setEditingUser(null);
      setFormData({ name: "", email: "", password: "", role: "LGU_DISPATCHER", vehicle_id: null });
      loadUsers();
    } catch (cause) {
      show(cause instanceof ApiError ? cause.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!removing || removingBusy) return;
    setRemovingBusy(true);
    try {
      await deleteUser(removing.id);
      show("User deleted successfully");
      setRemoving(null);
      loadUsers();
    } catch (cause) {
      show(cause instanceof ApiError ? cause.message : "Failed to delete user");
    } finally {
      setRemovingBusy(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      vehicle_id: user.vehicle_id,
    });
    setIsEditModalOpen(true);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((data) => !cancelled && setUsers(data))
      .catch(
        () => !cancelled && setLoadError("Could not load users. Check your connection and retry."),
      )
      .finally(() => !cancelled && setLoading(false));
    listVehicles()
      .then((data) => !cancelled && setUnits(data))
      .catch(() => {
        // Without the fleet list the unit select is empty; accounts still work.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">User Management</h2>
          <p className="text-xs text-slate-500">Manage user accounts and roles (FSD-FR-048)</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {loadError && (
        <ErrorNotice
          message={loadError}
          onRetry={() => {
            setLoading(true);
            setLoadError(null);
            void loadUsers();
          }}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-left font-semibold text-slate-700">Name</th>
                <th className="pb-3 text-left font-semibold text-slate-700">Email</th>
                <th className="pb-3 text-left font-semibold text-slate-700">Role</th>
                <th className="pb-3 text-left font-semibold text-slate-700">Created</th>
                <th className="pb-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                [0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td colSpan={5} className="py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading && !loadError && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    {searchQuery
                      ? "No users match your search."
                      : "No users yet. Add the first one."}
                  </td>
                </tr>
              )}
              {filteredUsers.map((user) => (
                <tr key={user.user_id} className="border-b border-slate-50 last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                        <UserIcon className="h-4 w-4 text-slate-500" />
                      </div>
                      <span className="font-medium text-slate-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                  </td>
                  <td className="py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold",
                        user.role === "SUPER_ADMIN"
                          ? "bg-purple-100 text-purple-800"
                          : user.role === "LGU_DISPATCHER"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-emerald-100 text-emerald-800",
                      )}
                    >
                      <Shield className="h-3 w-3" />
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
                        title="Edit user"
                      >
                        <Edit className="h-3 w-3 text-slate-600" />
                      </button>
                      <button
                        onClick={() => setRemoving({ id: user.user_id, name: user.name })}
                        className="rounded border border-rose-200 bg-white px-2 py-1 hover:bg-rose-50"
                        title="Delete user"
                      >
                        <Trash2 className="h-3 w-3 text-rose-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-modal-in space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Create New User</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label
                  htmlFor="user-create-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Name
                </label>
                <input
                  id="user-create-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="user-create-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="user-create-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="user-create-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="user-create-password"
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="user-create-role"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Role
                </label>
                <select
                  id="user-create-role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as UserCreate["role"],
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                >
                  <option value="LGU_DISPATCHER">LGU Dispatcher</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="EMERGENCY_DRIVER">Emergency Driver</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="user-create-vehicle"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Rescue unit
                </label>
                <select
                  id="user-create-vehicle"
                  value={formData.vehicle_id ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vehicle_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                >
                  <option value="">Not linked</option>
                  {units.map((unit) => (
                    <option key={unit.vehicle_id} value={unit.vehicle_id}>
                      {unit.call_sign}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  A linked driver reports this unit&apos;s position and receives its dispatch.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-modal-in space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Edit User</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label
                  htmlFor="user-edit-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Name
                </label>
                <input
                  id="user-edit-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="user-edit-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="user-edit-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="user-edit-role"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Role
                </label>
                <select
                  id="user-edit-role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as UserCreate["role"],
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                >
                  <option value="LGU_DISPATCHER">LGU Dispatcher</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="EMERGENCY_DRIVER">Emergency Driver</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="user-edit-vehicle"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Rescue unit
                </label>
                <select
                  id="user-edit-vehicle"
                  value={formData.vehicle_id ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vehicle_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                >
                  <option value="">Not linked</option>
                  {units.map((unit) => (
                    <option key={unit.vehicle_id} value={unit.vehicle_id}>
                      {unit.call_sign}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  A linked driver reports this unit&apos;s position and receives its dispatch.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? "Updating..." : "Update User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {removing ? (
        <ConfirmDialog
          title={`Delete user "${removing.name}"?`}
          confirmLabel="Delete user"
          busy={removingBusy}
          onConfirm={() => void handleDelete()}
          onClose={() => setRemoving(null)}
        >
          Their sign-in is revoked immediately and the removal is recorded in the audit log. This
          cannot be undone.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
