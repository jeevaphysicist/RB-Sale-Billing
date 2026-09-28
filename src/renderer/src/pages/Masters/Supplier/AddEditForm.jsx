import React, { useEffect, useState, useRef, Fragment } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form, Input, Textarea, Select, Checkbox, AutocompleteSelect } from '../../../components/Form';
import Modal from '../../../components/Modal';
import { Building2, User, FileText, CreditCard, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supplierService } from '../../../services/api';
import ConfirmationDialog from '../../../components/ConfirmationDialog';

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const AddEditForm = ({ editMode, supplierModal, setSupplierModal, supplierId, fetchData, onSuccess }) => {
  const { t } = useTranslation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const formValues = useRef(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, errors },
    watch
  } = useForm({
    defaultValues: {
      supplier_name: '',
      supplier_code: '',
      contact_person: '',
      email: '',
      phone: '',
      alternate_phone: '',
      supplier_type: 'Local',
      gstin: '',
      pan: '',
      business_type: 'Company',
      hsn_sac_applicable: false,
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      upi_id: '',
      payment_terms: 'Cash',
      opening_balance: '',
      payment_mode: 'Cash',
      status: 'Active',
      notes: ''
    }
  });

  const pincode = useWatch({ control, name: 'pincode' });



  // Fetch pincode data
  useEffect(() => {
    const fetchPincodeData = async () => {
      if (pincode && pincode.length === 6) {
        setPincodeLoading(true);
        try {
          const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
          const data = await response.json();

          if (data[0].Status === 'Success' && data[0].PostOffice.length > 0) {
            const { District, State } = data[0].PostOffice[0];
            setValue('city', District);
            setValue('state', State);
          }
        } catch (error) {
          console.error('Error fetching pincode data:', error);
        } finally {
          setPincodeLoading(false);
        }
      }
    };

    fetchPincodeData();
  }, [pincode, setValue]);

  // Fetch supplier data when in edit mode
  useEffect(() => {
    const fetchSupplier = async () => {
      if (!editMode || !supplierId) return;

      try {
        const data = await supplierService.getSupplierById(supplierId);
        if (data) {
          const initialData = {
            supplier_name: data.supplier_name || '',
            supplier_code: data.supplier_code || '',
            contact_person: data.contact_person || '',
            email: data.email || '',
            phone: data.phone || '',
            alternate_phone: data.alternate_phone || '',
            supplier_type: data.supplier_type || 'Local',
            gstin: data.gstin || '',
            pan: data.pan || '',
            business_type: data.business_type || 'Company',
            hsn_sac_applicable: data.hsn_sac_applicable || false,
            address_line_1: data.address_line_1 || '',
            address_line_2: data.address_line_2 || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
            country: data.country || 'India',
            bank_name: data.bank_name || '',
            account_number: data.account_number || '',
            ifsc_code: data.ifsc_code || '',
            upi_id: data.upi_id || '',
            payment_terms: data.payment_terms || 'Cash',
            opening_balance: data.opening_balance || '',
            payment_mode: data.payment_mode || 'Cash',
            status: data.status || 'Active',
            notes: data.notes || ''
          };
          reset(initialData);
          setInitialValues(initialData);
        } else {
          toast.error(t('suppliers.supplierNotFound'));
          setSupplierModal(false);
        }
      } catch (error) {
        console.error('Error fetching supplier:', error);
        toast.error(t('suppliers.failedToLoad'));
        setSupplierModal(false);
      }
    };

    if (supplierModal) {
      if (editMode) {
        fetchSupplier();
      } else {
        const defaultValues = {
          supplier_name: '',
          supplier_code: '',
          contact_person: '',
          email: '',
          phone: '',
          alternate_phone: '',
          supplier_type: 'Local',
          gstin: '',
          pan: '',
          business_type: 'Company',
          hsn_sac_applicable: false,
          address_line_1: '',
          address_line_2: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India',
          bank_name: '',
          account_number: '',
          ifsc_code: '',
          upi_id: '',
          payment_terms: 'Cash',
          opening_balance: '',
          payment_mode: 'Cash',
          status: 'Active',
          notes: ''
        };
        reset(defaultValues);
        setInitialValues(defaultValues);
        // Supplier code will be auto-generated by backend
      }
      setActiveTab('basic');
    }
  }, [supplierModal, editMode, supplierId, setSupplierModal, reset]);

  const hasFormChanged = (currentValues) => {
    if (!initialValues) return false;
    return JSON.stringify(currentValues) !== JSON.stringify(initialValues);
  };

  const handleCancel = () => {
    formValues.current = watch();
    if (hasFormChanged(formValues.current)) {
      setShowConfirmDialog(true);
    } else {
      setSupplierModal(false);
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    setSupplierModal(false);
  };

  const handleContinueEditing = () => {
    setShowConfirmDialog(false);
  };

  const onSubmit = async (data) => {
    try {
      let result;
      if (editMode && supplierId) {
        result = await supplierService.updateSupplier(supplierId, data);
        toast.success(t('suppliers.updateSuccess'));
      } else {
        result = await supplierService.createSupplier(data);
        toast.success(t('suppliers.createSuccess'));
      }

      setSupplierModal(false);
      if (onSuccess) {
        onSuccess(result, data);
      }
      if (fetchData) {
        fetchData();
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error(error.message || t('suppliers.failedToSave'));
    }
  };

  const supplierTypeOptions = [
    { value: 'Local', label: 'Local' },
    { value: 'Outstation', label: 'Outstation' },
    { value: 'Overseas', label: 'Overseas' }
  ];

  const businessTypeOptions = [
    { value: 'Individual', label: 'Individual' },
    { value: 'Company', label: 'Company' },
    { value: 'Proprietor', label: 'Proprietor' },
    { value: 'Partnership', label: 'Partnership' }
  ];

  const stateOptions = STATES.map(state => ({ value: state, label: state }));

  const paymentTermsOptions = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Credit - 7 days', label: 'Credit - 7 days' },
    { value: 'Credit - 15 days', label: 'Credit - 15 days' },
    { value: 'Credit - 30 days', label: 'Credit - 30 days' },
    { value: 'Credit - 45 days', label: 'Credit - 45 days' },
    { value: 'Credit - 60 days', label: 'Credit - 60 days' }
  ];

  const paymentModeOptions = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank', label: 'Bank Transfer' },
    { value: 'UPI', label: 'UPI' },
    { value: 'Cheque', label: 'Cheque' }
  ];

  const statusOptions = [
    { value: 'Active', label: t('common.active') },
    { value: 'Inactive', label: t('common.inactive') }
  ];

  const tabs = [
    { id: 'basic', label: t('suppliers.basicInformation'), icon: User },
    { id: 'tax', label: t('suppliers.businessDetails'), icon: FileText },
    { id: 'payment', label: t('suppliers.paymentDetails'), icon: CreditCard },
    { id: 'other', label: t('common.otherInfo'), icon: Info }
  ];

  return (
    <Fragment>
      <Modal
        isOpen={supplierModal}
        onClose={handleCancel}
        title={editMode ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
        width="900px"
        onSubmit={handleSubmit(onSubmit)}
        disableBackdropClose={hasFormChanged(watch())}
      >
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all whitespace-nowrap text-sm ${activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form className="space-y-4">
          {/* Basic Info & Address Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Contact Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {t('suppliers.contactInformation')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    name="supplier_name"
                    label={t('suppliers.supplierName')}
                    control={control}
                    placeholder={t('suppliers.enterSupplierName')}
                    rules={{ required: t('forms.required') }}
                    error={errors.supplier_name?.message}
                  />

                  {editMode && (
                    <Input
                      name="supplier_code"
                      label={t('suppliers.supplierCode')}
                      control={control}
                      placeholder={t('suppliers.autoGenerated')}
                      disabled
                      error={errors.supplier_code?.message}
                    />
                  )}

                  <Input
                    name="contact_person"
                    label={t('suppliers.contactPerson')}
                    control={control}
                    placeholder={t('suppliers.enterContactPerson')}
                    error={errors.contact_person?.message}
                  />

                  <Input
                    name="email"
                    label={t('suppliers.email')}
                    type="email"
                    control={control}
                    placeholder={t('suppliers.enterEmail')}
                    error={errors.email?.message}
                  />

                  <Input
                    name="phone"
                    label={t('suppliers.mobileNumber')}
                    control={control}
                    placeholder={t('suppliers.enterMobileNumber')}
                    rules={{ required: t('forms.required') }}
                    error={errors.phone?.message}
                  />

                  <Input
                    name="alternate_phone"
                    label={t('suppliers.alternateNumber')}
                    control={control}
                    placeholder={t('suppliers.enterAlternateNumber')}
                    error={errors.alternate_phone?.message}
                  />

                  <Select
                    name="supplier_type"
                    label={t('suppliers.supplierType')}
                    control={control}
                    options={supplierTypeOptions}
                    error={errors.supplier_type?.message}
                  />
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {t('suppliers.addressInformation')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Input
                      name="address_line_1"
                      label={t('suppliers.addressLine1')}
                      control={control}
                      placeholder={t('suppliers.enterAddressLine1')}
                      rules={{ required: t('forms.required') }}
                      error={errors.address_line_1?.message}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Input
                      name="address_line_2"
                      label={t('suppliers.addressLine2')}
                      control={control}
                      placeholder={t('suppliers.enterAddressLine2')}
                      error={errors.address_line_2?.message}
                    />
                  </div>

                  <Input
                    name="pincode"
                    label={t('suppliers.pincode')}
                    control={control}
                    placeholder={t('suppliers.enter6DigitPincode')}
                    rules={{
                      required: t('forms.required'),
                      pattern: { value: /^\d{6}$/, message: t('suppliers.invalidPincode') }
                    }}
                    error={errors.pincode?.message}
                  />

                  <Input
                    name="city"
                    label={t('suppliers.city')}
                    control={control}
                    placeholder={t('suppliers.cityName')}
                    rules={{ required: t('forms.required') }}
                    error={errors.city?.message}
                    disabled={pincodeLoading}
                  />

                  <AutocompleteSelect
                    name="state"
                    label={t('suppliers.state')}
                    control={control}
                    options={stateOptions}
                    placeholder={t('suppliers.selectState')}
                    rules={{ required: t('forms.required') }}
                    error={errors.state?.message}
                    disabled={pincodeLoading}
                  />

                  <Input
                    name="country"
                    label={t('suppliers.country')}
                    control={control}
                    disabled
                    error={errors.country?.message}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tax & Business Tab */}
          {activeTab === 'tax' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                name="gstin"
                label={t('suppliers.gstin')}
                control={control}
                placeholder={t('suppliers.enterGSTNumber')}
                inputClassName="uppercase"
                error={errors.gstin?.message}
              />

              <Input
                name="pan"
                label={t('suppliers.panNumber')}
                control={control}
                placeholder="AAAAA0000A"
                inputClassName="uppercase"
                error={errors.pan?.message}
              />

              <Select
                name="business_type"
                label={t('common.type')}
                control={control}
                options={businessTypeOptions}
                error={errors.business_type?.message}
              />

              <Checkbox
                name="hsn_sac_applicable"
                label="HSN/SAC Applicable"
                control={control}
                className="flex items-center h-full"
              />
            </div>
          )}

          {/* Bank & Payment Tab */}
          {activeTab === 'payment' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                name="bank_name"
                label={t('suppliers.bankName')}
                control={control}
                placeholder={t('suppliers.enterBankName')}
                error={errors.bank_name?.message}
              />

              <Input
                name="account_number"
                label={t('suppliers.accountNumber')}
                control={control}
                placeholder={t('suppliers.enterAccountNumber')}
                error={errors.account_number?.message}
              />

              <Input
                name="ifsc_code"
                label={t('suppliers.ifscCode')}
                control={control}
                placeholder="ABCD0123456"
                inputClassName="uppercase"
                error={errors.ifsc_code?.message}
              />

              <Input
                name="upi_id"
                label={t('suppliers.upiId')}
                control={control}
                placeholder={t('suppliers.enterUpiId')}
                error={errors.upi_id?.message}
              />

              <Select
                name="payment_terms"
                label={t('suppliers.paymentTerms')}
                control={control}
                options={paymentTermsOptions}
                error={errors.payment_terms?.message}
              />

              <Select
                name="payment_mode"
                label={t('common.paymentMethod')}
                control={control}
                options={paymentModeOptions}
                error={errors.payment_mode?.message}
              />

              <Input
                name="opening_balance"
                label={t('suppliers.openingBalance')}
                type="number"
                control={control}
                placeholder={t('suppliers.enterOpeningBalance')}
                error={errors.opening_balance?.message}
              />
            </div>
          )}

          {/* Other Info Tab */}
          {activeTab === 'other' && (
            <div className="grid grid-cols-1 gap-4">
              <Select
                name="status"
                label={t('common.status')}
                control={control}
                options={statusOptions}
                error={errors.status?.message}
              />

              <Textarea
                name="notes"
                label={t('suppliers.notesRemarks')}
                control={control}
                placeholder={t('suppliers.enterNotes')}
                rows={4}
                error={errors.notes?.message}
              />
            </div>
          )}
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