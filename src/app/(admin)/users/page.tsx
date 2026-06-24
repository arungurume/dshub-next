'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import CustomSelect from '@/components/shared/CustomSelect';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Users, Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight,
  X, RefreshCw, ChevronLeft, ChevronRight, UserPlus
} from 'lucide-react';
import { umsApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';


// ─── Types ────────────────────────────────────────────────────────────────────

interface DSUser {
  id: number;
  firstName: string;
  lastName: string;
  userName: string;
  roles: { id: number; name: string }[];
  locationId: number;
  joinedDate: string;
  active: boolean;
}

interface Role { id: number; name: string }
interface Location { id: number; name: string }

// ─── Schemas ─────────────────────────────────────────────────────────────────

const userSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  userName: z.string().email('Valid email required'),
  roleId: z.string().min(1, 'Select a role'),
  locationId: z.string().min(1, 'Select a location'),
});
type UserForm = z.infer<typeof userSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function roleBadge(roleName: string) {
  const map: Record<string, string> = {
    ORGANIZATION_ADMIN: 'badge-purple',
    LOCATION_ADMIN: 'badge-blue',
  };
  return map[roleName] || 'badge-gray';
}

// ─── User Modal ───────────────────────────────────────────────────────────────

function UserModal({
  mode, initial, roles, locations, onClose, onSaved
}: {
  mode: 'add' | 'edit';
  initial?: DSUser;
  roles: Role[];
  locations: Location[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: initial?.firstName || '',
      lastName: initial?.lastName || '',
      userName: initial?.userName || '',
      roleId: String(initial?.roles?.[0]?.id || ''),
      locationId: String(initial?.locationId || ''),
    }
  });

  async function onSubmit(data: UserForm) {
    try {
      const payload = {
        ...data,
        roleId: Number(data.roleId),
        locationId: Number(data.locationId),
      };
      if (mode === 'add') {
        await umsApi.post('/user', payload);
        toast.success('User invited');
      } else {
        await umsApi.put('/user', { id: initial!.id, ...payload });
        toast.success('User updated successfully');
      }
      onSaved();
      onClose();
    } catch {
      toast.error(`Failed to ${mode === 'add' ? 'invite' : 'update'} user`);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'add' ? 'Invite New User' : 'Edit User'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="modal-body">
          <div className="form-row-2">
            <div className="form-group">
              <label>First Name</label>
              <input {...register('firstName')} placeholder="John" />
              {errors.firstName && <span className="field-error">{errors.firstName.message}</span>}
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input {...register('lastName')} placeholder="Doe" />
              {errors.lastName && <span className="field-error">{errors.lastName.message}</span>}
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input {...register('userName')} type="email" placeholder="john@company.com" />
            {errors.userName && <span className="field-error">{errors.userName.message}</span>}
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Role</label>
              <Controller
                name="roleId"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    {...field}
                    placeholder="Select role"
                    options={roles.map(r => ({ value: r.id, label: r.name.replace(/_/g, ' ') }))}
                  />
                )}
              />
              {errors.roleId && <span className="field-error">{errors.roleId.message}</span>}
            </div>
            <div className="form-group">
              <label>Location</label>
              <Controller
                name="locationId"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    {...field}
                    placeholder="Select location"
                    options={locations.map(l => ({ value: l.id, label: l.name }))}
                  />
                )}
              />
              {errors.locationId && <span className="field-error">{errors.locationId.message}</span>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting} id={`${mode}-user-submit`}>
              {isSubmitting ? <RefreshCw size={14} className="spin" /> : <UserPlus size={14} />}
              {mode === 'add' ? 'Send Invite' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, danger,
  onConfirm, onClose, loading
}: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="confirm-text">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            id="confirm-action-btn"
          >
            {loading ? <RefreshCw size={14} className="spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<DSUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [pagination, setPagination] = useState({ page: 0, size: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<DSUser | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; action: () => void; label: string; danger?: boolean;
  } | null>(null);

  // Load roles, locations, current user
  useEffect(() => {
    const cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
    setCurrentUser(cu);
    const role = localStorage.getItem('role') || '';
    setCurrentUserRole(role);

    umsApi.get('/user/role/list').then(({ data }) => setRoles(Array.isArray(data) ? data : [])).catch(() => {});
    umsApi.get('/location/list').then(({ data }) => {
      setLocations(data.locations || []);
    }).catch(() => {});
  }, []);

  // Load users
  const fetchUsers = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const { data } = await umsApi.get('/users', {
        params: { page, size: pagination.size, sortBy: 'updatedDate', sortOrder: 'DESC' }
      });
      const items: DSUser[] = (data.content || []).map((u: any) => ({
        ...u,
        name: `${u.firstName} ${u.lastName}`,
        date: formatDate(u.joinedDate),
        disable: u.id === currentUser?.id,
      }));
      setUsers(items);
      setPagination(p => ({ ...p, page, total: data.totalElements || items.length }));
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, pagination.size, currentUser?.id]);

  useEffect(() => { fetchUsers(0); }, [search]);

  function getLocationName(id: number) {
    return locations.find(l => l.id === id)?.name || '—';
  }

  // ── Delete ──
  function confirmDelete(user: DSUser) {
    setConfirmModal({
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.firstName} ${user.lastName}?`,
      label: 'Delete',
      danger: true,
      action: async () => {
        setActionLoading(true);
        try {
          await umsApi.delete(`/user/${user.id}`);
          toast.success('User deleted');
          fetchUsers(pagination.page);
        } catch { toast.error('Failed to delete user'); }
        finally { setActionLoading(false); setConfirmModal(null); }
      }
    });
  }

  // ── Enable/Disable ──
  function confirmToggle(user: DSUser) {
    const enabling = !user.active;
    setConfirmModal({
      title: enabling ? 'Enable User' : 'Disable User',
      message: `Are you sure you want to ${enabling ? 'enable' : 'disable'} ${user.firstName} ${user.lastName}?`,
      label: enabling ? 'Enable' : 'Disable',
      action: async () => {
        setActionLoading(true);
        try {
          await umsApi.put(`/user/${user.id}/status/${enabling}`, null);
          toast.success(`User ${enabling ? 'enabled' : 'disabled'}`);
          fetchUsers(pagination.page);
        } catch { toast.error('Failed to update user status'); }
        finally { setActionLoading(false); setConfirmModal(null); }
      }
    });
  }

  const isAdmin = currentUserRole === 'ORGANIZATION_ADMIN';
  const isLocAdmin = currentUserRole === 'LOCATION_ADMIN';
  const totalPages = Math.ceil(pagination.total / pagination.size);

  return (
    <div className="users-page">
      {/* Top bar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <Users size={20} />
          <h1 className="page-title">{t('MENUITEMS.SIDEBAR.users')}</h1>
          <span className="count-badge">{pagination.total}</span>
        </div>
        <div className="toolbar-right">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input
              id="users-search"
              className="search-input"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isAdmin && (
            <button className="btn-primary" onClick={() => setShowAddModal(true)} id="invite-user-btn">
              <Plus size={14} />
              Invite User
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading">
            <RefreshCw size={20} className="spin" />
            <span>Loading users…</span>
          </div>
        ) : users.length === 0 ? (
          <div className="table-empty">
            <Users size={40} opacity={.3} />
            <p>No users found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Location</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={!u.active ? 'row-inactive' : ''}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-sm">
                        {`${u.firstName?.charAt(0)}${u.lastName?.charAt(0)}`.toUpperCase()}
                      </div>
                      <span>{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td className="text-muted">{u.userName}</td>
                  <td>{getLocationName(u.locationId)}</td>
                  <td>
                    {u.roles?.[0] ? (
                      <span className={`badge ${roleBadge(u.roles[0].name)}`}>
                        {u.roles[0].name.replace(/_/g, ' ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-muted">{formatDate(u.joinedDate)}</td>
                  <td>
                    <span className={`status-pill ${u.active ? 'status-active' : 'status-inactive'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      {isAdmin && (
                        <>
                          <button
                            className="action-btn" title="Edit"
                            onClick={() => setEditUser(u)}
                            disabled={u.id === currentUser?.id}
                            id={`edit-user-${u.id}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="action-btn action-danger" title="Delete"
                            onClick={() => confirmDelete(u)}
                            disabled={u.id === currentUser?.id}
                            id={`delete-user-${u.id}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                      {(isAdmin || isLocAdmin) && (
                        <button
                          className="action-btn" title={u.active ? 'Disable' : 'Enable'}
                          onClick={() => confirmToggle(u)}
                          disabled={u.id === currentUser?.id}
                          id={`toggle-user-${u.id}`}
                        >
                          {u.active ? <ToggleRight size={15} style={{ color: '#22c55e' }} /> : <ToggleLeft size={15} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="table-pagination">
            <span className="page-info">
              Page {pagination.page + 1} of {totalPages} · {pagination.total} users
            </span>
            <div className="page-btns">
              <button
                className="page-btn"
                disabled={pagination.page === 0}
                onClick={() => fetchUsers(pagination.page - 1)}
                id="prev-page-btn"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="page-btn"
                disabled={pagination.page >= totalPages - 1}
                onClick={() => fetchUsers(pagination.page + 1)}
                id="next-page-btn"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <UserModal mode="add" roles={roles} locations={locations}
          onClose={() => setShowAddModal(false)} onSaved={() => fetchUsers(0)} />
      )}
      {editUser && (
        <UserModal mode="edit" initial={editUser} roles={roles} locations={locations}
          onClose={() => setEditUser(null)} onSaved={() => fetchUsers(pagination.page)} />
      )}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.label}
          danger={confirmModal.danger}
          onConfirm={confirmModal.action}
          onClose={() => setConfirmModal(null)}
          loading={actionLoading}
        />
      )}

      <style>{`
        .users-page { padding: 1.5rem 2rem; }

        /* Toolbar */
        .page-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1.25rem; gap: 1rem; flex-wrap: wrap;
        }
        .toolbar-left { display: flex; align-items: center; gap: .75rem; }
        .page-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
        .count-badge {
          background: var(--accent); color: white;
          font-size: .7rem; font-weight: 700; padding: .2rem .6rem;
          border-radius: 999px;
        }
        .toolbar-right { display: flex; align-items: center; gap: .75rem; }
        .search-wrap { position: relative; }
        .search-icon { position: absolute; left: .75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .search-input {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: .6rem 1rem .6rem 2.25rem;
          font-size: .875rem; color: var(--text); outline: none; width: 240px;
        }
        .search-input:focus { border-color: var(--accent); }

        /* Table card */
        .table-card {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 16px; overflow: hidden;
        }
        .table-loading, .table-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: .75rem; padding: 3rem; color: var(--text-muted);
        }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
          text-align: left; padding: .875rem 1rem;
          font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
          color: var(--text-muted); border-bottom: 1px solid var(--border);
          background: var(--sidebar-bg);
        }
        .data-table td {
          padding: .875rem 1rem; font-size: .875rem;
          border-bottom: 1px solid var(--border); color: var(--text);
        }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: var(--sidebar-hover); }
        .row-inactive td { opacity: .5; }
        .text-muted { color: var(--text-muted); }

        /* User cell */
        .user-cell { display: flex; align-items: center; gap: .5rem; }
        .user-avatar-sm {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          background: var(--btn-cta-bg);
          color: white; font-size: .65rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }

        /* Badges */
        .badge { font-size: .7rem; font-weight: 600; padding: .25rem .65rem; border-radius: 999px; display: inline-block; }
        .badge-purple { background: #ede9fe; color: #7c3aed; }
        .badge-blue { background: #dbeafe; color: #1d4ed8; }
        .badge-gray { background: #f3f4f6; color: #6b7280; }

        /* Status */
        .status-pill { font-size: .7rem; font-weight: 600; padding: .25rem .65rem; border-radius: 999px; }
        .status-active { background: #dcfce7; color: #16a34a; }
        .status-inactive { background: #fee2e2; color: #dc2626; }

        /* Action row */
        .action-row { display: flex; align-items: center; gap: .25rem; }
        .action-btn {
          width: 28px; height: 28px; border-radius: 6px; border: none;
          background: transparent; cursor: pointer; color: var(--text-muted);
          display: flex; align-items: center; justify-content: center;
          transition: all .15s;
        }
        .action-btn:hover { background: var(--sidebar-hover); color: var(--text); }
        .action-btn.action-danger:hover { background: #fee2e2; color: #dc2626; }
        .action-btn:disabled { opacity: .3; cursor: not-allowed; }

        /* Pagination */
        .table-pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: .875rem 1rem; border-top: 1px solid var(--border);
        }
        .page-info { font-size: .8rem; color: var(--text-muted); }
        .page-btns { display: flex; gap: .25rem; }
        .page-btn {
          width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--card-bg); cursor: pointer; color: var(--text);
          display: flex; align-items: center; justify-content: center;
        }
        .page-btn:disabled { opacity: .4; cursor: not-allowed; }
        .page-btn:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.5);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .modal-box {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 18px; width: 520px; max-width: 95vw;
          box-shadow: 0 24px 64px rgba(0,0,0,.4);
          animation: modal-in .2s ease;
        }
        .confirm-box { width: 380px; }
        @keyframes modal-in { from { opacity:0; transform: scale(.95) translateY(8px); } }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
        }
        .modal-header h3 { font-size: 1rem; font-weight: 700; margin: 0; }
        .modal-close { border: none; background: none; cursor: pointer; color: var(--text-muted); }
        .modal-body { padding: 1.5rem; }
        .modal-footer {
          padding: 1rem 1.5rem; border-top: 1px solid var(--border);
          display: flex; justify-content: flex-end; gap: .75rem;
        }
        .confirm-text { color: var(--text-muted); font-size: .9rem; margin: 0; }
        .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: .4rem; margin-bottom: .875rem; }
        .form-group label { font-size: .75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }
        .form-group input, .form-group select {
          background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: .65rem 1rem; font-size: .875rem; color: var(--text);
          outline: none;
        }
        .form-group input:focus, .form-group select:focus { border-color: var(--accent); }
        .field-error { font-size: .75rem; color: #ef4444; }
        .btn-primary {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none;
          padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease;
        }
        .btn-primary:hover { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .btn-ghost {
          background: transparent; border: 1px solid var(--border); color: var(--text);
          padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; cursor: pointer;
        }
        .btn-ghost:hover { border-color: var(--text-muted); }
        .btn-danger {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--btn-danger-bg); color: white; border: none;
          padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 2px 8px rgba(239,68,68,0.2); transition: all 0.2s ease;
        }
        .btn-danger:hover { background: var(--btn-danger-hover); }
        .btn-danger:disabled { opacity: .55; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
