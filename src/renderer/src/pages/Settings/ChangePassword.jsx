import React, { useState } from 'react';
import { Lock, Save, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/authContext';
import { userService } from '../../services/userService';
import { useTranslation } from 'react-i18next';

const ChangePassword = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser?.id) return;

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error(t('settings.changePassword.messages.passwordMismatch'));
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error(t('settings.changePassword.messages.passwordTooShort'));
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast.error(t('settings.changePassword.messages.samePassword'));
      return;
    }

    try {
      setLoading(true);
      const response = await userService.updateUserPassword({
        id: currentUser.id,
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      if (response.success) {
        toast.success(t('settings.changePassword.messages.updateSuccess'));
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        toast.error(response.message || t('settings.changePassword.messages.updateFailed'));
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(error.message || t('settings. changePassword.messages.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-[100%] p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">{t('settings.changePassword.title')}</h2>
        <p className="text-gray-500 text-sm mt-1">{t('settings.changePassword.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="w-[100%] space-y-6">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-blue-700 mb-6">
          <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <p className="font-medium mb-1">{t('settings.changePassword.requirementsTitle')}</p>
            <ul className="list-disc list-inside space-y-1 opacity-90">
              <li>{t('settings.changePassword.minLength')}</li>
              <li>{t('settings.changePassword.differentPassword')}</li>
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{t('settings.changePassword.currentPassword')}</label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
              placeholder={t('settings.changePassword.placeholders.currentPassword')}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{t('settings.changePassword.newPassword')}</label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
              placeholder={t('settings.changePassword.placeholders.newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{t('settings.changePassword.confirmNewPassword')}</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
              placeholder={t('settings.changePassword.placeholders.confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('settings.changePassword.updating')}
              </>
            ) : (
              <>
                <Save size={18} />
                {t('settings.changePassword.updatePassword')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePassword;
