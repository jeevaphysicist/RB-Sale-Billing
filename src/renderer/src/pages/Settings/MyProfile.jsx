import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Camera, Save, Loader2, Shield, AtSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/authContext';
import { userService } from '../../services/userService';
import { useTranslation } from 'react-i18next';

const MyProfile = () => {
  const { t } = useTranslation();
  const { currentUser, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Separate state for display (base64) and submission (file path)
  const [photoPath, setPhotoPath] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    photo: '' // This will hold the display data (base64)
  });

  useEffect(() => {
    if (currentUser) {
      setFormData({
        username: currentUser.username || '',
        email: currentUser.email || '',
        photo: '' // Will be loaded separately
      });
      setPhotoPath(currentUser.photo || '');
      
      // Fetch profile image
      const fetchProfileImage = async () => {
        try {
          const response = await window.api.getProfileImage(currentUser.id);
          if (response.success && response.imageData) {
            setFormData(prev => ({ ...prev, photo: response.imageData }));
          }
        } catch (error) {
          console.error('Error fetching profile image:', error);
        }
      };
      
      fetchProfileImage();
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.myProfile.messages.uploadImageError'));
      return;
    }

    // Validate file size (e.g., 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('settings.myProfile.messages.imageSizeError'));
      return;
    }

    try {
      setUploading(true);
      
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64String = reader.result.split(',')[1]; // Remove data URL prefix
        
        try {
          const response = await window.api.uploadProfileImage({
            fileData: base64String,
            fileName: file.name,
            userId: currentUser?.id
          });

          if (response.success) {
            // Update local state with base64 data for immediate display
            const displayData = `data:${file.type};base64,${base64String}`;
              
            setFormData(prev => ({
              ...prev,
              photo: displayData
            }));
            
            // Store the file path for submission
            setPhotoPath(response.filePath);
            
            toast.success(t('settings.myProfile.messages.uploadSuccess'));
          } else {
            toast.error(response.message || t('settings.myProfile.messages.uploadFailed'));
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          toast.error(t('settings.myProfile.messages.uploadFailed'));
        } finally {
          setUploading(false);
        }
      };
      
      reader.onerror = () => {
        toast.error(t('settings.myProfile.messages.readImageError'));
        setUploading(false);
      };

    } catch (error) {
      console.error('Error handling image:', error);
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    try {
      setLoading(true);
      
      // Prepare data for submission
      // Use photoPath (file path) instead of formData.photo (base64)
      const submissionData = {
        id: currentUser.id,
        username: formData.username,
        email: formData.email,
        photo: photoPath
      };

      const response = await userService.updateUser(submissionData);

      if (response.success) {
        toast.success(t('settings.myProfile.messages.profileUpdateSuccess'));
        // Refresh user context to reflect changes immediately
        await refreshUser();
      } else {
        toast.error(response.message || t('settings.myProfile.messages.profileUpdateFailed'));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || t('settings.myProfile.messages.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-[100%] h-full bg-gray-50/50 p-6 ">
      <div className="w-[100%] mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.myProfile.title')}</h1>
          <p className="text-gray-500 mt-1">{t('settings.myProfile.subtitle')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Banner/Cover Area */}
            <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
                <div className="absolute -bottom-12 left-8">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
                            <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center overflow-hidden relative">
                                {formData.photo ? (
                                    <img src={formData.photo} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={40} className="text-gray-400" />
                                )}
                                {uploading && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 size={24} className="text-white animate-spin" />
                                  </div>
                                )}
                            </div>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                        <button 
                            type="button"
                            onClick={handleImageClick}
                            disabled={uploading}
                            className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            title={t('settings.myProfile.changePhoto')}
                        >
                            <Camera size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="pt-16 px-8 pb-8">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{formData.username || 'User'}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {currentUser?.role || 'User'}
                            </span>
                            <span className="text-sm text-gray-500">{formData.email}</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t('settings.myProfile.username')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white"
                                    placeholder={t('settings.myProfile.placeholders.username')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t('settings.myProfile.emailAddress')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white"
                                    placeholder={t('settings.myProfile.placeholders.email')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({
                                username: currentUser?.username || '',
                                email: currentUser?.email || '',
                                photo: currentUser?.photo || ''
                            })}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            {t('settings.myProfile.reset')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin mr-2" />
                                    {t('settings.buttons.saving')}
                                </>
                            ) : (
                                <>
                                    <Save size={18} className="mr-2" />
                                    {t('settings.buttons.saveChanges')}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
