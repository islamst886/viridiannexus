import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import AdminSidebar from '../../components/AdminSidebar';
import { useGlobalState } from '../../context/GlobalState';
import { Loader2, Search, Shield, ShieldAlert, UserX, UserCheck, Settings } from 'lucide-react';
import { toast } from 'react-toastify';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { userProfile } = useGlobalState();
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleBan = async (user) => {
    if (user.role === 'super_admin') {
      toast.error("Cannot ban a super admin.");
      return;
    }
    const newStatus = !user.isBanned;
    try {
      await updateDoc(doc(db, 'users', user.id), {
        isBanned: newStatus,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: userProfile.uid
      });
      toast.success(newStatus ? 'User banned successfully' : 'User unbanned successfully');
    } catch (err) {
      console.error(err);
      toast.error("Failed to update user status");
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        role: newRole,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: userProfile.uid
      });
      toast.success('User role updated successfully');
      setIsModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update user role");
    }
  };

  const openRoleModal = (user) => {
    if (user.role === 'super_admin') {
      toast.error("Cannot modify super admin.");
      return;
    }
    setSelectedUser(user);
    setNewRole(user.role || 'user');
    setIsModalOpen(true);
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        
        <header className="bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-serif">User Management</h1>
            <p className="text-sm text-gray-500 mt-1">Super Admin controls for roles and access.</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex items-center justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm"
              />
            </div>
            <div className="text-sm font-bold text-gray-500">
              Total Users: {users.length}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="animate-spin text-brand-primary" size={32} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p className="text-lg font-medium">No users found</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                    <th className="p-4 font-semibold">User Info</th>
                    <th className="p-4 font-semibold">Role</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Joined</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === userProfile?.uid;
                    const isSuperAdmin = u.role === 'super_admin';
                    
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
                              {u.displayName?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 flex items-center gap-2">
                                {u.displayName}
                                {isSelf && <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full">You</span>}
                              </div>
                              <div className="text-gray-500 text-xs">{u.email}</div>
                              <div className="text-gray-500 text-xs">{u.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {isSuperAdmin ? (
                            <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-1 rounded font-bold text-xs w-max">
                              <ShieldAlert size={14} /> Super Admin
                            </span>
                          ) : u.role === 'admin' ? (
                            <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded font-bold text-xs w-max">
                              <Shield size={14} /> Admin
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded font-bold text-xs w-max">
                              User
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.isBanned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {u.isBanned ? 'Banned' : 'Active'}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500">
                          {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openRoleModal(u)}
                              disabled={isSuperAdmin || isSelf}
                              className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-100 rounded transition-colors disabled:opacity-30"
                              title="Change Role"
                            >
                              <Settings size={20} />
                            </button>
                            <button 
                              onClick={() => handleToggleBan(u)}
                              disabled={isSuperAdmin || isSelf}
                              className={`p-2 rounded transition-colors disabled:opacity-30 ${u.isBanned ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`}
                              title={u.isBanned ? 'Unban User' : 'Ban User'}
                            >
                              {u.isBanned ? <UserCheck size={20} /> : <UserX size={20} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* Role Modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold font-serif mb-2">Change User Role</h3>
            <p className="text-sm text-gray-500 mb-6">Modifying access for {selectedUser.displayName}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Select Role</label>
                <select 
                  value={newRole} 
                  onChange={e => setNewRole(e.target.value)} 
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                >
                  <option value="user">User (Standard Access)</option>
                  <option value="admin">Admin (Manage Bookings & Assets)</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button onClick={handleRoleChange} className="flex-1 py-3 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-dark transition-colors">
                  Save Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
