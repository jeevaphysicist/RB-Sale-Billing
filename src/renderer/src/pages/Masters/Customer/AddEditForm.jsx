import React, { useEffect, useState, useRef, Fragment } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form, Input, Select, AutocompleteSelect } from '../../../components/Form';
import Modal from '../../../components/Modal';
import { User } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../../services/customerService';
import ConfirmationDialog from '../../../components/ConfirmationDialog';

export const STATES = [
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
      notes: '',
      vehicle_number: ''
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
          notes: '',
          vehicle_number: ''
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
  };

  const stateOptions = STATES.map(state => ({
    value: state,
    label: state
  }));

  const statusOptions = [
    { value: 'Active', label: t('common.active') },
    { value: 'Inactive', label: t('common.inactive') }
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
        <form className="space-y-4">
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
                    rules={{ required: t('forms.required') }}
                    error={errors.mobile_number?.message}
                  />

                  <Input
                    name="gstin"
                    label={t('customers.gstin')}
                    control={control}
                    placeholder={t('customers.enterGSTNumber')}
                    inputClassName="uppercase"
                    error={errors.gstin?.message}
                  />

                  <AutocompleteSelect
                    name="state"
                    label={t('customers.state')}
                    control={control}
                    options={stateOptions}
                    placeholder={t('customers.selectState')}
                    rules={{ required: t('forms.required') }}
                    error={errors.state?.message}
                    disabled={pincodeLoading}
                  />

                  <Select
                    name="customer_status"
                    label={t('common.status')}
                    control={control}
                    options={statusOptions}
                    error={errors.customer_status?.message}
                  />

                  <Input
                    name="vehicle_number"
                    label={t('customers.vehicleNumber')}
                    control={control}
                    placeholder={t('customers.enterVehicleNumber')}
                    inputClassName="uppercase"
                    rules={{ required: t('forms.required') }}
                    error={errors.vehicle_number?.message}
                  />

                  <div className="md:col-span-2">
                    <Input
                      name="address_line_1"
                      label={t('customers.addressLine1')}
                      control={control}
                      placeholder={t('customers.enterAddressLine1')}
                      error={errors.address_line_1?.message}
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
                    name="country"
                    label={t('customers.country')}
                    control={control}
                    disabled
                    error={errors.country?.message}
                  />
                </div>
              </div>
            </div>
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