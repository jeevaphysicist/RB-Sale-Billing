import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, Edit, Trash2, CheckCircle2, XCircle, Search, Loader2, Power, BookOpen, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AlertModal from '../../../components/AlertModal';

const EMPTY_FORM = { mechanic_name: '', mobile_number: '', address: '', notes: '', status: 'Active' };
const PAGE_SIZE = 10;

const Index = () => {
  const navigate = useNavigate();
  const [mechanics, setMechanics] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, mechanic: null, loading: false });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchMechanics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await window.api.getMechanics({
        searchTerm: debouncedSearch,
        status: statusFilter,
        page,
        limit: PAGE_SIZE,
        sortKey: 'id',
        sortDirection: 'DESC'
      });
      if (response?.success) {
        setMechanics(response.data || []);
        setTotal(response.total || 0);
      } else {
        toast.error(response?.message || 'Failed to load mechanics');
      }
    } catch (error) {
      console.error('Error loading mechanics:', error);
      toast.error('Failed to load mechanics');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    fetchMechanics();
  }, [fetchMechanics]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (mechanic) => {
    setEditing(mechanic);
    setForm({
      mechanic_name: mechanic.mechanic_name || '',
      mobile_number: mechanic.mobile_number || '',
      address: mechanic.address || '',
      notes: mechanic.notes || '',
      status: mechanic.status || 'Active'
    });
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.mechanic_name.trim()) {
      toast.error('Mechanic name is required');
      return;
    }
    if (form.mobile_number.trim() && !/^\d{10}$/.test(form.mobile_number.trim())) {
      toast.error('Mobile number must be 10 digits');
      return;
    }
    try {
      setSaving(true);
      const response = editing
        ? await window.api.updateMechanic({ ...form, id: editing.id })
        : await window.api.createMechanic(form);
      if (response?.success) {
        toast.success(response.message);
        setFormOpen(false);
        fetchMechanics();
      } else {
        toast.error(response?.message || 'Failed to save mechanic');
      }
    } catch (error) {
      toast.error('Failed to save mechanic');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (mechanic) => {
    const next = mechanic.status === 'Active' ? 'Inactive' : 'Active';
    const response = await window.api.setMechanicStatus(mechanic.id, next);
    if (response?.success) {
      toast.success(response.message);
      fetchMechanics();
    } else {
      toast.error(response?.message || 'Failed to change status');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.mechanic) return;
    try {
      setDeleteModal((prev) => ({ ...prev, loading: true }));
      const response = await window.api.deleteMechanic(deleteModal.mechanic.id);
      if (response?.success) {
        toast.success(response.message);
        fetchMechanics();
      } else {
        toast.error(response?.message || 'Failed to delete mechanic', { duration: 6000 });
      }
    } catch (error) {
      toast.error('Failed to delete mechanic');
    } finally {
      setDeleteModal({ isOpen: false, mechanic: null, loading: false });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const thClass = 'px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide bg-gray-50 border-b border-gray-200 whitespace-nowrap';
  const tdClass = 'px-4 py-3 text-sm text-gray-800 border-b border-gray-100';
  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><Wrench className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mechanics</h1>
            <p className="text-sm text-gray-500">Mechanics who refer customers. Pick one as the referrer on a sale bill to see it in their ledger.</p>
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={20} /> Add Mechanic
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-gray-100">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, mobile, code..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline-block" /></div>
          ) : mechanics.length === 0 ? (
            <div className="py-16 text-center">
              <Wrench className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No mechanics found</h3>
              <p className="text-gray-500 mb-4 text-sm">Add your first mechanic to start tracking referrals.</p>
              <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus size={18} /> Add Mechanic
              </button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Code</th>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Mobile</th>
                  <th className={thClass}>Address</th>
                  <th className={`${thClass} text-right`}>Bills</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mechanics.map((mechanic, index) => (
                  <tr key={mechanic.id} className="hover:bg-gray-50">
                    <td className={tdClass}>{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className={`${tdClass} text-gray-600`}>{mechanic.mechanic_code}</td>
                    <td className={`${tdClass} font-medium`}>{mechanic.mechanic_name}</td>
                    <td className={tdClass}>{mechanic.mobile_number || '-'}</td>
                    <td className={`${tdClass} text-gray-600 max-w-[260px] truncate`}>{mechanic.address || '-'}</td>
                    <td className={`${tdClass} text-right`}>{mechanic.bill_count}</td>
                    <td className={tdClass}>
                      {mechanic.status === 'Active' ? (
                        <span className="flex items-center text-green-700 font-medium"><CheckCircle2 className="w-4 h-4 text-green-500 mr-1.5" /> Active</span>
                      ) : (
                        <span className="flex items-center text-red-700 font-medium"><XCircle className="w-4 h-4 text-red-500 mr-1.5" /> Inactive</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      <div className="flex gap-1">
                        <button onClick={() => navigate(`/reports/mechanics/${mechanic.id}`)} className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50" title="View ledger">
                          <BookOpen size={16} />
                        </button>
                        <button onClick={() => openEdit(mechanic)} className="p-1.5 rounded text-blue-600 hover:bg-blue-50" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => toggleStatus(mechanic)}
                          className={`p-1.5 rounded ${mechanic.status === 'Active' ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                          title={mechanic.status === 'Active' ? 'Make inactive' : 'Make active'}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, mechanic, loading: false })}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="px-4 py-3 flex items-center justify-between text-sm text-gray-600 border-t border-gray-100">
            <span>Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40">Previous</button>
              <span className="px-2 py-1.5">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSave} className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Mechanic' : 'Add Mechanic'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mechanic Name <span className="text-red-500">*</span></label>
                <input className={inputClass} value={form.mechanic_name} onChange={(e) => setForm({ ...form, mechanic_name: e.target.value })} placeholder="Enter mechanic name" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input className={inputClass} value={form.mobile_number} maxLength={10} onChange={(e) => setForm({ ...form, mobile_number: e.target.value.replace(/\D/g, '') })} placeholder="10-digit mobile number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, area, city (optional)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />} {editing ? 'Save Changes' : 'Add Mechanic'}
              </button>
            </div>
          </form>
        </div>
      )}

      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle="Delete Mechanic"
        message={`Delete "${deleteModal.mechanic?.mechanic_name || 'this mechanic'}"? Mechanics that are the referrer on any bill cannot be deleted - make them inactive instead.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, mechanic: null, loading: false })}
        loading={deleteModal.loading}
        buttonText="Delete"
      />
    </div>
  );
};

export default Index;
