import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  Users, Search, Shield, UserCheck, UserX, Loader2, 
  ChevronRight, AlertCircle, CheckCircle2, ShieldAlert
} from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/', {
        params: {
          search: search || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined
        }
      });
      setUsers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      await api.put(`/users/${userId}/role`, null, { params: { role: newRole } });
      fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setUpdatingId(userId);
    try {
      await api.put(`/users/${userId}/status`, null, { params: { status_in: newStatus } });
      fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">User Governance & Access Control</h1>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form 
          onSubmit={(e) => { e.preventDefault(); fetchUsers(); }}
          className="relative flex-1 max-w-md w-full"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or corporate email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0] transition-all"
          />
        </form>

        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30 text-gray-700"
          >
            <option value="">All Roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30 text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#007bc0]" size={36} />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No users found matching your search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Auth Provider</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#007bc0] text-white flex items-center justify-center font-bold text-xs">
                          {u.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{u.name}</div>
                          <div className="text-[11px] text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-600">
                      {u.auth_provider}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                        u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                        u.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {updatingId === u.id ? (
                          <Loader2 size={16} className="animate-spin text-[#007bc0]" />
                        ) : (
                          <>
                            <button
                              onClick={() => handleRoleChange(u.id, u.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-[11px] transition-all"
                            >
                              Set as {u.role === 'ADMIN' ? 'USER' : 'ADMIN'}
                            </button>
                            <button
                              onClick={() => handleStatusChange(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                              className={`px-2.5 py-1 font-semibold rounded-lg text-[11px] transition-all ${
                                u.status === 'ACTIVE' 
                                  ? 'bg-red-50 hover:bg-red-100 text-red-600' 
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
