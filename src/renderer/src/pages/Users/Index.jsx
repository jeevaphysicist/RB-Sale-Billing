import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  User, 
  Shield, 
  CheckCircle, 
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { userService } from '../../services/userService';
import AddEditForm from './AddEditForm';
import Modal from '../../components/Modal';

const UsersIndex = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userService.getUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAdd = () => {
    setSelectedUser(null);
    setShowAddEditModal(true);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowAddEditModal(true);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    try {
      await userService.deleteUser(userToDelete.id);
      toast.success('User deleted successfully');
      fetchUsers();
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'cashier': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen flex flex-col h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage system users and their roles</p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-200 flex items-center gap-4 bg-gray-50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 font-medium text-gray-700 text-sm">
            <div className="col-span-4">User</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Last Login</div>
            <div className="col-span-2 text-center">Actions</div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No users found</div>
            ) : (
              filteredUsers.map((user) => (
                <div 
                  key={user.id} 
                  className="grid grid-cols-12 gap-4 p-3 rounded-lg items-center border bg-white border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    {/* <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                      {user.photo ? (
                        <img src={user.photo} alt={user.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div> */}
                    <div>
                      <div className="font-medium text-gray-900">{user.username}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize flex items-center gap-1 w-fit ${getRoleBadgeColor(user.role)}`}>
                      <Shield className="w-3 h-3" />
                      {user.role}
                    </span>
                  </div>
                  
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                      user.account_status === 'active' 
                        ? 'bg-green-50 text-green-700' 
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {user.account_status === 'active' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      <span className="capitalize">{user.account_status}</span>
                    </span>
                  </div>
                  
                  <div className="col-span-2 text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </div>
                  
                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit User"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddEditModal && (
        <AddEditForm 
          isOpen={showAddEditModal}
          onClose={() => setShowAddEditModal(false)}
          user={selectedUser}
          currentUser={currentUser}
          onSuccess={() => {
            setShowAddEditModal(false);
            fetchUsers();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete User"
        width="400px"
        onSubmit={handleDeleteConfirm}
        submitLabel="Delete"
        submitVariant="danger"
      >
        <div className="p-4">
          <p className="text-gray-700">
            Are you sure you want to delete user <strong>{userToDelete?.username}</strong>?
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default UsersIndex;