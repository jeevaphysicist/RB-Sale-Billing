import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { X, Save, Loader2 } from 'lucide-react';
import { userService } from '../../services/userService';
import { ROLES } from '../../constants/roles';
import Modal from '../../components/Modal';

const AddEditForm = ({ isOpen, onClose, user, onSuccess, currentUser }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting }, setValue } = useForm({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      role: ROLES.CASHIER,
      account_status: 'active'
    }
  });

  useEffect(() => {
    if (user) {
      setValue('username', user.username);
      setValue('email', user.email);
      setValue('role', user.role || ROLES.CASHIER);
      setValue('account_status', user.account_status || 'active');
      setValue('password', ''); // Don't populate password
    } else {
      reset({
        username: '',
        email: '',
        password: '',
        role: ROLES.CASHIER,
        account_status: 'active'
      });
    }
  }, [user, setValue, reset]);

  const onSubmit = async (data) => {
    try {
      if (user) {
        // Update
        const updateData = {
          id: user.id,
          username: data.username,
          email: data.email,
          role: data.role,
          account_status: data.account_status
        };
        
        // Only send password if it's provided (for password change)
        if (data.password) {
          await userService.updateUser(updateData);
          await window.api.invoke('user:reset-password', { userId: user.id, newPassword: data.password });
          toast.success('User updated successfully (Password changed)');
        } else {
          await userService.updateUser(updateData);
          toast.success('User updated successfully');
        }
      } else {
        // Create
        await userService.createUser({ ...data, created_by: currentUser?.id });
        toast.success('User created successfully');
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Failed to save user');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Edit User' : 'Add New User'}
      width="500px"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            {...register('username', { required: 'Username is required' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="johndoe"
          />
          {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            {...register('email', { required: 'Email is required' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="john@example.com"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {user ? 'Password (Leave blank to keep current)' : 'Password'}
          </label>
          <input
            type="password"
            {...register('password', { required: !user && 'Password is required' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="••••••••"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            {...register('role', { required: 'Role is required' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value={ROLES.ADMIN}>Admin</option>
            <option value={ROLES.MANAGER}>Manager</option>
            <option value={ROLES.CASHIER}>Cashier</option>
            <option value={ROLES.SALES}>Sales</option>
          </select>
          {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            {...register('account_status')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {user ? 'Update User' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddEditForm;