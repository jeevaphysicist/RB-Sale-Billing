import React, { useEffect, useState, useRef, Fragment } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form, Input, Textarea, Select, AutocompleteSelect } from '../../../components/Form';
import Modal from '../../../components/Modal';
import { Users, User, FileText, CreditCard, Banknote, Info } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../../services/customerService';
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

const AddEditForm = ({ customerModal, setCustomerModal, editingCustomer, onSuccess }) => {
  const { t } = useTranslation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const formValues = useRef(null);
  const editMode = !!editingCustomer;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, errors },
    watch
  } = useForm({
    defaultValues: {
      customer_name: '',
      customer_code: '',
      contact_person: '',
      mobile_number: '',
      alternate_number: '',
      email: '',
      customer_type: 'Retail',
      customer_status: 'Active',
      gstin: '',
      pan_number: '',
      business_name: '',
      billing_type: 'B2C',
      price_category: 'Retail Price',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      shipping_address: '',
      opening_balance: '',
      balance_type: 'Receivable',
      credit_limit: '',
      payment_terms: 'Cash',
      payment_method: 'Cash',
      price_level: 'Retail',
      loyalty_points: '',
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      upi_id: '',
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

  // Fetch customer data when in edit mode
  useEffect(() => {
    if (!customerModal) {
      // Reset form when modal closes
      setInitialValues(null);
      setActiveTab('basic');
      return;
    }

    const fetchCustomer = async () => {
      if (editMode && editingCustomer && editingCustomer.id) {
        try {
          const customer = await customerService.getCustomerById(editingCustomer.id);

          if (!customer) {
            toast.error(t('customers.customerNotFound'));
            return;
          }

          const formData = {
            ...customer,
            opening_balance: customer.opening_balance || '',
            credit_limit: customer.credit_limit || ''
          };

          reset(formData);
          setInitialValues(formData);
        } catch (error) {
          console.error('Error fetching customer:', error);
          toast.error(t('customers.failedToLoad'));
        }
      } else if (!editMode) {
        // Reset form to default values for add mode
        const defaultValues = {
          customer_name: '',
          customer_code: '',
          contact_person: '',
          mobile_number: '',
          alternate_number: '',
          email: '',
          customer_type: 'Retail',
          customer_status: 'Active',
          gstin: '',
          pan_number: '',
          business_name: '',
          billing_type: 'B2C',
          price_category: 'Retail Price',
          address_line_1: '',
          address_line_2: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India',
          shipping_address: '',
          opening_balance: '',
          balance_type: 'Receivable',
          credit_limit: '',
          payment_terms: 'Cash',
          payment_method: 'Cash',
          price_level: 'Retail',
          loyalty_points: '',
          bank_name: '',
          account_number: '',
          ifsc_code: '',
          upi_id: '',
          notes: ''
        };
        reset(defaultValues);
        setInitialValues(null);
        // Customer code will be auto-generated by backend
      }
    };

    // Small delay to ensure modal is fully mounted
    const timeoutId = setTimeout(() => {
      fetchCustomer();
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [editMode, editingCustomer, customerModal]);

  // Check if form has changed
  const hasFormChanged = (currentValues) => {
    if (!initialValues) return false;
    return JSON.stringify(currentValues) !== JSON.stringify(initialValues);
  };

  // Handle form submission
  const onSubmit = async (data) => {
    try {
      let result;
      if (editMode) {
        result = await customerService.updateCustomer(editingCustomer.id, data);
        toast.success(t('customers.updateSuccess'));
      } else {
        result = await customerService.createCustomer(data);
        toast.success(t('customers.createSuccess'));
      }
      // Pass the result (including customer ID and data) to onSuccess callback
      onSuccess(result, data);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error(error.message || t('customers.failedToSave'));
    }
  };

  // Handle cancel
  const handleCancel = () => {
    const currentValues = watch();
    if (hasFormChanged(currentValues)) {
      formValues.current = currentValues;
      setShowConfirmDialog(true);
    } else {
      setCustomerModal(false);
    }
  };

  const confirmClose = () => {
    setShowConfirmDialog(false);
    setCustomerModal(false);
    setInitialValues(null);
    setActiveTab('basic');
  };

  const stateOptions = STATES.map(state => ({
    value: state,
    label: state
  }));

  const customerTypeOptions = [
    { value: 'Retail', label: 'Retail' },
    { value: 'Wholesale', label: 'Wholesale' },
    { value: 'Online', label: 'Online' },
    { value: 'Corporate', label: 'Corporate' }
  ];

  const statusOptions = [
    { value: 'Active', label: t('common.active') },
    { value: 'Inactive', label: t('common.inactive') }
  ];

  const billingTypeOptions = [
    { value: 'B2B', label: 'B2B (Business to Business)' },
    { value: 'B2C', label: 'B2C (Business to Consumer)' }
  ];

  const priceCategoryOptions = [
    { value: 'Retail Price', label: 'Retail Price' },
    { value: 'Wholesale Price', label: 'Wholesale Price' },
    { value: 'Special Price', label: 'Special Price' }
  ];

  const balanceTypeOptions = [
    { value: 'Receivable', label: 'Receivable (Customer owes you)' },
    { value: 'Advance', label: 'Advance (You owe customer)' }
  ];

  const paymentTermsOptions = [
    { value: 'Cash', label: 'Cash' },
    { value: '7 Days', label: '7 Days' },
    { value: '15 Days', label: '15 Days' },
    { value: '30 Days', label: '30 Days' },
    { value: '45 Days', label: '45 Days' },
    { value: '60 Days', label: '60 Days' }
  ];

  const paymentMethodOptions = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Card', label: 'Card' },
    { value: 'UPI', label: 'UPI' },
    { value: 'Bank Transfer', label: 'Bank Transfer' },
    { value: 'Cheque', label: 'Cheque' }
  ];

  const priceLevelOptions = [
    { value: 'Retail', label: 'Retail' },
    { value: 'Wholesale', label: 'Wholesale' },
    { value: 'Distributor', label: 'Distributor' }
  ];

  const tabs = [
    { id: 'basic', label: t('customers.basicInformation'), icon: User },
    { id: 'business', label: t('customers.businessTax'), icon: FileText },
    { id: 'account', label: t('customers.accountPayment'), icon: CreditCard },
    { id: 'bank', label: t('customers.bankDetails'), icon: Banknote },
    { id: 'other', label: t('customers.otherInfo'), icon: Info }
  ];

  return (
    <Fragment>
      <Modal
        isOpen={customerModal}
        onClose={handleCancel}
        title={editMode ? t('customers.editCustomer') : t('customers.addCustomer')}
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
                  {t('customers.contactInformation')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    name="customer_name"
                    label={t('customers.customerName')}
                    control={control}
                    placeholder={t('customers.enterCustomerName')}
                    rules={{ required: t('forms.required') }}
                    error={errors.customer_name?.message}
                  />

                  {editMode && (
                    <Input
                      name="customer_code"
                      label={t('customers.customerCode')}
                      control={control}
                      placeholder={t('customers.autoGenerated')}
                      disabled
                      error={errors.customer_code?.message}
                    />
                  )}



                  <Input
                    name="mobile_number"
                    label={t('customers.mobileNumber')}
                    control={control}
                    placeholder={t('customers.enterMobileNumber')}
                    error={errors.mobile_number?.message}
                  />

                  <Input
                    name="alternate_number"
                    label={t('customers.alternateNumber')}
                    control={control}
                    placeholder={t('customers.enterAlternateNumber')}
                    error={errors.alternate_number?.message}
                  />

                  <Input
                    name="email"
                    label={t('customers.email')}
                    type="email"
                    control={control}
                    placeholder={t('customers.enterEmail')}
                    error={errors.email?.message}
                  />

                  <Select
                    name="customer_type"
                    label={t('customers.customerType')}
                    control={control}
                    options={customerTypeOptions}
                    error={errors.customer_type?.message}
                  />

                  <Select
                    name="customer_status"
                    label={t('common.status')}
                    control={control}
                    options={statusOptions}
                    error={errors.customer_status?.message}
                  />
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('customers.addressInformation')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Input
                      name="address_line_1"
                      label={t('customers.addressLine1')}
                      control={control}
                      placeholder={t('customers.enterAddressLine1')}
                      error={errors.address_line_1?.message}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Input
                      name="address_line_2"
                      label={t('customers.addressLine2')}
                      control={control}
                      placeholder={t('customers.enterAddressLine2')}
                      error={errors.address_line_2?.message}
                    />
                  </div>

                  <Input
                    name="pincode"
                    label={t('customers.pincode')}
                    control={control}
                    placeholder={t('customers.enter6DigitPincode')}
                    rules={{
                      pattern: { value: /^\d{6}$/, message: t('customers.invalidPincode') }
                    }}
                    error={errors.pincode?.message}
                  />

                  <Input
                    name="city"
                    label={t('customers.city')}
                    control={control}
                    placeholder={t('customers.cityName')}
                    error={errors.city?.message}
                    disabled={pincodeLoading}
                  />

                  <AutocompleteSelect
                    name="state"
                    label={t('customers.state')}
                    control={control}
                    options={stateOptions}
                    placeholder={t('customers.selectState')}
                    error={errors.state?.message}
                    disabled={pincodeLoading}
                  />

                  <Input
                    name="country"
                    label={t('customers.country')}
                    control={control}
                    disabled
                    error={errors.country?.message}
                  />

                  <div className="md:col-span-2">
                    <Textarea
                      name="shipping_address"
                      label={t('customers.shippingAddress')}
                      control={control}
                      placeholder={t('customers.enterShippingAddress')}
                      rows={2}
                      error={errors.shipping_address?.message}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Business & Tax Tab */}
          {activeTab === 'business' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                name="gstin"
                label={t('customers.gstin')}
                control={control}
                placeholder={t('customers.enterGSTNumber')}
                inputClassName="uppercase"
                error={errors.gstin?.message}
              />

              <Input
                name="pan_number"
                label={t('customers.panNumber')}
                control={control}
                placeholder="AAAAA0000A"
                inputClassName="uppercase"
                error={errors.pan_number?.message}
              />

              <div className="md:col-span-2">
                <Input
                  name="business_name"
                  label={t('customers.businessName')}
                  control={control}
                  placeholder={t('customers.enterBusinessName')}
                  error={errors.business_name?.message}
                />
              </div>

              <Select
                name="billing_type"
                label={t('customers.billingType')}
                control={control}
                options={billingTypeOptions}
                error={errors.billing_type?.message}
              />

              <Select
                name="price_category"
                label={t('customers.priceCategory')}
                control={control}
                options={priceCategoryOptions}
                error={errors.price_category?.message}
              />
            </div>
          )}

          {/* Account & Payment Tab */}
          {activeTab === 'account' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                name="opening_balance"
                label={t('customers.openingBalance')}
                type="number"
                control={control}
                placeholder={t('customers.enterOpeningBalance')}
                error={errors.opening_balance?.message}
              />

              <Select
                name="balance_type"
                label={t('customers.balanceType')}
                control={control}
                options={balanceTypeOptions}
                error={errors.balance_type?.message}
              />

              <Input
                name="credit_limit"
                label={t('customers.creditLimit')}
                type="number"
                control={control}
                placeholder={t('customers.enterCreditLimit')}
                error={errors.credit_limit?.message}
              />

              <Input
                name="loyalty_points"
                label={t('customers.loyaltyPoints')}
                type="number"
                control={control}
                placeholder="0"
                error={errors.loyalty_points?.message}
              />

              <Select
                name="payment_terms"
                label={t('customers.paymentTerms')}
                control={control}
                options={paymentTermsOptions}
                error={errors.payment_terms?.message}
              />

              <Select
                name="payment_method"
                label={t('customers.paymentMethod')}
                control={control}
                options={paymentMethodOptions}
                error={errors.payment_method?.message}
              />

              <Select
                name="price_level"
                label={t('customers.priceLevel')}
                control={control}
                options={priceLevelOptions}
                error={errors.price_level?.message}
              />
            </div>
          )}

          {/* Bank Details Tab */}
          {activeTab === 'bank' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                name="bank_name"
                label={t('customers.bankName')}
                control={control}
                placeholder={t('customers.enterBankName')}
                error={errors.bank_name?.message}
              />

              <Input
                name="account_number"
                label={t('customers.accountNumber')}
                control={control}
                placeholder={t('customers.enterAccountNumber')}
                error={errors.account_number?.message}
              />

              <Input
                name="ifsc_code"
                label={t('customers.ifscCode')}
                control={control}
                placeholder="ABCD0123456"
                inputClassName="uppercase"
                error={errors.ifsc_code?.message}
              />

              <Input
                name="upi_id"
                label={t('customers.upiId')}
                control={control}
                placeholder={t('customers.enterUpiId')}
                error={errors.upi_id?.message}
              />
            </div>
          )}

          {/* Other Info Tab */}
          {activeTab === 'other' && (
            <div className="space-y-4">
              <Textarea
                name="notes"
                label={t('customers.notesRemarks')}
                control={control}
                placeholder={t('customers.enterNotes')}
                rows={6}
                error={errors.notes?.message}
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmClose}
        title={t('common.discardChanges')}
        message={t('common.discardChangesMessage')}
        confirmText={t('common.discard')}
        cancelText={t('common.continueEditing')}
      />
    </Fragment>
  );
};

export default AddEditForm;