import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Loader2, Calendar, CreditCard, Tag, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Input, Select, Textarea, AutocompleteSelect } from '../../components/Form';
import { expenseRecordService, expenseService } from '../../services/api';

const AddEditForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const { control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      expense_number: '',
      expense_date: new Date().toISOString().split('T')[0],
      category_id: '',
      amount: '',
      payment_mode: 'Cash',
      reference_number: '',
      paid_by: '',
      description: '',
      status: 'Active'
    }
  });

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const response = await expenseService.getExpenses({ limit: 1000, status: 'active' });
        if (response.success) {
          const categoryOptions = response.data.map(cat => ({
            value: cat.id,
            label: cat.name
          }));
          setCategories(categoryOptions);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error(t('expenses.records.messages.categoryLoadFailed'));
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [t]);

  // Load Expense Data for Edit Mode
  useEffect(() => {
    const loadExpense = async () => {
      if (!isEditMode) {
        // Fetch next expense number for new entry
        try {
          const response = await expenseRecordService.getNextExpenseNumber();
          if (response.success) {
            setValue('expense_number', response.data);
          }
        } catch (error) {
          console.error('Error fetching next expense number:', error);
        }
        return;
      }

      setLoading(true);
      try {
        const expense = await expenseRecordService.getExpenseRecordById(id);
        if (expense) {
          reset({
            expense_number: expense.expense_number,
            expense_date: expense.expense_date,
            category_id: expense.category_id,
            amount: expense.amount,
            payment_mode: expense.payment_mode || 'Cash',
            reference_number: expense.reference_number || '',
            paid_by: expense.paid_by || '',
            description: expense.description || '',
            status: expense.status || 'Active'
          });
        }
      } catch (error) {
        console.error('Error loading expense:', error);
        toast.error(t('expenses.records.messages.detailsLoadFailed'));
        navigate('/expense-management');
      } finally {
        setLoading(false);
      }
    };

    loadExpense();
  }, [isEditMode, id, navigate, reset, setValue, t]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        amount: parseFloat(data.amount)
      };

      if (isEditMode) {
        await expenseRecordService.updateExpenseRecord(id, payload);
        toast.success(t('expenses.records.messages.updateSuccess'));
      } else {
        await expenseRecordService.createExpenseRecord(payload);
        toast.success(t('expenses.records.messages.createSuccess'));
      }
      navigate('/expense-management');
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error(error.message || t('expenses.records.messages.saveFailed'));
    }
  };

  const paymentModeOptions = [
    { value: 'Cash', label: t('expenses.records.paymentModes.cash') },
    { value: 'Bank Transfer', label: t('expenses.records.paymentModes.bankTransfer') },
    { value: 'UPI', label: t('expenses.records.paymentModes.upi') },
    { value: 'Cheque', label: t('expenses.records.paymentModes.cheque') },
    { value: 'Card', label: t('expenses.records.paymentModes.card') }
  ];

  const statusOptions = [
    { value: 'Active', label: t('expenses.records.status.active') },
    { value: 'Cancelled', label: t('expenses.records.status.cancelled') }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/expense-management')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEditMode ? t('expenses.records.editExpense') : t('expenses.records.newExpense')}
            </h1>
            <p className="text-sm text-gray-500">
              {isEditMode ? t('expenses.records.updateExpenseDetails') : t('expenses.records.createNewRecord')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/expense-management')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            {t('expenses.records.buttons.cancel')}
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditMode ? t('expenses.records.buttons.update') : t('expenses.records.buttons.save')}
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Basic Details Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                {t('expenses.records.form.expenseDetails')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input
                  name="expense_number"
                  label={t('expenses.records.form.expenseNumber')}
                  control={control}
                  disabled
                  placeholder={t('expenses.records.form.autoGenerated')}
                />
                
                <Input
                  name="expense_date"
                  label={t('expenses.records.form.date')}
                  type="date"
                  control={control}
                  rules={{ required: t('expenses.records.validation.dateRequired') }}
                  error={errors.expense_date?.message}
                />

                <AutocompleteSelect
                  name="category_id"
                  label={t('expenses.records.form.category')}
                  control={control}
                  options={categories}
                  placeholder={t('expenses.records.form.selectCategory')}
                  rules={{ required: t('expenses.records.validation.categoryRequired') }}
                  error={errors.category_id?.message}
                  loading={loadingCategories}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                {t('expenses.records.form.paymentInformation')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input
                  name="amount"
                  label={t('expenses.records.form.amount')}
                  type="number"
                  control={control}
                  placeholder="0.00"
                  rules={{ 
                    required: t('expenses.records.validation.amountRequired'),
                    min: { value: 0.01, message: t('expenses.records.validation.amountGreaterThanZero') }
                  }}
                  error={errors.amount?.message}
                  className="font-medium"
                />

                <Select
                  name="payment_mode"
                  label={t('expenses.records.form.paymentMode')}
                  control={control}
                  options={paymentModeOptions}
                  rules={{ required: t('expenses.records.validation.paymentModeRequired') }}
                  error={errors.payment_mode?.message}
                />

                <Input
                  name="reference_number"
                  label={t('expenses.records.form.referenceNumber')}
                  control={control}
                  placeholder={t('expenses.records.form.optional')}
                />

                <Input
                  name="paid_by"
                  label={t('expenses.records.form.paidBy')}
                  control={control}
                  placeholder={t('expenses.records.form.personName')}
                />
                
                {isEditMode && (
                   <Select
                    name="status"
                    label={t('expenses.records.form.status')}
                    control={control}
                    options={statusOptions}
                  />
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                {t('expenses.records.form.additionalInformation')}
              </h3>
              <Textarea
                name="description"
                label={t('expenses.records.form.description')}
                control={control}
                placeholder={t('expenses.records.form.enterExpenseDetails')}
                rows={4}
              />
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEditForm;