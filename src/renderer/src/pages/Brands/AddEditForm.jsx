import React, { useEffect, useState, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form, Input, Textarea, Select, FileUpload } from '../../components/Form';
import Modal from '../../components/Modal';
import { Layers, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import brandService  from '../../services/brandService';
import ConfirmationDialog from '../../components/ConfirmationDialog';

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_WEBSITE_LENGTH = 255;

const AddEditForm = ({ editMode, brandModal, setBrandModal, brandId, fetchData }) => {
  const { t } = useTranslation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const formValues = useRef(null);
  
  const { 
    control, 
    handleSubmit, 
    reset,
    formState: { isSubmitting, errors },
    watch
  } = useForm({
    defaultValues: {
      name: '',
      description: '',
      website: '',
      status: 'active'
    }
  });

  const name = useWatch({ control, name: 'name' });
  const description = useWatch({ control, name: 'description' });
  const website = useWatch({ control, name: 'website' });
  
  const nameLength = name?.length || 0;
  const descriptionLength = description?.length || 0;
  const websiteLength = website?.length || 0;

  const statusOptions = [
    { value: 'active', label: t('common.active') },
    { value: 'inactive', label: t('common.inactive') },
  ];

  // Fetch brand data when in edit mode
  useEffect(() => {
    const fetchBrand = async () => {
      if (!editMode || !brandId) return;
      
      try {
        setIsLoading(true);
        const data = await brandService.getBrandById(brandId);
        if (data) {
          const initialData = {
            name: data.name,
            description: data.description || '',
            website: data.website || '',
            status: data.status || 'active'
          };
          reset(initialData);
          setInitialValues(initialData);
        } else {
          toast.error(t('brands.brandNotFound'));
          setBrandModal(false);
        }
      } catch (error) {
        console.error('Error fetching brand:', error);
        toast.error(t('brands.failedToLoad'));
        setBrandModal(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (brandModal) {
      if (editMode) {
        fetchBrand();
      } else {
        // Reset form when opening in add mode
        const defaultValues = {
          name: '',
          description: '',
          website: '',
          status: 'active'
        };
        reset(defaultValues);
        setInitialValues(defaultValues);
      }
    }
  }, [brandModal, editMode, brandId, setBrandModal, reset]);

  const hasFormChanged = (currentValues) => {
    if (!initialValues) return false;
    return JSON.stringify(currentValues) !== JSON.stringify(initialValues);
  };

  const handleCancel = () => {
    formValues.current = watch();
    if (hasFormChanged(formValues.current)) {
      setShowConfirmDialog(true);
    } else {
      setBrandModal(false);
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    setBrandModal(false);
  };

  const handleContinueEditing = () => {
    setShowConfirmDialog(false);
  };

  const onSubmit = async (data) => {
    try {
      if (editMode && brandId) {
        await brandService.updateBrand(brandId, data);
        toast.success(t('brands.updateSuccess'));
      } else {
        await brandService.createBrand(data);
        toast.success(t('brands.createSuccess'));
      }
      
      setBrandModal(false);
      if (fetchData) {
        fetchData();
      }
    } catch (error) {
      console.error('Error saving brand:', error);
      toast.error(error.message || t('brands.failedToSave'));
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Handle file upload logic here
      console.log('File selected:', file);
      // You can add file validation here (size, type, etc.)
      // and set the file to your form state
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <>
      <Modal
        isOpen={brandModal}
        onSubmit={handleSubmit(onSubmit)}
        onClose={handleCancel}
        title={editMode ? t('brands.editBrand') : t('brands.addBrand')}
        width="800px"
        disableBackdropClose={hasFormChanged(watch())}
      >
        <form>
          <div className="space-y-4">
            <div className="relative">
              <Input
                name="name"
                label={t('brands.brandName')}
                control={control}
                placeholder={t('brands.enterBrandName')}
                rules={{
                  required: t('forms.required'),
                  minLength: { value: 2, message: t('forms.minLength', { min: 2 }) },
                  maxLength: { 
                    value: MAX_NAME_LENGTH, 
                    message: t('forms.maxLength', { max: MAX_NAME_LENGTH }) 
                  },
                }}
                maxLength={MAX_NAME_LENGTH}
                leftIcon={Layers}
                error={errors.name?.message}
              />
              <div className="absolute right-3 bottom-2 text-xs text-gray-500">
                {nameLength}/{MAX_NAME_LENGTH}
              </div>
            </div>


            <div className="relative">
              <Input
                name="website"
                label={t('brands.website')}
                control={control}
                placeholder={t('brands.enterWebsite')}
                rules={{
                  pattern: {
                    value: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
                    message: t('forms.enterValue')
                  },
                  maxLength: { 
                    value: MAX_WEBSITE_LENGTH, 
                    message: t('forms.maxLength', { max: MAX_WEBSITE_LENGTH }) 
                  },
                }}
                maxLength={MAX_WEBSITE_LENGTH}
                error={errors.website?.message}
              />
              <div className="absolute right-3 bottom-2 text-xs text-gray-500">
                {websiteLength}/{MAX_WEBSITE_LENGTH}
              </div>
            </div>

            <div className="relative">
              <Textarea
                name="description"
                label={t('common.description')}
                control={control}
                placeholder={t('brands.enterDescription')}
                rows={3}
                rules={{
                  maxLength: { 
                    value: MAX_DESCRIPTION_LENGTH, 
                    message: t('forms.maxLength', { max: MAX_DESCRIPTION_LENGTH }) 
                  },
                }}
                maxLength={MAX_DESCRIPTION_LENGTH}
                error={errors.description?.message}
              />
              <div className="absolute right-3 bottom-2 text-xs text-gray-500">
                {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
              </div>
            </div>

            <Select
              name="status"
              label={t('common.status')}
              control={control}
              options={statusOptions}
              rules={{ required: t('forms.required') }}
              error={errors.status?.message}
            />

            
          </div>
        </form>
      </Modal>
      
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmClose}
        onCancel={handleContinueEditing}
        title={t('common.discardChanges')}
        message={t('common.discardChangesMessage')}
        confirmText={t('common.discard')}
        cancelText={t('common.continueEditing')}
      />
    </>
  );
};

export default AddEditForm;