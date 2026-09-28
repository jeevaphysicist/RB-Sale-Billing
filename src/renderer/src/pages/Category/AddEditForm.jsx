import React, { useEffect, useState, useRef, Fragment } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form, Input, Textarea, Select } from '../../components/Form';
import Modal from '../../components/Modal';
import { Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { categoryService } from '../../services/api';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import IconPicker from '../../components/IconPicker';
import { Controller } from 'react-hook-form';

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

const AddEditForm = ({ editMode, categoryModal, setCategoryModal, categoryId, fetchData }) => {
  const { t } = useTranslation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
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
      icon: '',
      description: '',
      status: 'active'
    }
  });

  const name = useWatch({ control, name: 'name' });
  const description = useWatch({ control, name: 'description' });

  const nameLength = name?.length || 0;
  const descriptionLength = description?.length || 0;

  const statusOptions = [
    { value: 'active', label: t('common.active') },
    { value: 'inactive', label: t('common.inactive') },
  ];

  // Fetch category data when in edit mode
  useEffect(() => {
    const fetchCategory = async () => {
      if (!editMode || !categoryId) return;

      try {
        const data = await categoryService.getCategoryById(categoryId);
        if (data) {
          const initialData = {
            name: data.name,
            icon: data.icon || '',
            description: data.description || '',
            status: data.status || 'active'
          };
          reset(initialData);
          setInitialValues(initialData);
        } else {
          toast.error(t('categories.categoryNotFound'));
          setCategoryModal(false);
        }
      } catch (error) {
        console.error('Error fetching category:', error);
        toast.error(t('categories.failedToLoad'));
        setCategoryModal(false);
      }
    };

    if (categoryModal) {
      if (editMode) {
        fetchCategory();
      } else {
        // Reset form when opening in add mode
        const defaultValues = {
          name: '',
          icon: '',
          description: '',
          status: 'active'
        };
        reset(defaultValues);
        setInitialValues(defaultValues);
      }
    }
  }, [categoryModal, editMode, categoryId, setCategoryModal, reset]);

  const hasFormChanged = (currentValues) => {
    if (!initialValues) return false;
    return JSON.stringify(currentValues) !== JSON.stringify(initialValues);
  };

  const handleCancel = () => {
    formValues.current = watch();
    if (hasFormChanged(formValues.current)) {
      setShowConfirmDialog(true);
    } else {
      setCategoryModal(false);
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    setCategoryModal(false);
  };

  const handleContinueEditing = () => {
    setShowConfirmDialog(false);
  };

  const onSubmit = async (data) => {
    try {
      if (editMode && categoryId) {
        await categoryService.updateCategory(categoryId, data);
        toast.success(t('categories.updateSuccess'));
      } else {
        await categoryService.createCategory(data);
        toast.success(t('categories.createSuccess'));
      }

      setCategoryModal(false);
      if (fetchData) {
        fetchData();
      }
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error(error.message || t('categories.failedToSave'));
    }
  };

  return (
    <Fragment>
      <Modal
        isOpen={categoryModal}
        onClose={handleCancel}
        title={editMode ? t('categories.editCategory') : t('categories.addCategory')}
        width="600px"
        onSubmit={handleSubmit(onSubmit)}
        disableBackdropClose={hasFormChanged(watch())}
      >
        <form>
          <div className="space-y-4">
            <div className="relative">
              <Input
                name="name"
                label={t('categories.categoryName')}
                control={control}
                placeholder={t('categories.enterCategoryName')}
                rules={{
                  required: t('forms.required'),
                  minLength: { value: 3, message: t('forms.minLength', { count: 3 }) },
                  maxLength: { value: MAX_NAME_LENGTH, message: t('forms.maxLength', { count: MAX_NAME_LENGTH }) },
                }}
                maxLength={MAX_NAME_LENGTH}
                leftIcon={Tag}
                error={errors.name?.message}
              />
              <div className="absolute right-3 bottom-2 text-xs text-gray-500">
                {nameLength}/{MAX_NAME_LENGTH}
              </div>
            </div>

            <Controller
              name="icon"
              control={control}
              render={({ field }) => (
                <IconPicker
                  label={t('categories.icon') || 'Category Icon'}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.icon?.message}
                />
              )}
            />

            <div className="relative">
              <Textarea
                name="description"
                label={t('common.description')}
                control={control}
                placeholder={t('categories.enterDescription')}
                rows={3}
                rules={{
                  maxLength: {
                    value: MAX_DESCRIPTION_LENGTH,
                    message: t('forms.maxLength', { count: MAX_DESCRIPTION_LENGTH })
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
    </Fragment>
  );
};

export default AddEditForm;