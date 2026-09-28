import React, { useEffect, useState, useRef, Fragment } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form, Input, Textarea, Select } from '../../../components/Form';
import Modal from '../../../components/Modal';
import { DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { expenseService } from '../../../services/api';
import ConfirmationDialog from '../../../components/ConfirmationDialog';

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

const AddEditForm = ({ editMode, expenseModal, setExpenseModal, expenseId, fetchData }) => {
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

  // Fetch expense data when in edit mode
  useEffect(() => {
    const fetchExpense = async () => {
      if (!editMode || !expenseId) return;
      
      try {
        const data = await expenseService.getExpenseById(expenseId);
        if (data) {
          const initialData = {
            name: data.name,
            description: data.description || '',
            status: data.status || 'active'
          };
          reset(initialData);
          setInitialValues(initialData);
        } else {
          toast.error(t('expenses.failedToLoad'));
          setExpenseModal(false);
        }
      } catch (error) {
        console.error('Error fetching expense:', error);
        toast.error(t('expenses.failedToLoad'));
        setExpenseModal(false);
      }
    };

    if (expenseModal) {
      if (editMode) {
        fetchExpense();
      } else {
        // Reset form when opening in add mode
        const defaultValues = {
          name: '',
          description: '',
          status: 'active'
        };
        reset(defaultValues);
        setInitialValues(defaultValues);
      }
    }
  }, [expenseModal, editMode, expenseId, setExpenseModal, reset]);

  const hasFormChanged = (currentValues) => {
    if (!initialValues) return false;
    return JSON.stringify(currentValues) !== JSON.stringify(initialValues);
  };

  const handleCancel = () => {
    formValues.current = watch();
    if (hasFormChanged(formValues.current)) {
      setShowConfirmDialog(true);
    } else {
      setExpenseModal(false);
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    setExpenseModal(false);
  };

  const handleContinueEditing = () => {
    setShowConfirmDialog(false);
  };

  const onSubmit = async (data) => {
    try {
      if (editMode && expenseId) {
        await expenseService.updateExpense(expenseId, data);
        toast.success(t('expenses.updateSuccess'));
      } else {
        await expenseService.createExpense(data);
        toast.success(t('expenses.createSuccess'));
      }
      
      setExpenseModal(false);
      if (fetchData) {
        fetchData();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error(error.message || t('expenses.failedToSave'));
    }
  };

  return (
    <Fragment>
    <Modal
      isOpen={expenseModal}
      onClose={handleCancel}
      title={editMode ? t('expenses.editExpense') : t('expenses.addExpense')}
      width="600px"
      onSubmit={handleSubmit(onSubmit)}
      disableBackdropClose={hasFormChanged(watch())}
    >
      <form>
        <div className="space-y-4">
          <div className="relative">
            <Input
              name="name"
              label={t('expenses.expenseName')}
              control={control}
              placeholder={t('expenses.enterExpenseName')}
              rules={{
                required: t('expenses.nameRequired'),
                minLength: { value: 3, message: t('expenses.nameMinLength') },
                maxLength: { value: MAX_NAME_LENGTH, message: t('expenses.nameMaxLength') },
              }}
              maxLength={MAX_NAME_LENGTH}
              leftIcon={DollarSign}
              error={errors.name?.message}
            />
            <div className="absolute right-3 bottom-2 text-xs text-gray-500">
              {nameLength}/{MAX_NAME_LENGTH}
            </div>
          </div>

          <div className="relative">
            <Textarea
              name="description"
              label={t('expenses.description')}
              control={control}
              placeholder={t('expenses.enterDescription')}
              rows={3}
              rules={{
                maxLength: { 
                  value: MAX_DESCRIPTION_LENGTH, 
                  message: t('expenses.descriptionMaxLength') 
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
// Re-export to fix HMR issue