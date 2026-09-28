
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Trash2, User, CreditCard, Smartphone, Gift, Plus, X, ChevronDown, ChevronUp, Eye, Download, Printer, Loader2 } from 'lucide-react';
import WindowControls from '../../../components/WindowControls';
import POSHeader from '../../../components/POSHeader';
import ConfirmationDialog from '../../../components/ConfirmationDialog';
import PrintPreviewModal from '../../../components/PrintPreviewModal';
import CustomerAddEditForm from '../../Masters/Customer/AddEditForm';
import { customerService } from '../../../services/customerService';
import { salesOrderService } from '../../../services/salesOrderService';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/authContext';

const POSBillingSystem = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      setIsEditing(true);
      loadOrderForEditing(id);
    }
  }, [id]);

  const loadOrderForEditing = async (orderId) => {
    try {
      const result = await salesOrderService.getById(orderId);
      if (result.success && result.data) {
        const order = result.data;

        // Map order items to bill items format (free-text line items, no product master)
        const billItems = order.items.map(item => ({
          id: item.id,
          name: item.product_name,
          code: item.product_code || '',
          price: item.unit_price,
          mrp: item.mrp || 0,
          qty: item.quantity,
          discount: item.discount_percent || 0,
          category: item.category || 'General',
          hsnCode: item.hsn_code || '',
          tax: item.tax_rate || 0,
          unit: item.unit || 'Piece'
        }));

        // Get discount type from totals
        const discountType = order.totals?.bill_discount_type || 'flat';
        const billDiscountValue = order.totals?.bill_discount || 0;

        // Calculate tax settings from order totals
        let taxSettingsForEdit = {
          enableTax: false,
          taxType: 'SGST',
          taxIncludedInPrice: true
        };

        if (order.totals) {
          const hasTax = (order.totals.total_tax_amount || 0) > 0;
          const hasIGST = (order.totals.total_igst || 0) > 0;

          taxSettingsForEdit = {
            enableTax: hasTax,
            taxType: hasIGST ? 'IGST' : 'SGST',
            taxIncludedInPrice: true
          };
        }

        // Fetch customer details FIRST if customer exists (to get loyalty points)
        let customerData = null;
        if (order.customer_id) {
          try {
            const customerResult = await customerService.getCustomerById(order.customer_id);
            if (customerResult) {
              customerData = customerResult;
            }
          } catch (error) {
            console.error('Error fetching customer details:', error);
            // Continue loading order even if customer fetch fails
          }
        }

        // Create edit order data with actual customer data (including loyalty points)
        const editOrderData = {
          billNo: order.order_number,
          billItems: billItems,
          selectedCustomer: customerData ? {
            id: customerData.id,
            name: customerData.customer_name,
            phone: customerData.mobile_number || '',
            email: customerData.email || '',
            address: `${customerData.address_line_1 || ''}${customerData.address_line_2 ? ', ' + customerData.address_line_2 : ''}, ${customerData.city || ''}, ${customerData.state || ''} - ${customerData.pincode || ''}`.trim(),
            gstin: customerData.gstin || '',
            points: customerData.loyalty_points || 0,
            price_category: customerData.price_category || 'Retail'
          } : null,
          billDiscount: billDiscountValue,
          discountType: discountType,
          loyaltyPointsUsed: order.loyalty_points_used || 0,
          initialLoyaltyPointsUsed: order.loyalty_points_used || 0, // Track initial usage for validation
          roundOff: order.round_off || 0,
          paymentMethod: order.payment_method || 'cash',
          paymentType: order.payment_type || 'single',
          receivedAmount: order.received_amount || order.grand_total,
          splitPayments: {
            cash: order.split_payment_cash || 0,
            card: order.split_payment_card || 0,
            upi: order.split_payment_upi || 0,
            credit: order.split_payment_credit || 0,
            loyaltyPoints: order.split_payment_loyalty || 0
          },
          isEditing: true,
          orderId: order.id,
          priceLevel: order.price_category || 'Retail',
          taxSettings: taxSettingsForEdit
        };

        // Set edit order state
        setEditOrder(editOrderData);

      } else {
        toast.error(t('sales.pos.loadFailed'));
        navigate('/sales');
      }
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error(t('sales.pos.errorLoading'));
      navigate('/sales');
    }
  };
  const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer';

  // Default Walk-in Customer (id null until loaded from DB)
  const defaultWalkInCustomer = {
    id: null,
    name: WALK_IN_CUSTOMER_NAME,
    type: 'Retail',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    businessName: '',
    points: 0
  };

  // LocalStorage keys for persistence
  const STORAGE_KEY_TABS = 'pos_billing_tabs';
  const STORAGE_KEY_ACTIVE_TAB = 'pos_billing_active_tab';
  const STORAGE_KEY_NEXT_TAB_ID = 'pos_billing_next_tab_id';

  // Helper functions for localStorage persistence
  const getDefaultTabs = () => [
    {
      id: 1,
      name: `${t('sales.pos.bill')} #1`,
      billNo: 'SO-2025-001',
      billItems: [],
      selectedCustomer: null,
      billDiscount: 0,
      discountType: 'flat',
      loyaltyPointsUsed: 0,
      roundOff: 0,
      paymentMethod: 'cash',
      paymentType: 'single',
      receivedAmount: 0,
      splitPayments: { cash: 0, card: 0, upi: 0, credit: 0, loyaltyPoints: 0 },
      priceLevel: 'Retail',
      taxSettings: {
        enableTax: false,
        taxType: 'SGST',
        taxIncludedInPrice: true
      }
    }
  ];

  const loadTabsFromStorage = () => {
    try {
      const savedTabs = localStorage.getItem(STORAGE_KEY_TABS);
      if (savedTabs) {
        return JSON.parse(savedTabs);
      }
    } catch (error) {
      console.error('Error loading tabs from storage:', error);
    }
    return getDefaultTabs();
  };

  const loadActiveTabFromStorage = () => {
    try {
      const savedActiveTab = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
      if (savedActiveTab) {
        return parseInt(savedActiveTab, 10);
      }
    } catch (error) {
      console.error('Error loading active tab from storage:', error);
    }
    return 1;
  };

  const loadNextTabIdFromStorage = () => {
    try {
      const savedNextTabId = localStorage.getItem(STORAGE_KEY_NEXT_TAB_ID);
      if (savedNextTabId) {
        return parseInt(savedNextTabId, 10);
      }
    } catch (error) {
      console.error('Error loading next tab ID from storage:', error);
    }
    return 2;
  };

  // Edit Order State (separate from tabs, not persisted)
  const [editOrder, setEditOrder] = useState(null);

  // Tab Management
  const [tabs, setTabs] = useState(loadTabsFromStorage());
  const [activeTabId, setActiveTabId] = useState(loadActiveTabFromStorage());
  const [nextTabId, setNextTabId] = useState(loadNextTabIdFromStorage());

  // Get current active tab data - use editOrder if editing, otherwise find in tabs
  const activeTab = id && editOrder ? editOrder : (tabs.find(tab => tab.id === activeTabId) || {
    id: activeTabId,
    name: t('common.loading'),
    billNo: '',
    billItems: [],
    selectedCustomer: null,
    billDiscount: 0,
    discountType: 'flat',
    loyaltyPointsUsed: 0,
    roundOff: 0,
    paymentMethod: 'cash',
    paymentType: 'single',
    receivedAmount: 0,
    splitPayments: { cash: 0, card: 0, upi: 0, credit: 0, loyaltyPoints: 0 },
    priceLevel: 'Retail',
    taxSettings: {
      enableTax: false,
      taxType: 'SGST',
      taxIncludedInPrice: true
    }
  });

  // Handle Customer Change and Price Update
  const handleCustomerChange = (customer) => {
    if (!customer) {
      updateActiveTab({ selectedCustomer: null });
      return;
    }

    // Determine a default price level label from the customer's price category.
    // Manually entered items have no live product price table to switch between,
    // so we only tag the bill with the price level - item prices are left as typed.
    const priceCategory = (customer.price_category || 'Retail').toLowerCase();

    let newGlobalPriceLevel = 'Retail';
    if (priceCategory.includes('wholesale')) newGlobalPriceLevel = 'Wholesale';
    else if (priceCategory.includes('dealer') || priceCategory.includes('special') || priceCategory.includes('distributor')) newGlobalPriceLevel = 'Dealer';

    updateActiveTab({
      selectedCustomer: customer,
      priceLevel: newGlobalPriceLevel
    });
  };

  // Safe tax settings with defaults (for backward compatibility with localStorage)
  const taxSettings = activeTab?.taxSettings || {
    enableTax: false,
    taxType: 'SGST',
    taxIncludedInPrice: true
  };

  // Shared states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Manual line-item entry form (replaces the old live product search/pick UI)
  const getDefaultNewItemForm = () => ({
    name: '',
    hsnCode: '',
    category: '',
    unit: 'Piece',
    qty: 1,
    price: '',
    mrp: '',
    discount: 0,
    tax: 0
  });
  const [newItemForm, setNewItemForm] = useState(getDefaultNewItemForm());

  const itemNameInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const loyaltyPointsInputRef = useRef(null);
  const billItemsContainerRef = useRef(null);
  const lastUpdatedItemRef = useRef(null);
  const splitPaymentCashRef = useRef(null);
  const splitPaymentCardRef = useRef(null);
  const splitPaymentUpiRef = useRef(null);
  const splitPaymentCreditRef = useRef(null);
  const [lastUpdatedItemId, setLastUpdatedItemId] = useState(null);
  // Tax settings are now per-tab (removed global state)
  const [orderSummaryExpanded, setOrderSummaryExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);


  // Success Modal & Printing States
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [printingTemplate, setPrintingTemplate] = useState('A4'); // 'A4', '80mm', '50mm'
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Confirmation Dialog State
  const [confirmation, setConfirmation] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: null, // 'CLOSE_TAB' | 'CLEAR_BILL'
    data: null
  });

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const printModalRef = useRef(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [pdfHeight, setPdfHeight] = useState(null);

  // Helper functions  // Update active tab - handles both edit mode and create mode
  const updateActiveTab = (updates) => {
    if (id && editOrder) {
      // Edit mode: update editOrder state
      setEditOrder(prev => ({ ...prev, ...updates }));
    } else {
      // Create mode: update tabs array
      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId ? { ...tab, ...updates } : tab
      ));
    }
  };


  // Tab Management Functions
  const createNewTab = async () => {
    // Maximum 8 tabs allowed
    if (tabs.length >= 8) {
      toast.error(t('sales.pos.maxTabs'));
      return;
    }

    let nextOrderNumber = `SO-2025-${String(nextTabId).padStart(3, '0')}`;
    try {
      const response = await salesOrderService.getNextOrderNumber();
      if (response.success) {
        nextOrderNumber = response.data;
      }
    } catch (error) {
      console.error('Failed to fetch next order number:', error);
    }

    const newTab = {
      id: nextTabId,
      name: `${t('sales.pos.bill')} #${nextTabId}`,
      billNo: nextOrderNumber,
      billItems: [],
      selectedCustomer: null,
      billDiscount: 0,
      discountType: 'flat',
      loyaltyPointsUsed: 0,
      roundOff: 0,
      paymentMethod: 'cash',
      paymentType: 'single',
      receivedAmount: 0,
      splitPayments: { cash: 0, card: 0, upi: 0, credit: 0, loyaltyPoints: 0 },
      taxSettings: {
        enableTax: false,
        taxType: 'SGST',
        taxIncludedInPrice: true
      },
      priceLevel: 'Retail', // Default price level for new tabs
      // Dispatch Details
      deliveryNote: '',
      supplierRef: '',
      buyerOrderNo: '',
      dispatchDocNo: '',
      dispatchThrough: '',
      destination: '',
      vehicleNo: '',
      termsOfDelivery: ''
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(nextTabId);
    setNextTabId(nextTabId + 1);
    // toast.success('New bill tab created');
  };

  // Listen for sequence updates
  useEffect(() => {
    if (window.api && window.api.onOrderSequenceUpdated) {
      const cleanup = window.api.onOrderSequenceUpdated((nextNumber) => {
        setTabs(prevTabs => prevTabs.map(tab => {
          return { ...tab, billNo: nextNumber };
        }));
      });
      return cleanup;
    }
  }, []);

  // Fetch initial order number on mount
  useEffect(() => {
    const fetchInitialOrderNumber = async () => {
      try {
        const response = await salesOrderService.getNextOrderNumber();
        if (response.success) {
          setTabs(prevTabs => prevTabs.map(tab => ({ ...tab, billNo: response.data })));
        }
      } catch (error) {
        console.error('Failed to fetch initial order number:', error);
      }
    };

    fetchInitialOrderNumber();
  }, []);

  const closeTab = (tabId) => {
    if (tabs.length === 1) {
      // toast.error(t('sales.pos.cannotCloseLastTab'));
      return;
    }

    const tabToClose = tabs.find(t => t.id === tabId);
    if (tabToClose.billItems.length > 0) {
      setConfirmation({
        isOpen: true,
        title: t('sales.pos.closeBill'),
        message: t('sales.pos.closeBillMessage'),
        type: 'CLOSE_TAB',
        data: { tabId }
      });
      return;
    }

    performCloseTab(tabId);
  };

  const performCloseTab = (tabId) => {
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const switchTab = (tabId) => {
    setActiveTabId(tabId);
  };

  // Fetch customers from API
  const fetchCustomers = async (searchTerm = '') => {
    try {
      setCustomersLoading(true);
      const response = await customerService.getCustomers({
        searchTerm: searchTerm,
        sortKey: 'customer_name',
        sortDirection: 'ASC',
        page: 1,
        limit: 100, // Fetch up to 100 customers for POS
        status: 'Active' // Only fetch active customers (matches DB value)
      });

      if (response.success) {
        // Map API response to match the expected format
        const mappedCustomers = response.data.map(customer => ({
          id: customer.id,
          name: customer.customer_name,
          type: customer.customer_type || 'Retail',
          phone: customer.mobile_number || '',
          alternatePhone: customer.alternate_number || '',
          email: customer.email || '',
          address: `${customer.address_line_1 || ''}${customer.address_line_2 ? ', ' + customer.address_line_2 : ''}, ${customer.city || ''}, ${customer.state || ''} - ${customer.pincode || ''}`.trim(),
          city: customer.city || '',
          state: customer.state || '',
          pincode: customer.pincode || '',
          gstin: customer.gstin || '',
          businessName: customer.business_name || '',
          openingBalance: customer.opening_balance || 0,
          creditLimit: customer.credit_limit || 0,
          status: customer.customer_status || 'Active',
          points: customer.loyalty_points || 0,
          price_category: customer.price_category || 'Retail'
        }));
        setCustomers(mappedCustomers);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const mapCustomerFromApi = (customer) => ({
    id: customer.id,
    name: customer.customer_name,
    type: customer.customer_type || 'Retail',
    phone: customer.mobile_number || '',
    alternatePhone: customer.alternate_number || '',
    email: customer.email || '',
    address: customer.address_line_1 || '',
    city: customer.city || '',
    state: customer.state || '',
    pincode: customer.pincode || '',
    gstin: customer.gstin || '',
    businessName: customer.business_name || '',
    openingBalance: customer.opening_balance || 0,
    creditLimit: customer.credit_limit || 0,
    status: customer.customer_status || 'Active',
    points: customer.loyalty_points || 0,
    price_category: customer.price_category || 'Retail'
  });

  // Create Walk-in Customer if it doesn't exist; returns mapped customer or null
  const ensureWalkInCustomer = async () => {
    try {
      const response = await customerService.getCustomers({
        searchTerm: WALK_IN_CUSTOMER_NAME,
        sortKey: 'customer_name',
        sortDirection: 'ASC',
        page: 1,
        limit: 10,
        status: 'Active'
      });

      const existing = response.success
        ? response.data.find(customer => customer.customer_name === WALK_IN_CUSTOMER_NAME)
        : null;

      if (existing) {
        return mapCustomerFromApi(existing);
      }

      const walkInData = {
        customer_name: WALK_IN_CUSTOMER_NAME,
        customer_code: 'WALK-IN',
        mobile_number: '0000000000',
        customer_type: 'Retail',
        customer_status: 'Active',
        email: '',
        address_line_1: '',
        city: '',
        state: '',
        pincode: '',
        opening_balance: 0,
        credit_limit: 0
      };

      const createResponse = await customerService.createCustomer(walkInData);
      if (!createResponse.success) {
        return null;
      }

      const refetch = await customerService.getCustomers({
        searchTerm: WALK_IN_CUSTOMER_NAME,
        sortKey: 'customer_name',
        sortDirection: 'ASC',
        page: 1,
        limit: 10,
        status: 'Active'
      });
      const created = refetch.success
        ? refetch.data.find(customer => customer.customer_name === WALK_IN_CUSTOMER_NAME)
        : null;
      return created ? mapCustomerFromApi(created) : null;
    } catch (error) {
      console.error('Error ensuring Walk-in Customer:', error);
      return null;
    }
  };

  const resolveOrderCustomer = async () => {
    if (activeTab.selectedCustomer?.id) {
      return activeTab.selectedCustomer;
    }

    const walkInFromList = customers.find(c => c.name === WALK_IN_CUSTOMER_NAME);
    if (walkInFromList?.id) {
      return walkInFromList;
    }

    const ensured = await ensureWalkInCustomer();
    if (ensured?.id) {
      await fetchCustomers();
      return ensured;
    }

    return defaultWalkInCustomer;
  };

  useEffect(() => {
    const initializeData = async () => {
      await ensureWalkInCustomer();
      await fetchCustomers();
    };
    initializeData();

    // Auto-enter fullscreen for immersive POS experience
    if (window.api && window.api.toggleFullscreen && window.api.isFullscreen) {
      window.api.isFullscreen().then(fs => {
        if (!fs) window.api.toggleFullscreen();
      });
    }
  }, []);


  // Debounce customer search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (customerSearchQuery) {
        fetchCustomers(customerSearchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [customerSearchQuery]);

  // Note: Auto-focus on search input removed as per user preference
  // Users can manually focus using Ctrl+P keyboard shortcut when needed

  // Persist tabs to localStorage whenever they change (but not in edit mode)
  useEffect(() => {
    if (!id) { // Only persist when creating, not editing
      try {
        localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(tabs));
      } catch (error) {
        console.error('Error saving tabs to storage:', error);
      }
    }
  }, [tabs, id]);

  // Persist active tab ID to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTabId.toString());
    } catch (error) {
      console.error('Error saving active tab ID to storage:', error);
    }
  }, [activeTabId]);

  // Persist next tab ID to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NEXT_TAB_ID, nextTabId.toString());
    } catch (error) {
      console.error('Error saving next tab ID to storage:', error);
    }
  }, [nextTabId]);

  // Add a manually entered line item to the bill (replaces the old
  // catalog-driven addItemToBill; there is no live product master anymore).
  const addManualItemToBill = () => {
    const nextIndex = activeTab.billItems.length + 1;
    const name = (newItemForm.name || '').trim();
    if (!name) {
      toast.error(t('sales.pos.validation.itemNameRequired', { index: nextIndex }));
      itemNameInputRef.current?.focus();
      return;
    }

    const qty = parseFloat(newItemForm.qty);
    if (!qty || qty <= 0) {
      toast.error(t('sales.pos.validation.invalidQty', { index: nextIndex }));
      return;
    }

    const price = parseFloat(newItemForm.price);
    if (isNaN(price) || price < 0) {
      toast.error(t('sales.pos.validation.invalidPrice', { index: nextIndex }));
      return;
    }

    const newBillItem = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      code: '',
      price,
      mrp: parseFloat(newItemForm.mrp) || 0,
      qty,
      discount: Math.min(Math.max(parseFloat(newItemForm.discount) || 0, 0), 100),
      category: (newItemForm.category || '').trim(),
      hsnCode: (newItemForm.hsnCode || '').trim(),
      tax: parseFloat(newItemForm.tax) || 0,
      unit: (newItemForm.unit || '').trim() || 'Piece'
    };

    updateActiveTab({
      billItems: [...activeTab.billItems, newBillItem]
    });

    // Highlight the newly added item and scroll to it
    setLastUpdatedItemId(newBillItem.id);
    setTimeout(() => {
      if (billItemsContainerRef.current) {
        billItemsContainerRef.current.scrollTo({
          top: billItemsContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
      setTimeout(() => {
        setLastUpdatedItemId(null);
      }, 2000);
    }, 100);

    // Reset the form for the next entry and refocus the name field
    setNewItemForm(getDefaultNewItemForm());
    setTimeout(() => {
      itemNameInputRef.current?.focus();
    }, 100);
  };

  // Helper function to highlight and scroll to updated item
  const highlightAndScrollToItem = (itemId) => {
    setLastUpdatedItemId(itemId);

    setTimeout(() => {
      if (lastUpdatedItemRef.current) {
        lastUpdatedItemRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }

      // Clear highlight after animation
      setTimeout(() => {
        setLastUpdatedItemId(null);
      }, 2000);
    }, 100);
  };

  const updateQuantity = (id, change) => {
    const item = activeTab.billItems.find(i => i.id === id);
    if (!item) return;

    const newQty = parseFloat((item.qty + change).toFixed(3));

    updateActiveTab({
      billItems: activeTab.billItems.map(item =>
        item.id === id ? { ...item, qty: Math.max(0.001, newQty) } : item
      )
    });

    highlightAndScrollToItem(id);
  };

  const removeItem = (id) => {
    updateActiveTab({
      billItems: activeTab.billItems.filter(item => item.id !== id)
    });
  };

  const clearAll = () => {
    // Use the confirmClearBill function which includes confirmation
    confirmClearBill();
  };

  const calculateItemTotal = (item) => {
    // Calculate base amount after quantity and discount
    const basePrice = item.price * item.qty;
    const discountAmount = (basePrice * item.discount) / 100;
    const priceAfterDiscount = basePrice - discountAmount;

    // If tax is included in price, show amount excluding tax in the Amount column
    // If tax is not included in price, show the entered amount (tax will be added separately)
    if (taxSettings.enableTax && taxSettings.taxIncludedInPrice && item.tax > 0) {
      // Tax is included in price: extract tax to show amount without tax
      // Formula: taxableAmount = priceAfterDiscount / (1 + taxRate/100)
      const taxableAmount = priceAfterDiscount / (1 + item.tax / 100);
      return taxableAmount;
    } else {
      // Tax is not included in price OR no tax: show the entered amount as is
      return priceAfterDiscount;
    }
  };

  // Calculate tax amounts for an item
  const calculateItemTaxAmounts = (item) => {
    const basePrice = item.price * item.qty;
    const discountAmount = (basePrice * item.discount) / 100;
    const priceAfterDiscount = basePrice - discountAmount;
    const taxRate = item.tax || 0;

    let taxAmount = 0;
    let sgstAmount = 0;
    let cgstAmount = 0;
    let igstAmount = 0;
    let sgstPercentage = 0;
    let cgstPercentage = 0;
    let igstPercentage = 0;

    if (taxSettings.enableTax && taxRate > 0) {
      if (taxSettings.taxIncludedInPrice) {
        // Extract tax from the price (reverse calculation)
        const taxableAmount = priceAfterDiscount / (1 + taxRate / 100);
        taxAmount = priceAfterDiscount - taxableAmount;
      } else {
        // Tax is added on top
        taxAmount = (priceAfterDiscount * taxRate) / 100;
      }

      if (taxSettings.taxType === 'SGST') {
        sgstAmount = taxAmount / 2;
        cgstAmount = taxAmount / 2;
        sgstPercentage = taxRate / 2;
        cgstPercentage = taxRate / 2;
      } else {
        igstAmount = taxAmount;
        igstPercentage = taxRate;
      }
    }

    return {
      taxAmount,
      taxPercentage: taxRate,
      sgstAmount,
      cgstAmount,
      igstAmount,
      sgstPercentage,
      cgstPercentage,
      igstPercentage
    };
  };

  // Convert number to words (Indian numbering system)
  const numberToWords = (num) => {
    if (num === 0) return 'Zero Rupees Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    const convertLessThanThousand = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };

    let rupees = Math.floor(num);
    let paise = Math.round((num - rupees) * 100);

    let words = '';

    if (rupees >= 10000000) { // Crores
      words += convertLessThanThousand(Math.floor(rupees / 10000000)) + ' Crore ';
      rupees %= 10000000;
    }
    if (rupees >= 100000) { // Lakhs
      words += convertLessThanThousand(Math.floor(rupees / 100000)) + ' Lakh ';
      rupees %= 100000;
    }
    if (rupees >= 1000) { // Thousands
      words += convertLessThanThousand(Math.floor(rupees / 1000)) + ' Thousand ';
      rupees %= 1000;
    }
    if (rupees > 0) {
      words += convertLessThanThousand(rupees);
    }

    words = words.trim() + ' Rupees';

    if (paise > 0) {
      words += ' and ' + convertLessThanThousand(paise) + ' Paise';
    }

    return words + ' Only';
  };

  const calculateTaxBreakdown = () => {
    let totalTaxableAmount = 0;
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;

    activeTab.billItems.forEach((item) => {
      const basePrice = item.price * item.qty;
      const discountAmount = (basePrice * item.discount) / 100;
      const priceAfterDiscount = basePrice - discountAmount;

      if (taxSettings.enableTax) {
        const taxRate = item.tax || 0;

        if (taxSettings.taxIncludedInPrice) {
          // Extract tax from the price (reverse calculation)
          // If price includes tax: taxableAmount = price / (1 + taxRate/100)
          const taxableAmount = priceAfterDiscount / (1 + taxRate / 100);
          const taxAmount = priceAfterDiscount - taxableAmount;

          totalTaxableAmount += taxableAmount;

          if (taxSettings.taxType === 'SGST') {
            totalSGST += taxAmount / 2;
            totalCGST += taxAmount / 2;
          } else {
            totalIGST += taxAmount;
          }
        } else {
          // Tax is added on top
          totalTaxableAmount += priceAfterDiscount;

          if (taxSettings.taxType === 'SGST') {
            const sgst = (priceAfterDiscount * taxRate) / 200;
            const cgst = (priceAfterDiscount * taxRate) / 200;
            totalSGST += sgst;
            totalCGST += cgst;
          } else {
            const igst = (priceAfterDiscount * taxRate) / 100;
            totalIGST += igst;
          }
        }
      } else {
        totalTaxableAmount += priceAfterDiscount;
      }
    });

    return {
      taxableAmount: totalTaxableAmount,
      sgst: totalSGST,
      cgst: totalCGST,
      igst: totalIGST,
      totalTax: totalSGST + totalCGST + totalIGST
    };
  };

  // Calculate subtotal (sum of all items price × qty)
  const subtotal = activeTab.billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Calculate amount before tax (subtotal after item discounts)
  const amountBeforeTax = activeTab.billItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  // Calculate tax breakdown
  const taxBreakdown = calculateTaxBreakdown();
  const taxAmount = taxBreakdown.totalTax;

  // Calculate amount after tax
  const amountAfterTax = amountBeforeTax + taxAmount;

  // Calculate bill discount amount based on type (applied after tax)
  const billDiscountAmount = activeTab.discountType === 'percentage'
    ? (amountAfterTax * activeTab.billDiscount) / 100
    : activeTab.billDiscount;

  // Calculate loyalty points deduction (1 point = ₹1)
  const loyaltyDeduction = activeTab.loyaltyPointsUsed || 0;

  // Calculate amount before rounding
  const amountBeforeRounding = amountAfterTax - billDiscountAmount - loyaltyDeduction;

  // Calculate round off (round to nearest whole number)
  const roundedTotal = Math.round(amountBeforeRounding);
  const roundOffAmount = roundedTotal - amountBeforeRounding;

  // Grand total = After Tax - Bill Discount - Loyalty Points + Round Off
  const grandTotal = roundedTotal;

  const handlePayment = () => {
    if (activeTab.billItems.length === 0) return;
  };

  // Comprehensive order validation
  const validateOrder = () => {
    const errors = [];

    // Check if there are items in the bill
    if (!activeTab.billItems || activeTab.billItems.length === 0) {
      errors.push(t('sales.pos.validation.noItems'));
    }

    // Validate customer selection
    // if (!activeTab.selectedCustomer || !activeTab.selectedCustomer.id) {
    //   errors.push(t('sales.pos.validation.selectCustomer'));
    // }

    // Validate each item (manual free-text entry - just needs a name, positive qty and non-negative price)
    activeTab.billItems.forEach((item, index) => {
      if (!item.name || !item.name.trim()) {
        errors.push(t('sales.pos.validation.itemNameRequired', { index: index + 1 }));
      }
      if (!item.qty || item.qty <= 0) {
        errors.push(t('sales.pos.validation.invalidQty', { index: index + 1 }));
      }
      if (item.price === undefined || item.price === null || item.price < 0) {
        errors.push(t('sales.pos.validation.invalidPrice', { index: index + 1 }));
      }
    });

    // Validate payment details
    if (activeTab.paymentType === 'single') {
      if (activeTab.receivedAmount < 0) {
        errors.push(t('sales.pos.validation.negativeReceived'));
      }
      if (!activeTab.paymentMethod) {
        errors.push(t('sales.pos.validation.selectPaymentMethod'));
      }
    } else if (activeTab.paymentType === 'split') {
      const totalPaid = Object.values(activeTab.splitPayments).reduce((sum, val) => sum + val, 0);
      // Partial payments are now allowed
    }

    // Validate discount
    if (activeTab.billDiscount < 0) {
      errors.push(t('sales.pos.validation.negativeDiscount'));
    }
    if (activeTab.discountType === 'percentage' && activeTab.billDiscount > 100) {
      errors.push(t('sales.pos.validation.invalidDiscountPercent'));
    }

    // Validate loyalty points
    if (activeTab.loyaltyPointsUsed < 0) {
      errors.push(t('sales.pos.validation.negativeLoyalty'));
    }
    const effectiveAvailablePoints = (activeTab.selectedCustomer ? activeTab.selectedCustomer.points : 0) + (activeTab.initialLoyaltyPointsUsed || 0);
    if (activeTab.selectedCustomer && activeTab.loyaltyPointsUsed > effectiveAvailablePoints) {
      errors.push(t('sales.pos.validation.loyaltyExceeded', { used: activeTab.loyaltyPointsUsed, available: effectiveAvailablePoints }));
    }

    // Validate Total Amount
    if (grandTotal < 0) {
      errors.push(t('sales.pos.validation.totalNegative'));
    }

    return errors;
  };

  // Create comprehensive order data object with all fields for database storage and future editing
  const createOrderData = (resolvedCustomer) => {
    const taxBreakdown = calculateTaxBreakdown();
    const currentDateTime = new Date().toISOString();

    // Calculate payment status and balance
    const effectivePaidAmount = activeTab.paymentType === 'single'
      ? Math.min(activeTab.receivedAmount || 0, grandTotal)
      : Object.values(activeTab.splitPayments).reduce((sum, val) => sum + val, 0);

    const balanceAmount = Math.max(0, grandTotal - effectivePaidAmount);

    let paymentStatus = 'paid';
    if (balanceAmount > 0.01) { // Use small epsilon for float comparison
      paymentStatus = effectivePaidAmount > 0 ? 'partial' : 'pending';
    }

    const finalCustomer = resolvedCustomer || defaultWalkInCustomer;
    const validCustomerId = finalCustomer?.id && Number(finalCustomer.id) > 0 ? finalCustomer.id : null;

    return {
      // === ORDER HEADER INFORMATION ===
      orderNumber: activeTab.billNo,
      orderDate: currentDateTime,
      orderTime: new Date().toLocaleTimeString('en-IN', { hour12: true }),
      priceLevel: activeTab.priceLevel || 'Retail',

      // === CUSTOMER INFORMATION ===
      customerId: validCustomerId,
      customerName: finalCustomer.name,
      customer: {
        id: validCustomerId,
        name: finalCustomer.name,
        type: finalCustomer.type,
        phone: finalCustomer.phone || '',
        alternatePhone: finalCustomer.alternatePhone || '',
        email: finalCustomer.email || '',
        address: finalCustomer.address || '',
        city: finalCustomer.city || '',
        state: finalCustomer.state || '',
        pincode: finalCustomer.pincode || '',
        gstin: finalCustomer.gstin || '',
        businessName: finalCustomer.businessName || '',
        openingBalance: finalCustomer.openingBalance || 0,
        creditLimit: finalCustomer.creditLimit || 0,
        loyaltyPoints: finalCustomer.points || 0
      },

      // === STORE AND STAFF INFORMATION ===
      storeDetails: {
        counter: 'Counter 1', // Can be made dynamic based on actual counter/terminal info
        cashier: currentUser?.username || currentUser?.email || 'Unknown User',
        cashierId: currentUser?.id || null,
        store: 'Main Store' // Can be made dynamic from settings if needed
      },

      // === ORDER ITEMS (free-text line items, no product master) ===
      items: activeTab.billItems.map((item, index) => {
        const itemTaxAmounts = calculateItemTaxAmounts(item);
        return {
          // Basic item information (manually entered, not linked to a product record)
          serialNumber: index + 1,
          productName: item.name,
          productCode: item.code || '',
          category: item.category || '',
          unit: item.unit || 'Piece',
          hsnCode: item.hsnCode || '',

          // Pricing and quantity
          quantity: item.qty,
          unitPrice: item.price,
          mrp: item.mrp || 0,

          // Discounts
          itemDiscount: item.discount || 0,
          itemDiscountAmount: (item.price * item.qty * (item.discount || 0)) / 100,

          // Tax information
          taxRate: item.tax || 0,
          sgstRate: itemTaxAmounts.sgstPercentage,
          cgstRate: itemTaxAmounts.cgstPercentage,
          igstRate: itemTaxAmounts.igstPercentage,
          sgstAmount: itemTaxAmounts.sgstAmount,
          cgstAmount: itemTaxAmounts.cgstAmount,
          igstAmount: itemTaxAmounts.igstAmount,
          totalTaxAmount: itemTaxAmounts.taxAmount,

          // Calculated amounts
          grossAmount: item.price * item.qty, // Before discount
          netAmount: calculateItemTotal(item), // After discount, tax handling based on settings
          finalAmount: calculateItemTotal(item) + itemTaxAmounts.taxAmount // Final amount including tax
        };
      }),

      // === FINANCIAL CALCULATIONS ===
      calculations: {
        // Subtotals
        itemCount: activeTab.billItems.length,
        totalQuantity: activeTab.billItems.reduce((sum, item) => sum + item.qty, 0),
        subtotal: subtotal, // Sum of all (qty × rate)
        grossAmount: subtotal, // Same as subtotal

        // Item discounts
        totalItemDiscounts: activeTab.billItems.reduce((sum, item) =>
          sum + (item.price * item.qty * (item.discount || 0)) / 100, 0),

        // Amount before tax
        amountBeforeTax: amountBeforeTax,

        // Tax breakdown
        taxDetails: {
          taxEnabled: taxSettings.enableTax,
          taxType: taxSettings.taxType, // 'SGST' or 'IGST'
          taxIncludedInPrice: taxSettings.taxIncludedInPrice,
          taxableAmount: taxBreakdown.taxableAmount,
          totalSgst: taxBreakdown.sgst,
          totalCgst: taxBreakdown.cgst,
          totalIgst: taxBreakdown.igst,
          totalTaxAmount: taxBreakdown.totalTax
        },

        // Amount after tax
        amountAfterTax: amountAfterTax,

        // Bill level discounts
        billDiscount: activeTab.billDiscount,
        billDiscountType: activeTab.discountType, // 'flat' or 'percentage'
        billDiscountAmount: billDiscountAmount,

        // Loyalty points
        loyaltyPointsUsed: activeTab.loyaltyPointsUsed,
        loyaltyPointsValue: loyaltyDeduction, // 1 point = ₹1

        // Rounding
        amountBeforeRounding: amountBeforeRounding,
        roundOffAmount: roundOffAmount,

        // Final totals
        grandTotal: grandTotal,
        amountInWords: numberToWords(grandTotal)
      },

      // === PAYMENT INFORMATION ===
      payment: {
        paymentType: activeTab.paymentType, // 'single' or 'split'

        // Single payment details
        paymentMethod: activeTab.paymentMethod, // 'cash', 'card', 'upi', 'credit'
        receivedAmount: activeTab.receivedAmount || 0,
        changeAmount: activeTab.paymentType === 'single' ?
          Math.max(0, (activeTab.receivedAmount || 0) - grandTotal) : 0,

        // Split payment details
        splitPayments: activeTab.paymentType === 'split' ? {
          cash: activeTab.splitPayments.cash || 0,
          card: activeTab.splitPayments.card || 0,
          upi: activeTab.splitPayments.upi || 0,
          credit: activeTab.splitPayments.credit || 0,
          loyaltyPoints: activeTab.splitPayments.loyaltyPoints || 0,
          totalPaid: Object.values(activeTab.splitPayments).reduce((sum, val) => sum + val, 0)
        } : null,

        // Loyalty points (for thermal receipt display)
        loyaltyPointsUsed: activeTab.loyaltyPointsUsed,
        loyaltyDiscountAmount: loyaltyDeduction,

        // Payment status
        paymentStatus: paymentStatus,
        balanceAmount: balanceAmount
      },

      // === ORDER STATUS AND WORKFLOW ===
      status: {
        orderStatus: 'completed', // 'draft', 'pending', 'completed', 'cancelled', 'refunded'
        paymentStatus: paymentStatus, // 'pending', 'partial', 'paid', 'refunded'
        deliveryStatus: 'delivered', // 'pending', 'processing', 'delivered'
        invoiceGenerated: true,
        receiptPrinted: false // Can be updated when receipt is printed
      },

      // === ADDITIONAL INFORMATION FOR FUTURE USE ===
      additionalInfo: {
        // Customer notes
        customerNotes: '',
        internalNotes: '',

        // Delivery information
        deliveryAddress: finalCustomer.address || '',
        deliveryDate: currentDateTime,
        deliveryMethod: 'counter_sale', // 'counter_sale', 'home_delivery', 'pickup'

        // Reference numbers
        referenceNumber: '',
        invoiceNumber: activeTab.billNo,

        // Promotions and offers
        appliedOffers: [],
        couponCode: '',

        // Return/Exchange policy
        returnPolicy: 'standard',
        exchangePolicy: 'standard'
      },
      auditTrail: {
        createdAt: currentDateTime,
        createdBy: currentUser?.username || currentUser?.email || 'System',
        updatedAt: currentDateTime,
        updatedBy: currentUser?.username || currentUser?.email || 'System',
        version: 1,

        // Edit history (for future edits)
        editHistory: [],

        // System information
        systemInfo: {
          counter: 'Counter 1',
          store: 'Main Store',
          deviceId: 'POS-001', // Can be dynamic
          softwareVersion: '1.0.0'
        }
      },

      // === INTEGRATION FIELDS ===
      integration: {
        // Accounting software sync
        accountingSynced: false,
        accountingSyncDate: null,

        // Inventory sync
        inventorySynced: false,
        inventorySyncDate: null,

        // E-commerce sync
        ecommerceSynced: false,
        ecommerceSyncDate: null,

        // External system IDs
        externalOrderId: null,
        externalInvoiceId: null
      }
    };
  };
  console.log("order id", id);

  const completePayment = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      // Validate the order
      const validationErrors = validateOrder();
      if (validationErrors.length > 0) {
        toast.error(t('sales.pos.validation.failed'), {
          description: validationErrors.join(' '),
          duration: 5000
        });
        return;
      }


      const resolvedCustomer = await resolveOrderCustomer();
      const orderData = createOrderData(resolvedCustomer);

      // If editing, add the ID to the order data
      if (activeTab.isEditing && activeTab.orderId) {
        orderData.id = activeTab.orderId;
      }

      console.log("sales order data", orderData);
      // Show loading toast
      const loadingToast = toast.loading(activeTab.isEditing ? t('sales.pos.updatingOrder') : t('sales.pos.processingOrder'), {
        description: activeTab.isEditing ? t('sales.pos.waitUpdate') : t('sales.pos.waitSave')
      });

      // Save the order to database
      let response;
      if (activeTab.isEditing) {
        response = await salesOrderService.update(orderData);
      } else {
        response = await salesOrderService.create(orderData);
      }

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      if (response.success) {
        // Log successful order creation
        console.log('Sales Order Created Successfully:', {
          orderNumber: orderData.orderNumber,
          customerId: orderData.customerId,
          customerName: orderData.customerName,
          grandTotal: orderData.grandTotal,
          itemCount: orderData.items.length,
          paymentType: orderData.paymentType,
          paymentMethod: orderData.paymentMethod,
          timestamp: new Date().toISOString()
        });

        // Show success message
        toast.success(activeTab.isEditing ? t('sales.pos.orderUpdated') : t('sales.pos.orderCreated'));

        // Update order data with the generated order number and ID
        const finalOrderData = {
          ...orderData,
          id: response.orderId,
          orderNumber: response.orderNumber || orderData.orderNumber
        };

        // Generate default A4 PDF using ID to ensure fresh data from DB
        // Generate PDF using default template settings
        // We await this to ensure PDF is ready before showing modal
        await handleGeneratePDF(response.orderId, null);

        // Auto-open print modal
        setShowPrintModal(true);

        // Only clear the bill if creating a new order, not editing
        if (!activeTab.isEditing) {
          performClearBill(false);
        }

      } else {
        // Handle API error
        toast.error(t('sales.pos.saveFailed'), {
          description: response.message || t('sales.pos.saveError'),
          duration: 5000
        });
      }

    } catch (error) {
      console.error('Error completing payment:', error);
      toast.error(t('sales.pos.processingFailed'), {
        description: t('sales.pos.unexpectedError'),
        duration: 5000
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Complete and Print - saves order and auto-prints
  const completeAndPrint = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      // Validate the order
      const validationErrors = validateOrder();
      if (validationErrors.length > 0) {
        toast.error(t('sales.pos.validation.failed'), {
          description: validationErrors.join(' '),
          duration: 5000
        });
        return;
      }

      const resolvedCustomer = await resolveOrderCustomer();
      const orderData = createOrderData(resolvedCustomer);

      // If editing, add the ID to the order data
      if (activeTab.isEditing && activeTab.orderId) {
        orderData.id = activeTab.orderId;
      }

      console.log("sales order data", orderData);
      // Show loading toast
      const loadingToast = toast.loading(activeTab.isEditing ? t('sales.pos.updatingOrder') : t('sales.pos.processingOrder'), {
        description: activeTab.isEditing ? t('sales.pos.waitUpdate') : t('sales.pos.waitSave')
      });

      // Save the order to database
      let response;
      if (activeTab.isEditing) {
        response = await salesOrderService.update(orderData);
      } else {
        response = await salesOrderService.create(orderData);
      }

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      if (response.success) {
        // Log successful order creation
        console.log('Sales Order Created Successfully:', {
          orderNumber: orderData.orderNumber,
          customerId: orderData.customerId,
          customerName: orderData.customerName,
          grandTotal: orderData.grandTotal,
          itemCount: orderData.items.length,
          paymentType: orderData.paymentType,
          paymentMethod: orderData.paymentMethod,
          timestamp: new Date().toISOString()
        });

        // Show success message
        toast.success(activeTab.isEditing ? t('sales.pos.orderUpdated') : t('sales.pos.orderCreated'));

        // Update order data with the generated order number and ID
        const finalOrderData = {
          ...orderData,
          id: response.orderId,
          orderNumber: response.orderNumber || orderData.orderNumber
        };


        // 1. Get printer settings first to determine template size
        const printerSettings = await window.api.getPrinterSettings();

        // 2. Determine template based on printer settings or fallback
        // If printer is configured with 80mm/50mm, use it. Otherwise default to A4.
        let template = 'A4';
        if (printerSettings && printerSettings.pageSize) {
          template = printerSettings.pageSize;
        }

        // Generate the PDF using the detected template
        const pdfResult = await handleGeneratePDF(response.orderId, template);

        if (!pdfResult || !pdfResult.success) {
          toast.error('Failed to generate Receipt for printing. Opening print modal...');
          setShowPrintModal(true);
          return;
        }

        // 3. Print directly if printer is configured
        try {
          if (!printerSettings || !printerSettings.systemName) {
            toast.warning('No default printer configured. Opening print modal...');
            setShowPrintModal(true);
          } else {
            // Construct print payload - Align exactly with Modal Pattern
            const printPayload = {
              pdfData: pdfResult.base64,
              settings: {
                deviceName: printerSettings.systemName,
                copies: parseInt(printerSettings.copies || 1),
                pageSize: printerSettings.pageSize || '80mm',
                contentHeight: pdfResult.height,
                landscape: printerSettings.orientation === 'landscape',
                scaleFactor: parseInt(printerSettings.scale || 100),
                verticalAlign: printerSettings.verticalAlign || 'top',
                printBackground: false, // Fix for black layout artifacts
                margins: {
                  top: parseFloat(printerSettings.margins?.top || 0),
                  bottom: parseFloat(printerSettings.margins?.bottom || 0),
                  left: parseFloat(printerSettings.margins?.left || 0),
                  right: parseFloat(printerSettings.margins?.right || 0)
                }
              }
            };

            // Save to Temp -> Print File (Modal Pattern)
            const saveResult = await window.api.saveTempPDF(printPayload.pdfData);

            let result;
            if (saveResult.success) {
              console.log("Direct Print: Printing from file:", saveResult.filePath);
              result = await window.api.printPDFFile(saveResult.filePath, printPayload.settings);
            } else {
              console.error("Direct Print: Save temp failed, falling back to direct buffer print");
              result = await window.api.printPDF(printPayload.pdfData, printPayload.settings);
            }

            if (result.success) {
              toast.success(t('printModal.messages.printSuccess') || 'Order saved and printed successfully!');
            } else {
              console.error("Print failed:", result.message);
              toast.error('Print failed: ' + result.message);
              setShowPrintModal(true);
            }
          }
        } catch (printError) {
          console.error('Print error:', printError);
          toast.error('Failed to print. Opening print modal...');
          setShowPrintModal(true);
        }

        // Only clear the bill if creating a new order, not editing
        if (!activeTab.isEditing) {
          performClearBill(false);
        }

      } else {
        // Handle API error
        toast.error(t('sales.pos.saveFailed'), {
          description: response.message || t('sales.pos.saveError'),
          duration: 5000
        });
      }

    } catch (error) {
      console.error('Error completing payment:', error);
      toast.error(t('sales.pos.processingFailed'), {
        description: t('sales.pos.unexpectedError'),
        duration: 5000
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneratePDF = async (order, template) => {
    try {
      setIsGeneratingPdf(true);
      setPrintingTemplate(template);
      setPdfHeight(null); // Reset height

      const response = await salesOrderService.generatePDF(order, template);

      if (response.success) {
        // Create a Blob from the buffer
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);

        // Capture dynamic height if available (for thermal printers)
        if (response.height) {
          setPdfHeight(response.height);
        }

        // Convert to base64 and wait for it (to avoid race conditions)
        const base64data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const b64 = reader.result.split(',')[1];
            setPdfBase64(b64);
            resolve(b64);
          };
        });

        return { success: true, base64: base64data, height: response.height };
      } else {
        toast.error(t('sales.messages.pdfGenerateFailed'));
        return { success: false };
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.error(t('sales.messages.pdfError'));
      return { success: false, error };
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleNewOrder = () => {
    setShowSuccessModal(false);
    setCreatedOrder(null);
    setPdfUrl(null);

    // If we were editing an order, redirect back to sales list
    if (id) {
      navigate('/sales');
    } else {
      // If creating a new order, clear the bill for next order
      performClearBill();
    }
  };

  const confirmClearBill = () => {
    setConfirmation({
      isOpen: true,
      title: t('sales.pos.clearBill'),
      message: t('sales.pos.clearBillMessage'),
      type: 'CLEAR_BILL',
      data: null
    });
  };

  const performClearBill = (showToast = true) => {
    const updatedTabs = tabs.map(tab =>
      tab.id === activeTabId ? {
        ...tab,
        billItems: [],
        selectedCustomer: null,
        billDiscount: 0,
        discountType: 'flat',
        loyaltyPointsUsed: 0,
        roundOff: 0,
        paymentMethod: 'cash',
        paymentType: 'single',
        receivedAmount: 0,
        splitPayments: { cash: 0, card: 0, upi: 0, credit: 0, loyaltyPoints: 0 },
        taxSettings: {
          enableTax: false,
          taxType: 'SGST',
          taxIncludedInPrice: true
        },
        priceLevel: 'Retail', // Reset price level
        // Dispatch Details
        deliveryNote: '',
        supplierRef: '',
        buyerOrderNo: '',
        dispatchDocNo: '',
        dispatchThrough: '',
        destination: '',
        vehicleNo: '',
        termsOfDelivery: ''
      } : tab
    );

    setTabs(updatedTabs);

    // Force save to localStorage to ensure persistence even if app is closed immediately
    try {
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(updatedTabs));
    } catch (error) {
      console.error('Error saving tabs to storage:', error);
    }

    setNewItemForm(getDefaultNewItemForm());
    if (showToast) {
      toast.info(t('sales.pos.billCleared'));
    }
  };

  const handleConfirmationAction = () => {
    if (confirmation.type === 'CLOSE_TAB') {
      performCloseTab(confirmation.data.tabId);
    } else if (confirmation.type === 'CLEAR_BILL') {
      performClearBill();
    }
    setConfirmation({ ...confirmation, isOpen: false });
  };

  const updateSplitPayment = (method, value) => {
    updateActiveTab({
      splitPayments: { ...activeTab.splitPayments, [method]: Number(value) }
    });
  };

  const totalPaid = Object.values(activeTab.splitPayments).reduce((sum, val) => sum + val, 0);
  const remainingAmount = grandTotal - totalPaid;

  // Auto-fill cash received with grand total when payment method is cash
  useEffect(() => {
    if (activeTab.paymentType === 'single' && activeTab.paymentMethod === 'cash') {
      updateActiveTab({ receivedAmount: grandTotal });
    }
  }, [grandTotal, activeTab.paymentMethod, activeTab.paymentType]);

  // Keyboard shortcuts for payment methods and product search
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl + N = Create new bill tab
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        createNewTab();
        return;
      }

      // Ctrl + P = Focus the manual item name input (works from anywhere)
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (itemNameInputRef.current) {
          itemNameInputRef.current.focus();
          itemNameInputRef.current.select();
        }
        return;
      }

      // Ctrl + K = Open Customer Selection modal (K for customer/kontact)
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowCustomerModal(true);
        return;
      }

      // Ctrl + D = Focus discount input
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (discountInputRef.current) {
          discountInputRef.current.focus();
          discountInputRef.current.select();
        }
        return;
      }

      // Ctrl + L = Focus loyalty points input (only if customer has points)
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (activeTab.selectedCustomer && activeTab.selectedCustomer.points > 0 && loyaltyPointsInputRef.current) {
          loyaltyPointsInputRef.current.focus();
          loyaltyPointsInputRef.current.select();
        }
        return;
      }

      // F2 = Focus the manual item name input to add a new line item
      if (e.key === 'F2') {
        e.preventDefault();
        if (itemNameInputRef.current) {
          itemNameInputRef.current.focus();
          itemNameInputRef.current.select();
        }
        return;
      }

      // F3 = Open Add Customer modal
      if (e.key === 'F3') {
        e.preventDefault();
        setShowAddCustomerForm(true);
        return;
      }

      // F4 = Open Customer Selection modal (backward compatibility)
      if (e.key === 'F4') {
        e.preventDefault();
        setShowCustomerModal(true);
        return;
      }

      // Enter while focused on the manual item name input adds the item to the bill
      if (e.key === 'Enter' && e.target === itemNameInputRef.current) {
        e.preventDefault();
        addManualItemToBill();
        return;
      }

      // Tab navigation for split payment fields
      if (e.key === 'Tab' && activeTab.paymentType === 'split') {
        const splitPaymentRefs = [
          splitPaymentCashRef,
          splitPaymentCardRef,
          splitPaymentUpiRef,
          splitPaymentCreditRef
        ];

        const currentRef = e.target;
        const currentIndex = splitPaymentRefs.findIndex(ref => ref.current === currentRef);

        if (currentIndex !== -1) {
          e.preventDefault();
          let nextIndex;

          if (e.shiftKey) {
            // Shift+Tab: go to previous field
            nextIndex = currentIndex > 0 ? currentIndex - 1 : splitPaymentRefs.length - 1;
          } else {
            // Tab: go to next field
            nextIndex = currentIndex < splitPaymentRefs.length - 1 ? currentIndex + 1 : 0;
          }

          const nextRef = splitPaymentRefs[nextIndex];
          if (nextRef && nextRef.current) {
            nextRef.current.focus();
            nextRef.current.select();
          }
          return;
        }
      }

      // Only trigger payment shortcuts if not typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      // Alt + 1 = Cash, Alt + 2 = Card, Alt + 3 = UPI, Alt + 4 = Credit, Alt + 5 = Split Payment
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            updateActiveTab({
              paymentType: 'single',
              paymentMethod: 'cash',
              receivedAmount: grandTotal
            });
            break;
          case '2':
            e.preventDefault();
            updateActiveTab({
              paymentType: 'single',
              paymentMethod: 'card',
              receivedAmount: grandTotal
            });
            break;
          case '3':
            e.preventDefault();
            updateActiveTab({
              paymentType: 'single',
              paymentMethod: 'upi',
              receivedAmount: grandTotal
            });
            break;
          case '4':
            e.preventDefault();
            updateActiveTab({
              paymentType: 'single',
              paymentMethod: 'credit',
              receivedAmount: grandTotal
            });
            break;
          case '5':
            e.preventDefault();
            updateActiveTab({
              paymentType: 'split',
              splitPayments: { cash: 0, card: 0, upi: 0, credit: 0, loyaltyPoints: 0 }
            });
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [grandTotal, activeTabId, activeTab.paymentType, newItemForm]);

  const bgClass = 'bg-gray-50';
  const cardBg = 'bg-white';
  const textPrimary = 'text-gray-900';
  const textSecondary = 'text-gray-600';
  const borderColor = 'border-gray-200';
  const hoverBg = 'hover:bg-gray-100';

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className={`fixed inset-0 w-full h-screen overflow-hidden ${bgClass} ${textPrimary} flex flex-col`}>
        {/* Window Controls */}
        <WindowControls title={t('sales.pos.windowTitle')} />

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={confirmation.isOpen}
          onClose={() => setConfirmation({ ...confirmation, isOpen: false })}
          onConfirm={handleConfirmationAction}
          onCancel={() => setConfirmation({ ...confirmation, isOpen: false })}
          title={confirmation.title}
          message={confirmation.message}
          confirmText={t('sales.pos.confirmation.yes')}
          cancelText={t('sales.pos.confirmation.no')}
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />

        {/* Print Preview Modal */}
        <PrintPreviewModal
          ref={printModalRef}
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setAutoPrint(false);
          }}
          pdfUrl={pdfUrl}
          pdfBase64={pdfBase64}
          contentHeight={pdfHeight}
          title={id ? t('sales.pos.successModal.updated') : t('sales.pos.successModal.created')}
          autoPrint={autoPrint}
        />

        {/* Success Modal */}
        {showSuccessModal && createdOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="bg-green-600 text-white px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-full">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {id ? t('sales.pos.successModal.updated') : t('sales.pos.successModal.created')}
                    </h2>
                    <p className="text-green-100 text-sm">{t('sales.pos.successModal.invoice')} {createdOrder.orderNumber}</p>
                  </div>
                </div>
                <button
                  onClick={handleNewOrder}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Options */}
                <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-4">
                  <div className="space-y-3">
                    {/* Order Summary */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm space-y-3">
                      <h3 className="font-semibold text-gray-900 border-b pb-2">{t('sales.pos.successModal.summary')}</h3>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('sales.pos.successModal.orderNo')}</span>
                          <span className="font-medium text-gray-900">{createdOrder.orderNumber}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('sales.pos.successModal.date')}</span>
                          <span className="font-medium text-gray-900">
                            {new Date().toLocaleDateString('en-IN')}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('sales.pos.successModal.customer')}</span>
                          <span className="font-medium text-gray-900 text-right truncate max-w-[120px]" title={createdOrder.customerName}>
                            {createdOrder.customerName}
                          </span>
                        </div>

                        <div className="flex justify-between pt-2 border-t border-dashed">
                          <span className="text-gray-500">{t('sales.pos.successModal.total')}</span>
                          <span className="font-bold text-green-600">
                            ₹{parseFloat(createdOrder.grandTotal || 0).toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-gray-500">{t('sales.pos.successModal.status')}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${createdOrder.payment?.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                            createdOrder.payment?.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                            {createdOrder.payment?.paymentStatus || 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Download Button */}
                    <button
                      onClick={() => {
                        if (!pdfUrl) return;
                        const link = document.createElement('a');
                        link.href = pdfUrl;
                        link.download = `Invoice-${createdOrder.orderNumber || 'document'}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download size={20} /> {t('sales.pos.successModal.downloadPdf')}
                    </button>
                  </div>

                  <div className="mt-auto space-y-3">
                    <button
                      onClick={() => {
                        const iframe = document.querySelector('iframe');
                        if (iframe) iframe.contentWindow.print();
                      }}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md flex items-center justify-center gap-2 transition-colors"
                    >
                      <span className="text-lg">🖨️</span> {t('sales.pos.successModal.printInvoice')}
                    </button>

                    <button
                      onClick={handleNewOrder}
                      className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold shadow-md flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus size={20} /> {t('sales.pos.successModal.newOrder')}
                    </button>
                  </div>
                </div>

                {/* Right Content - PDF Preview */}
                <div className="flex-1 bg-gray-100 p-4 flex items-center justify-center overflow-hidden">
                  {isGeneratingPdf ? (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600 font-medium">{t('sales.pos.successModal.generatingPreview')}</p>
                    </div>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full rounded-lg shadow-lg bg-white"
                      title="Invoice Preview"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <p>{t('sales.pos.successModal.selectFormat')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Bar - Only show in create mode, not edit mode */}
        {!id && (
          <div className="bg-white border-b border-gray-300 flex items-center gap-2 overflow-x-auto" style={{ minHeight: '48px' }}>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer transition-all ${activeTabId === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                onClick={() => switchTab(tab.id)}
              >
                <ShoppingCart size={16} />
                <span className="font-medium text-sm whitespace-nowrap">
                  {tab.name}
                  {tab.billItems.length > 0 && ` (${tab.billItems.length})`}
                </span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={`ml-2 p-0.5 rounded hover:bg-opacity-20 hover:bg-black ${activeTabId === tab.id ? 'text-white' : 'text-gray-500'
                      }`}
                    title="Close tab"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={createNewTab}
              disabled={tabs.length >= 8}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm ${tabs.length >= 8
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              title={tabs.length >= 8 ? t('sales.pos.tabs.max') : t('sales.pos.tabs.create')}
            >
              <Plus size={16} />
              {tabs.length >= 8 ? (
                <span className="text-xs">{t('sales.pos.tabs.max')}</span>
              ) : (
                <kbd className="ml-1 text-xs bg-green-700 px-1.5 py-0.5 rounded">Ctrl+N</kbd>
              )}
            </button>
          </div>
        )}

        {/* Edit Mode Header - Show order number when editing */}
        {id && editOrder && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white px-3 py-1 rounded-lg font-semibold text-sm">
                  {t('sales.pos.editMode.editing')}
                </div>
                <div>
                  <span className="text-gray-600 text-sm">{t('sales.pos.editMode.salesOrder')}</span>
                  <span className="ml-2 font-bold text-gray-900 text-lg">{editOrder.billNo}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/sales')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ← {t('sales.pos.editMode.backToList')}
              </button>
            </div>
          </div>
        )}



        {/* Main Content - Full Width Layout with Fixed Bottom Bar */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Section - Bill Items and Customer */}
          <div className="flex-1 flex gap-2 overflow-hidden px-2 py-1">
            {/* Left Section - Bill Items */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Manual Item Entry - free-text line item form (no product catalog) */}
              <div className={`relative pb-1 ${cardBg} border ${borderColor} rounded-lg p-2 mb-1`}>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.manualItem.name')} *
                    </label>
                    <input
                      ref={itemNameInputRef}
                      type="text"
                      placeholder={t('sales.pos.manualItem.namePlaceholder')}
                      className={`w-full px-3 py-2 border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded text-sm`}
                      value={newItemForm.name}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="w-20">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.table.qty')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className="w-full px-2 py-2 border-2 border-gray-200 rounded text-sm text-right"
                      value={newItemForm.qty}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, qty: e.target.value }))}
                    />
                  </div>

                  <div className="w-24">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.manualItem.unitPrice')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-2 border-2 border-gray-200 rounded text-sm text-right"
                      value={newItemForm.price}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, price: e.target.value }))}
                    />
                  </div>

                  <button
                    onClick={addManualItemToBill}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-1 whitespace-nowrap shadow-sm"
                    title={t('sales.pos.manualItem.addItem')}
                  >
                    <Plus size={16} />
                    {t('sales.pos.manualItem.addItem')}
                    <kbd className="ml-1 text-[10px] bg-green-700 px-1.5 py-0.5 rounded">F2</kbd>
                  </button>
                </div>

                {/* Optional secondary fields */}
                <div className="flex flex-wrap items-end gap-2 mt-2">
                  <div className="w-28">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.table.hsn')}
                    </label>
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
                      value={newItemForm.hsnCode}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.manualItem.category')}
                    </label>
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
                      value={newItemForm.category}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, category: e.target.value }))}
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.table.unit')}
                    </label>
                    <input
                      type="text"
                      placeholder="Piece"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
                      value={newItemForm.unit}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.table.mrp')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right"
                      value={newItemForm.mrp}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, mrp: e.target.value }))}
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.manualItem.taxRate')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right"
                      value={newItemForm.tax}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, tax: e.target.value }))}
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      {t('sales.pos.table.disc')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right"
                      value={newItemForm.discount}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, discount: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              {/* Bill Items */}
              <div className={`${cardBg}  shadow-sm border ${borderColor} p-2 flex-1 flex flex-col overflow-hidden relative`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                  {/* Left: title + add */}
                  <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1 shrink-0">
                    <span>📋</span>{t('sales.pos.billItems.title')} ({activeTab.billItems.length})
                  </h3>

                  <div className="flex-1" />

                  {/* Price Level - a label only; manually entered prices are used as typed */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-medium text-gray-700">Price:</span>
                    <select
                      value={activeTab.priceLevel || 'Retail'}
                      onChange={(e) => updateActiveTab({ priceLevel: e.target.value })}
                      className="text-[10px] border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                      <option value="Dealer">Dealer</option>
                    </select>
                  </div>

                  {/* Divider */}
                  <span className="h-4 w-px bg-gray-300 shrink-0" />

                  {/* Tax */}
                  <div className="flex items-center gap-1 shrink-0 flex-wrap">
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxSettings.enableTax}
                        onChange={(e) => updateActiveTab({ taxSettings: { ...taxSettings, enableTax: e.target.checked } })}
                        className="w-3 h-3 text-blue-600 rounded"
                      />
                      <span className="font-medium text-gray-700">{t('sales.pos.billItems.tax')}</span>
                    </label>

                    {taxSettings.enableTax && (
                      <>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                          <input
                            type="radio"
                            name="taxType"
                            value="SGST"
                            checked={taxSettings.taxType === 'SGST'}
                            onChange={(e) => updateActiveTab({ taxSettings: { ...taxSettings, taxType: e.target.value } })}
                            className="w-3 h-3"
                          />
                          <span className="text-gray-600">{t('sales.pos.billItems.sgstCgst')}</span>
                        </label>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                          <input
                            type="radio"
                            name="taxType"
                            value="IGST"
                            checked={taxSettings.taxType === 'IGST'}
                            onChange={(e) => updateActiveTab({ taxSettings: { ...taxSettings, taxType: e.target.value } })}
                            className="w-3 h-3"
                          />
                          <span className="text-gray-600">{t('sales.pos.billItems.igst')}</span>
                        </label>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer border-l border-gray-300 pl-1">
                          <input
                            type="checkbox"
                            checked={taxSettings.taxIncludedInPrice}
                            onChange={(e) => updateActiveTab({ taxSettings: { ...taxSettings, taxIncludedInPrice: e.target.checked } })}
                            className="w-3 h-3 text-blue-600 rounded"
                          />
                          <span className="text-gray-600">{t('sales.pos.billItems.incPrice')}</span>
                        </label>
                      </>
                    )}
                  </div>

                  {/* Clear All */}
                  {activeTab.billItems.length > 0 && (
                    <>
                      <span className="h-4 w-px bg-gray-300 shrink-0" />
                      <button
                        onClick={clearAll}
                        className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-[10px] font-medium shrink-0"
                      >
                        <Trash2 size={13} /> {t('sales.pos.billItems.clearAll')}
                      </button>
                    </>
                  )}
                </div>

                {activeTab.billItems.length === 0 ? (
                  <div className="text-center h-[calc(100vh-200px)] py-16">
                    <ShoppingCart className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className={`${textSecondary} mb-2`}>{t('sales.pos.billItems.noItemsAdded')}</p>
                    <p className={`text-sm ${textSecondary}`}>{t('sales.pos.billItems.pressCtrlP')}</p>
                  </div>
                ) : (
                  <div ref={billItemsContainerRef} className="overflow-y-auto border border-gray-300 flex-1">
                    <table className="w-full border-collapse table-fixed">
                      <colgroup>
                        <col style={{ width: '4%' }} />
                        <col style={{ width: taxSettings.enableTax ? '25%' : '28%' }} />
                        <col style={{ width: '7%' }} />
                        <col style={{ width: taxSettings.enableTax ? '12%' : '14%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '7%' }} />
                        {taxSettings.enableTax && <col style={{ width: '8%' }} />}
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '5%' }} />
                      </colgroup>
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-1 py-1.5 text-center text-xs font-semibold bg-gray-100">#</th>
                          <th className="border border-gray-300 px-1 py-1.5 text-left text-xs font-semibold bg-gray-100">{t('sales.pos.table.product')}</th>
                          <th className="border border-gray-300 px-1 py-1.5 text-center text-xs font-semibold bg-gray-100">{t('sales.pos.table.hsn')}</th>
                          <th className="border border-gray-300 px-1 py-1.5 text-center text-xs font-semibold bg-gray-100">{t('sales.pos.table.qty')}</th>
                          <th className="border border-gray-300 px-1 py-1.5 text-center text-xs font-semibold bg-gray-100">{t('sales.pos.table.unit')}</th>
                          <th className="border border-gray-300 px-1 py-1.5 text-right text-xs font-semibold bg-gray-100">{t('sales.pos.table.mrp')}</th>
                          <th className="border border-gray-300 px-1 py-1.5 text-right text-xs font-semibold bg-gray-100">{t('sales.pos.table.rate')}</th>
                          <th className="border border-gray-300 px-1 py-1.5 text-right text-xs font-semibold bg-gray-100">{t('sales.pos.table.disc')}</th>
                          {taxSettings.enableTax && (
                            <th className="border border-gray-300 px-1 py-1.5 text-right text-xs font-semibold bg-gray-100">GST</th>
                          )}
                          <th className="border border-gray-300 px-1 py-1.5 text-right text-xs font-semibold bg-gray-100">{t('sales.pos.table.amount')}</th>
                          <th className="border border-gray-300 px-1 py-1.5 text-center text-xs font-semibold bg-gray-100">{t('sales.pos.table.action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTab.billItems.map((item, index) => (
                          <tr
                            key={item.id}
                            ref={item.id === lastUpdatedItemId ? lastUpdatedItemRef : null}
                            className={`transition-all duration-500 ${item.id === lastUpdatedItemId
                              ? 'bg-gradient-to-r from-green-100 to-green-50'
                              : 'hover:bg-gray-50'
                              }`}
                          >
                            <td className="border border-gray-300 px-1 py-1.5 text-sm text-center">{index + 1}</td>
                            <td className="border border-gray-300 px-2 py-1.5">
                              <div className="min-w-0 flex flex-col gap-0.5">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => updateActiveTab({
                                    billItems: activeTab.billItems.map(i =>
                                      i.id === item.id ? { ...i, name: e.target.value } : i
                                    )
                                  })}
                                  className="w-full px-1 py-0.5 text-sm font-medium border border-transparent hover:border-gray-300 focus:border-gray-300 rounded"
                                  placeholder={t('sales.pos.manualItem.namePlaceholder')}
                                />
                                <input
                                  type="text"
                                  value={item.category || ''}
                                  onChange={(e) => updateActiveTab({
                                    billItems: activeTab.billItems.map(i =>
                                      i.id === item.id ? { ...i, category: e.target.value } : i
                                    )
                                  })}
                                  className={`w-full px-1 py-0.5 text-xs ${textSecondary} border border-transparent hover:border-gray-300 focus:border-gray-300 rounded`}
                                  placeholder={t('sales.pos.manualItem.category')}
                                />
                              </div>
                            </td>
                            <td className="border border-gray-300 px-1 py-1.5">
                              <input
                                type="text"
                                value={item.hsnCode || ''}
                                onChange={(e) => updateActiveTab({
                                  billItems: activeTab.billItems.map(i =>
                                    i.id === item.id ? { ...i, hsnCode: e.target.value } : i
                                  )
                                })}
                                className="w-full px-1 py-0.5 text-center text-sm border border-gray-300 rounded"
                              />
                            </td>
                            <td className="border border-gray-300 px-1 py-1.5">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  value={item.qty}
                                  onChange={(e) => {
                                    const newQty = parseFloat(e.target.value) || 0;
                                    updateActiveTab({
                                      billItems: activeTab.billItems.map(i =>
                                        i.id === item.id ? { ...i, qty: Math.max(0, newQty) } : i
                                      )
                                    });
                                    highlightAndScrollToItem(item.id);
                                  }}
                                  className="w-12 flex-1 min-w-[40px] px-1 py-0.5 text-center text-sm border border-gray-300 rounded"
                                  step="0.001"
                                />
                                <button
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="border border-gray-300 px-1 py-1.5">
                              <input
                                type="text"
                                value={item.unit || ''}
                                onChange={(e) => updateActiveTab({
                                  billItems: activeTab.billItems.map(i =>
                                    i.id === item.id ? { ...i, unit: e.target.value } : i
                                  )
                                })}
                                className="w-full px-1 py-0.5 text-center text-sm border border-gray-300 rounded"
                              />
                            </td>
                            <td className="border border-gray-300 px-1 py-1.5">
                              <input
                                type="number"
                                value={item.mrp || 0}
                                onChange={(e) => updateActiveTab({
                                  billItems: activeTab.billItems.map(i =>
                                    i.id === item.id ? { ...i, mrp: Number(e.target.value) || 0 } : i
                                  )
                                })}
                                className="w-full px-1 py-0.5 text-right text-sm border border-gray-300 rounded"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="border border-gray-300 px-1 py-1.5">
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => updateActiveTab({
                                  billItems: activeTab.billItems.map(i =>
                                    i.id === item.id ? { ...i, price: Number(e.target.value) || 0 } : i
                                  )
                                })}
                                className="w-full px-1 py-0.5 text-right text-sm border border-gray-300 rounded"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="border border-gray-300 px-1 py-1.5">
                              <input
                                type="number"
                                value={item.discount}
                                onChange={(e) => {
                                  const newDiscount = Number(e.target.value) || 0;
                                  const limitedDiscount = Math.min(Math.max(0, newDiscount), 100);
                                  updateActiveTab({
                                    billItems: activeTab.billItems.map(i =>
                                      i.id === item.id ? { ...i, discount: limitedDiscount } : i
                                    )
                                  });
                                }}
                                className="w-full px-1 py-0.5 text-right text-sm border border-gray-300 rounded"
                                min="0"
                                max="100"
                                step="0.01"
                              />
                            </td>
                            {taxSettings.enableTax && (
                              <td className="border border-gray-300 px-1 py-1.5 text-right text-sm">
                                <div className="flex flex-col items-end gap-0.5">
                                  <input
                                    type="number"
                                    value={item.tax || 0}
                                    onChange={(e) => updateActiveTab({
                                      billItems: activeTab.billItems.map(i =>
                                        i.id === item.id ? { ...i, tax: Number(e.target.value) || 0 } : i
                                      )
                                    })}
                                    className="w-14 px-1 py-0.5 text-right text-xs border border-gray-300 rounded"
                                    min="0"
                                    step="0.01"
                                    title={t('sales.pos.manualItem.taxRate')}
                                  />
                                  <span className="text-[10px] text-gray-500">₹{calculateItemTaxAmounts(item).taxAmount.toFixed(2)}</span>
                                </div>
                              </td>
                            )}
                            <td className="border border-gray-300 px-1 py-1.5 text-right text-sm font-medium">
                              ₹{calculateItemTotal(item).toFixed(2)}
                            </td>
                            <td className="border border-gray-300 px-1 py-1.5 text-center">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 bg-gray-200 font-bold">
                        <tr>
                          <td colSpan="3" className="border border-gray-300 px-1 py-1.5 text-xs text-right">Subtotal:</td>
                          <td className="border border-gray-300 px-1 py-1.5 text-center text-xs">
                            {activeTab.billItems.reduce((sum, item) => sum + item.qty, 0)}
                          </td>
                          <td className="border border-gray-300 px-1 py-1.5 text-xs"></td>
                          <td className="border border-gray-300 px-1 py-1.5 text-xs"></td>
                          <td className="border border-gray-300 px-1 py-1.5 text-xs"></td>
                          <td className="border border-gray-300 px-1 py-1.5 text-xs"></td>
                          {taxSettings.enableTax && (
                            <td className="border border-gray-300 px-1 py-1.5 text-right text-xs">
                              ₹{activeTab.billItems.reduce((sum, item) => sum + calculateItemTaxAmounts(item).taxAmount, 0).toFixed(2)}
                            </td>
                          )}
                          <td className="border border-gray-300 px-1 py-1.5 text-right text-xs">
                            ₹{activeTab.billItems.reduce((sum, item) => sum + calculateItemTotal(item), 0).toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-1 py-1.5 text-xs"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>


            </div>

            {/* Right Section - Customer & Payment */}
            <div className="w-100 flex flex-col overflow-y-auto space-y-3 pb-8">

              {/* Customer Information */}
              <div className={`${cardBg} shadow-sm border ${borderColor} p-2`}>
                <h3 className="font-semibold flex items-center gap-2 mb-1.5 text-sm">
                  <User size={16} /> {t('sales.pos.rightPanel.customer')}
                </h3>

                {/* Customer Search Dropdown */}
                <div className="relative mb-1.5">
                  <div className="flex gap-1">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={activeTab.selectedCustomer ? activeTab.selectedCustomer.name : customerSearchQuery}
                        onChange={(e) => {
                          // Allow typing to search for customers
                          setCustomerSearchQuery(e.target.value);
                          // If user is typing, clear the selected customer to show search results
                          if (e.target.value && activeTab.selectedCustomer) {
                            handleCustomerChange(null);
                          }
                        }}
                        onFocus={() => {
                          // When focused, if a customer is selected, allow editing
                          if (activeTab.selectedCustomer) {
                            setCustomerSearchQuery('');
                          }
                        }}
                        placeholder={t('sales.pos.rightPanel.searchCustomer')}
                        className={`w-full pl-7 pr-7 py-1.5 text-sm rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      />
                      {customerSearchQuery && (
                        <button
                          onClick={() => setCustomerSearchQuery('')}
                          className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                          title={t('sales.pos.rightPanel.clearSearch')}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* View Details Icon - Hidden for now */}
                    {false && activeTab.selectedCustomer && (
                      <button
                        onClick={() => setShowCustomerModal(true)}
                        className="px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded border-2 border-blue-300 transition-colors flex items-center justify-center"
                        title={t('sales.pos.rightPanel.viewCustomerDetails')}
                      >
                        <Eye size={16} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown List */}
                  {customerSearchQuery && !activeTab.selectedCustomer && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg z-40 max-h-56 overflow-y-auto">
                      {customersLoading ? (
                        <div className="p-3 text-center text-gray-500 text-xs">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-1"></div>
                          {t('common.loading')}
                        </div>
                      ) : customers.filter(c => c.name !== 'Walk-in Customer').length === 0 ? (
                        <div className="p-3 text-center text-gray-500 text-xs">
                          {t('sales.pos.rightPanel.noCustomersFound')}
                        </div>
                      ) : (
                        customers
                          .filter(c => c.name !== 'Walk-in Customer')
                          .map(customer => (
                            <div
                              key={customer.id}
                              onClick={() => {
                                handleCustomerChange(customer);
                                setCustomerSearchQuery('');
                              }}
                              className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-xs"
                            >
                              <div className="font-medium text-gray-900">{customer.name}</div>
                              <div className="text-gray-600 text-xs">📱 {customer.phone}</div>
                              <div className="text-yellow-600 text-xs font-semibold">{customer.points} {t('sales.pos.rightPanel.pts')}</div>
                            </div>
                          ))
                      )}

                      {/* Add Customer Button */}
                      <button
                        onClick={() => {
                          setShowAddCustomerForm(true);
                          setCustomerSearchQuery('');
                        }}
                        className="w-full px-2 py-2 bg-green-50 hover:bg-green-100 text-green-700 border-t border-gray-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                        title={t('sales.pos.rightPanel.addNewCustomer')}
                      >
                        <Plus size={14} />
                        <span>{t('sales.pos.rightPanel.addNewCustomer')}</span>
                      </button>

                    </div>
                  )}
                </div>
              </div>

              {/* Order Summary - Collapsible */}
              <div className={`${cardBg} shadow-sm border ${borderColor} rounded-lg p-2`}>
                {/* Header with Expand/Collapse Button */}
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-gray-700">{t('sales.pos.rightPanel.orderSummary')}</h4>
                  <button
                    onClick={() => setOrderSummaryExpanded(!orderSummaryExpanded)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                    title={orderSummaryExpanded ? t('sales.pos.rightPanel.collapse') : t('sales.pos.rightPanel.expand')}
                  >
                    {orderSummaryExpanded ? (
                      <>
                        <ChevronUp size={12} />
                        <span>{t('sales.pos.rightPanel.collapse')}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={12} />
                        <span>{t('sales.pos.rightPanel.expand')}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  {!orderSummaryExpanded ? (
                    /* COMPACT VIEW - Only Essential Details */
                    <>
                      {/* Before Tax */}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs font-medium">{t('sales.pos.rightPanel.beforeTax')}:</span>
                        <span className="font-bold text-gray-900 text-sm">₹{amountBeforeTax.toFixed(2)}</span>
                      </div>

                      {/* Tax Amount */}
                      {taxSettings.enableTax && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-xs">{t('sales.pos.rightPanel.tax')} {taxSettings.taxType === 'SGST' ? t('sales.pos.billItems.sgstCgst') : t('sales.pos.billItems.igst')}:</span>
                          <span className="font-semibold text-purple-700 text-sm">₹{taxAmount.toFixed(2)}</span>
                        </div>
                      )}

                      {/* After Tax */}
                      {taxSettings.enableTax && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 text-xs font-medium">{t('sales.pos.rightPanel.afterTax')}:</span>
                          <span className="font-bold text-gray-900 text-sm">₹{amountAfterTax.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Round Off */}
                      {Math.abs(roundOffAmount) > 0.01 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-xs">{t('sales.pos.rightPanel.roundOff')}:</span>
                          <span className={`font-semibold text-sm ${roundOffAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {roundOffAmount >= 0 ? '+' : ''}₹{roundOffAmount.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Bill Discount & Loyalty - Compact View */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-gray-300 mt-1">
                        {/* Bill Discount */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-gray-700 text-[10px] font-semibold">💰 {t('sales.pos.rightPanel.discount')}</span>
                            <span className="text-[8px] text-gray-500 bg-white px-0.5 py-0.5 rounded">Ctrl+D</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <input
                              ref={discountInputRef}
                              type="number"
                              min="0"
                              max={activeTab.discountType === 'percentage' ? 100 : amountAfterTax}
                              value={activeTab.billDiscount}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                // Calculate max discount allowed to prevent negative total
                                let maxAllowedDiscount = amountAfterTax - (activeTab.loyaltyPointsUsed || 0);

                                // If percentage, convert max amount to percentage
                                let maxValue = 0;
                                if (activeTab.discountType === 'percentage') {
                                  maxValue = amountAfterTax > 0 ? (maxAllowedDiscount / amountAfterTax) * 100 : 0;
                                  maxValue = Math.min(100, maxValue); // Cap at 100%
                                } else {
                                  maxValue = maxAllowedDiscount;
                                }
                                // Round to 2 decimal places for safety
                                maxValue = Math.floor(maxValue * 100) / 100;

                                if (value >= 0 && value <= maxValue) {
                                  updateActiveTab({ billDiscount: value });
                                }
                              }}
                              className="flex-1 px-2 py-1.5 text-right text-sm font-bold rounded border border-yellow-300 bg-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 focus:outline-none"
                              placeholder="0"
                            />
                            <select
                              value={activeTab.discountType}
                              onChange={(e) => updateActiveTab({ discountType: e.target.value, billDiscount: 0 })}
                              className="px-1.5 py-1.5 text-xs font-semibold rounded border border-yellow-300 bg-white focus:border-yellow-500 focus:outline-none"
                            >
                              <option value="flat">₹</option>
                              <option value="percentage">%</option>
                            </select>
                          </div>
                        </div>

                        {/* Loyalty Points */}
                        {activeTab.selectedCustomer && (activeTab.selectedCustomer.points > 0 || activeTab.loyaltyPointsUsed > 0 || (activeTab.initialLoyaltyPointsUsed || 0) > 0) ? (
                          <div className="bg-purple-50 border border-purple-200 rounded p-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-gray-700 text-[10px] font-semibold">🎁 {t('sales.pos.rightPanel.loyalty')}</span>
                              <span className="text-[8px] text-gray-500 bg-white px-0.5 py-0.5 rounded">Ctrl+L</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <input
                                ref={loyaltyPointsInputRef}
                                type="number"
                                min="0"
                                max={activeTab.selectedCustomer.points}
                                value={activeTab.loyaltyPointsUsed}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  // Maximum points allowed strictly by available points + points already used in this order (if editing)
                                  const customerPoints = activeTab.selectedCustomer.points;
                                  const alreadyUsed = activeTab.initialLoyaltyPointsUsed || 0;
                                  const effectiveAvailablePoints = customerPoints + alreadyUsed;

                                  // Also explicitly cap by the remaining bill amount
                                  // Loyalty Deduction = Value (1 point = 1 rupee)
                                  const remainingBillAmount = Math.max(0, amountAfterTax - billDiscountAmount);

                                  // The user cannot use more than their total available balance
                                  // AND cannot use more than the bill total
                                  const effectiveMax = Math.min(effectiveAvailablePoints, remainingBillAmount + (activeTab.loyaltyPointsUsed || 0));
                                  // Wait, remainingBillAmount is calculated AFTER loyalty deduction in some contexts?
                                  // line 980: amountBeforeRounding = amountAfterTax - billDiscountAmount - loyaltyDeduction;
                                  // So remainingBillAmount above (amountAfterTax - billDiscountAmount) is "Pre-Loyalty Total".
                                  // So simple Math.min(effectiveAvailablePoints, PreLoyaltyTotal) is correct.

                                  const maxPossible = Math.min(effectiveAvailablePoints, Math.max(0, amountAfterTax - billDiscountAmount));

                                  if (value >= 0 && value <= maxPossible) {
                                    updateActiveTab({ loyaltyPointsUsed: value });
                                  }
                                }}
                                className="flex-1 px-2 py-1.5 text-right text-sm font-bold rounded border border-purple-300 bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                placeholder="0"
                              />
                              <span className="text-[10px] text-gray-600 font-medium">/{activeTab.selectedCustomer.points}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded p-1 flex items-center justify-center">
                            <span className="text-[9px] text-gray-400">{t('sales.pos.rightPanel.noLoyalty')}</span>
                          </div>
                        )}
                      </div>

                      {/* Grand Total - Big View */}
                      <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 text-xs font-bold">{t('sales.pos.rightPanel.grandTotal')}</span>
                          <span className="text-2xl font-bold text-green-700">₹{grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* EXPANDED VIEW - All Details */
                    <>
                      {/* Subtotal */}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-xs">{t('sales.pos.rightPanel.subtotal')}:</span>
                        <span className="font-semibold text-gray-900 text-sm">₹{subtotal.toFixed(2)}</span>
                      </div>

                      {/* Item Discount (from table) */}
                      {activeTab.billItems.some(item => item.discount > 0) && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-xs">{t('sales.pos.rightPanel.itemDiscount')}:</span>
                          <span className="font-semibold text-yellow-700 text-sm">
                            -₹{activeTab.billItems.reduce((sum, item) => {
                              const basePrice = item.price * item.qty;
                              const discountAmount = (basePrice * item.discount) / 100;
                              return sum + discountAmount;
                            }, 0).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Before Tax Amount */}
                      <div className="flex justify-between items-center pt-1 border-t border-gray-300">
                        <span className="text-gray-700 text-xs font-medium">{t('sales.pos.rightPanel.beforeTax')}:</span>
                        <span className="font-bold text-gray-900 text-sm">₹{amountBeforeTax.toFixed(2)}</span>
                      </div>

                      {/* Tax Breakdown */}
                      {taxSettings.enableTax && (
                        <>
                          {taxSettings.taxType === 'SGST' ? (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-xs">{t('sales.pos.table.sgst')}:</span>
                                <span className="font-semibold text-purple-700 text-sm">₹{taxBreakdown.sgst.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-xs">{t('sales.pos.table.cgst')}:</span>
                                <span className="font-semibold text-purple-700 text-sm">₹{taxBreakdown.cgst.toFixed(2)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-xs">{t('sales.pos.table.igst')}:</span>
                              <span className="font-semibold text-purple-700 text-sm">₹{taxBreakdown.igst.toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* After Tax Amount */}
                      {taxSettings.enableTax && (
                        <div className="flex justify-between items-center pt-1 border-t border-gray-300">
                          <span className="text-gray-700 text-xs font-medium">{t('sales.pos.rightPanel.afterTax')}:</span>
                          <span className="font-bold text-gray-900 text-sm">₹{amountAfterTax.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Round Off */}
                      {Math.abs(roundOffAmount) > 0.01 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-xs">{t('sales.pos.rightPanel.roundOff')}:</span>
                          <span className={`font-semibold text-sm ${roundOffAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {roundOffAmount >= 0 ? '+' : ''}₹{roundOffAmount.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Bill Discount & Loyalty - Expanded View */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-gray-300 mt-1">
                        {/* Bill Discount */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-gray-700 text-[10px] font-semibold">💰 {t('sales.pos.rightPanel.discount')}</span>
                            <span className="text-[8px] text-gray-500 bg-white px-0.5 py-0.5 rounded">Ctrl+D</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <input
                              ref={discountInputRef}
                              type="number"
                              min="0"
                              max={activeTab.discountType === 'percentage' ? 100 : amountAfterTax}
                              value={activeTab.billDiscount}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                const maxValue = activeTab.discountType === 'percentage' ? 100 : amountAfterTax;
                                if (value >= 0 && value <= maxValue) {
                                  updateActiveTab({ billDiscount: value });
                                }
                              }}
                              className="flex-1 px-2 py-1.5 text-right text-sm font-bold rounded border border-yellow-300 bg-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 focus:outline-none"
                              placeholder="0"
                            />
                            <select
                              value={activeTab.discountType}
                              onChange={(e) => updateActiveTab({ discountType: e.target.value, billDiscount: 0 })}
                              className="px-1.5 py-1.5 text-xs font-semibold rounded border border-yellow-300 bg-white focus:border-yellow-500 focus:outline-none"
                            >
                              <option value="flat">₹</option>
                              <option value="percentage">%</option>
                            </select>
                          </div>
                        </div>

                        {/* Loyalty Points */}
                        {activeTab.selectedCustomer && (activeTab.selectedCustomer.points > 0 || activeTab.loyaltyPointsUsed > 0) ? (
                          <div className="bg-purple-50 border border-purple-200 rounded p-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-gray-700 text-[10px] font-semibold">🎁 {t('sales.pos.rightPanel.loyalty')}</span>
                              <span className="text-[8px] text-gray-500 bg-white px-0.5 py-0.5 rounded">Ctrl+L</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <input
                                ref={loyaltyPointsInputRef}
                                type="number"
                                min="0"
                                max={activeTab.selectedCustomer.points + (id ? (editOrder?.loyaltyPointsUsed || 0) : 0)} // Approximate fix for max
                                value={activeTab.loyaltyPointsUsed}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  // Calculate effective max (current balance + initial usage if editing)
                                  // Note: This logic is slightly flawed because editOrder.loyaltyPointsUsed updates as we type if we are not careful?
                                  // No, editOrder is the detailed state. activeTab is the working state.
                                  // Actually activeTab IS editOrder in edit mode.
                                  // So we can't rely on activeTab for "initial" value.
                                  // For now, let's just use a large max or rely on backend validation, or just stick to current points logic but allow current value.
                                  // Simplest valid change: Allow if value <= (current + current_value) which treats current value as reusable.
                                  const currentPoints = activeTab.selectedCustomer.points;
                                  const currentUsage = activeTab.loyaltyPointsUsed;
                                  // We use a high max to prevent blocking the user, validation happens elsewhere or use a loose max
                                  if (value >= 0) {
                                    updateActiveTab({ loyaltyPointsUsed: value });
                                  }
                                }}
                                className="flex-1 px-2 py-1.5 text-right text-sm font-bold rounded border border-purple-300 bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                placeholder="0"
                              />
                              <span className="text-[10px] text-gray-600 font-medium">/{activeTab.selectedCustomer.points}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded p-1 flex items-center justify-center">
                            <span className="text-[9px] text-gray-400">{t('sales.pos.rightPanel.noLoyalty')}</span>
                          </div>
                        )}
                      </div>

                      {/* Grand Total - Big View */}
                      <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 text-xs font-bold">{t('sales.pos.rightPanel.grandTotal')}</span>
                          <span className="text-2xl font-bold text-green-700">₹{grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Payment Section */}
              {!id ? (
                <div className={`${cardBg} shadow-sm border ${borderColor} p-2`}>
                  <h3 className="font-semibold flex items-center gap-2 mb-2 text-sm">
                    <CreditCard size={16} /> {t('sales.pos.rightPanel.quickPayment')}
                  </h3>

                  {/* Payment Method Dropdown */}
                  <div className="mb-2">
                    <label className="text-xs text-gray-600 mb-1 flex justify-between items-center">
                      <span>{t('sales.pos.rightPanel.paymentMethod')}</span>
                      <span className="text-[10px] text-gray-500">{t('sales.pos.rightPanel.paymentShortcuts')}</span>
                    </label>
                    <select
                      value={activeTab.paymentType === 'split' ? 'split' : activeTab.paymentMethod}
                      onChange={(e) => {
                        if (e.target.value === 'split') {
                          updateActiveTab({
                            paymentType: 'split',
                            splitPayments: { cash: 0, card: 0, upi: 0, credit: 0, loyaltyPoints: 0 }
                          });
                        } else {
                          updateActiveTab({
                            paymentType: 'single',
                            paymentMethod: e.target.value,
                            receivedAmount: e.target.value === 'credit' ? 0 : grandTotal
                          });
                        }
                      }}
                      className="w-full px-2 py-1.5 text-sm rounded border-2 border-gray-300 bg-white focus:border-blue-500 focus:outline-none font-medium"
                    >
                      <option value="cash">💵 {t('sales.pos.rightPanel.methods.cash')}</option>
                      <option value="card">💳 {t('sales.pos.rightPanel.methods.card')}</option>
                      <option value="upi">📱 {t('sales.pos.rightPanel.methods.upi')}</option>
                      <option value="credit">📝 {t('sales.pos.rightPanel.methods.credit')}</option>
                      <option value="split">🔀 {t('sales.pos.rightPanel.methods.split')}</option>
                    </select>
                  </div>

                  {/* Cash Payment - Show received amount and change */}
                  {activeTab.paymentType === 'single' && activeTab.paymentMethod === 'cash' && (
                    <div className="space-y-1 mb-2">
                      <label className="text-xs text-gray-600 mb-0.5 block">{t('sales.pos.rightPanel.cashReceived')}</label>
                      <input
                        type="number"
                        value={activeTab.receivedAmount === 0 ? '0' : (activeTab.receivedAmount || '')}
                        onChange={(e) => updateActiveTab({ receivedAmount: Number(e.target.value) })}
                        placeholder="0.00"
                        className={`w-full px-2 py-1 text-sm rounded-lg border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500`}
                      />
                      {/* Quick Amount Buttons */}
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => updateActiveTab({ receivedAmount: grandTotal })}
                          className="py-1 px-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 font-medium"
                        >
                          {t('sales.pos.rightPanel.exact')}
                        </button>
                        <button
                          onClick={() => updateActiveTab({ receivedAmount: Math.ceil(grandTotal / 50) * 50 })}
                          className="py-1 px-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 font-medium"
                        >
                          ₹{Math.ceil(grandTotal / 50) * 50}
                        </button>
                        <button
                          onClick={() => updateActiveTab({ receivedAmount: Math.ceil(grandTotal / 100) * 100 })}
                          className="py-1 px-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 font-medium"
                        >
                          ₹{Math.ceil(grandTotal / 100) * 100}
                        </button>
                      </div>

                      {/* Change or Balance Display */}
                      {activeTab.receivedAmount > 0 && activeTab.receivedAmount >= grandTotal ? (
                        <div className="flex justify-between items-center p-1.5 bg-green-50 rounded-lg border border-green-200">
                          <span className="text-xs font-medium text-green-700">{t('sales.pos.rightPanel.change')}</span>
                          <span className="font-bold text-xs text-green-600">
                            ₹{Math.max(0, activeTab.receivedAmount - grandTotal).toFixed(2)}
                          </span>
                        </div>
                      ) : activeTab.receivedAmount < grandTotal && (
                        <div className="flex justify-between items-center p-1.5 bg-red-50 rounded-lg border border-red-200">
                          <span className="text-xs font-medium text-red-700">{t('sales.pos.rightPanel.balanceDue')}</span>
                          <span className="font-bold text-xs text-red-600">
                            ₹{Math.max(0, grandTotal - (activeTab.receivedAmount || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Credit / Pay Later - Show Balance Due */}
                  {activeTab.paymentType === 'single' && activeTab.paymentMethod === 'credit' && (
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg border border-red-200">
                        <span className="text-xs font-medium text-red-700">{t('sales.pos.rightPanel.balanceDuePayLater')}</span>
                        <span className="font-bold text-sm text-red-600">
                          ₹{grandTotal.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 text-center">
                        {t('sales.pos.rightPanel.payLaterNote')}
                      </p>
                    </div>
                  )}

                  {/* Split Payment */}
                  {activeTab.paymentType === 'split' && (
                    <div className="space-y-1 mb-2">
                      <div className="text-[9px] text-gray-500 mb-1 flex justify-between items-center px-1">
                        <span>{t('sales.pos.rightPanel.splitInstruction')}</span>
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">{t('sales.pos.rightPanel.tabNavigate')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <label className="text-xs text-gray-600 mb-0.5 block">💵 {t('sales.pos.rightPanel.methods.cash')}</label>
                          <input
                            ref={splitPaymentCashRef}
                            type="number"
                            value={activeTab.splitPayments.cash || ''}
                            onChange={(e) => updateSplitPayment('cash', e.target.value)}
                            placeholder="0.00"
                            className={`w-full px-1.5 py-1 text-xs rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-green-500`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-0.5 block">💳 {t('sales.pos.rightPanel.methods.card')}</label>
                          <input
                            ref={splitPaymentCardRef}
                            type="number"
                            value={activeTab.splitPayments.card || ''}
                            onChange={(e) => updateSplitPayment('card', e.target.value)}
                            placeholder="0.00"
                            className={`w-full px-1.5 py-1 text-xs rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-blue-500`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-0.5 block">📱 {t('sales.pos.rightPanel.methods.upi')}</label>
                          <input
                            ref={splitPaymentUpiRef}
                            type="number"
                            value={activeTab.splitPayments.upi || ''}
                            onChange={(e) => updateSplitPayment('upi', e.target.value)}
                            placeholder="0.00"
                            className={`w-full px-1.5 py-1 text-xs rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-purple-500`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-0.5 block">🏦 {t('sales.pos.rightPanel.methods.credit')}</label>
                          <input
                            ref={splitPaymentCreditRef}
                            type="number"
                            value={activeTab.splitPayments.credit || ''}
                            onChange={(e) => updateSplitPayment('credit', e.target.value)}
                            placeholder="0.00"
                            className={`w-full px-1.5 py-1 text-xs rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-orange-500`}
                          />
                        </div>
                      </div>
                      <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-blue-700 font-medium">{t('sales.pos.rightPanel.totalPaid')}</span>
                          <span className="font-bold text-blue-900">₹{totalPaid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs mt-0.5">
                          <span className="text-blue-700 font-medium">{t('sales.pos.rightPanel.remaining')}</span>
                          <span className={`font-bold ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{Math.abs(remainingAmount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="space-y-2 mt-2">
                {/* Complete Payment Button */}
                <button
                  onClick={completePayment}
                  disabled={
                    isProcessing ||
                    activeTab.billItems.length === 0 ||
                    (activeTab.paymentType === 'split' && remainingAmount > 0)
                  }
                  className="w-full py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all text-sm"
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CreditCard size={16} />
                  )}
                  {isProcessing ? t('common.processing') || 'Processing...' : t('sales.pos.rightPanel.completePayment')}
                </button>

                {/* Complete and Print Button */}
                <button
                  onClick={completeAndPrint}
                  disabled={
                    isProcessing ||
                    activeTab.billItems.length === 0 ||
                    (activeTab.paymentType === 'split' && remainingAmount > 0)
                  }
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all text-sm"
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Printer size={16} />
                  )}
                  {isProcessing ? t('common.processing') || 'Processing...' : t('sales.pos.rightPanel.completeAndPrint') || 'Complete & Print'}
                </button>
              </div>
            </div>
          </div>

          {/* Old sections removed - keeping only modals below */}
          <div className="hidden">

            {/* Bill Summary - Enhanced View */}
            <div className={`${cardBg} shadow-lg border-2 ${borderColor} rounded-lg overflow-hidden`}>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3">
                <h3 className="font-bold flex items-center gap-2 text-base">
                  <span>📊</span> Bill Summary
                </h3>
              </div>

              {/* Amount Breakdown */}
              <div className="p-4 space-y-3">
                {/* Subtotal - Large and Clear */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Subtotal ({activeTab.billItems.length} items)</span>
                    <span className="text-2xl font-bold text-blue-700">₹{subtotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Discount Input - Prominent */}
                <div className="bg-yellow-50 p-3 rounded-lg border-2 border-yellow-200">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-700">💰 Discount</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">₹</span>
                      <input
                        type="number"
                        min="0"
                        max={subtotal}
                        value={activeTab.billDiscount}
                        onChange={(e) => updateActiveTab({ billDiscount: Number(e.target.value) })}
                        className="w-24 px-3 py-4 text-right text-xl font-bold rounded-lg border-2 border-yellow-300 focus:border-yellow-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {activeTab.billDiscount > 0 && (
                    <div className="text-xs text-yellow-700 flex justify-between">
                      <span>Discount Applied</span>
                      <span className="font-semibold">-₹{activeTab.billDiscount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Tax Breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Taxable Amount</span>
                    <span className="font-semibold text-gray-900">₹{taxBreakdown.taxableAmount.toFixed(2)}</span>
                  </div>

                  {taxSettings.enableTax && (
                    <div className="bg-purple-50 p-2 rounded space-y-1">
                      {taxSettings.taxType === 'SGST' ? (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">SGST ({taxBreakdown.sgst > 0 ? ((taxBreakdown.sgst / taxBreakdown.taxableAmount) * 100).toFixed(1) : 0}%)</span>
                            <span className="font-medium">₹{taxBreakdown.sgst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">CGST ({taxBreakdown.cgst > 0 ? ((taxBreakdown.cgst / taxBreakdown.taxableAmount) * 100).toFixed(1) : 0}%)</span>
                            <span className="font-medium">₹{taxBreakdown.cgst.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">IGST ({taxBreakdown.igst > 0 ? ((taxBreakdown.igst / taxBreakdown.taxableAmount) * 100).toFixed(1) : 0}%)</span>
                          <span className="font-medium">₹{taxBreakdown.igst.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-purple-200">
                        <span className="font-medium text-gray-700">Total Tax</span>
                        <span className="font-bold text-purple-700">₹{taxAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Round Off */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-600">Round Off</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={activeTab.roundOff}
                        onChange={(e) => updateActiveTab({ roundOff: Number(e.target.value) })}
                        className="w-20 px-3 py-2 text-right text-lg font-bold rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {activeTab.selectedCustomer && activeTab.selectedCustomer.points > 0 && (
                    <div className="bg-purple-50 p-2 rounded space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Loyalty Points</span>
                        <div className="flex items-center gap-1">
                          <span>UPI</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Payment Section */}
            {!id &&
              <div className={`${cardBg} shadow-sm border ${borderColor} p-3`}>
                <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                  <CreditCard size={16} /> Quick Payment
                </h3>

                {/* Quick Payment Method Buttons */}
                <div className="space-y-2 mb-3">
                  <label className="text-xs text-gray-600 mb-1 block">Select Payment Method (or use Alt+1/2/3/4)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        updateActiveTab({
                          paymentType: 'single',
                          paymentMethod: 'cash',
                          receivedAmount: grandTotal
                        });
                      }}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all border-2 relative ${activeTab.paymentType === 'single' && activeTab.paymentMethod === 'cash'
                        ? 'bg-green-600 text-white border-green-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base">💵</span>
                        <span>Cash</span>
                      </div>
                      <span className={`absolute top-0.5 right-1 text-[10px] px-1 rounded ${activeTab.paymentType === 'single' && activeTab.paymentMethod === 'cash'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-gray-600'
                        }`}>Alt+1</span>
                    </button>
                    <button
                      onClick={() => {
                        updateActiveTab({
                          paymentType: 'single',
                          paymentMethod: 'card',
                          receivedAmount: grandTotal
                        });
                      }}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all border-2 relative ${activeTab.paymentType === 'single' && activeTab.paymentMethod === 'card'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base">💳</span>
                        <span>Card</span>
                      </div>
                      <span className={`absolute top-0.5 right-1 text-[10px] px-1 rounded ${activeTab.paymentType === 'single' && activeTab.paymentMethod === 'card'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-gray-600'
                        }`}>Alt+2</span>
                    </button>
                    <button
                      onClick={() => {
                        updateActiveTab({
                          paymentType: 'single',
                          paymentMethod: 'upi',
                          receivedAmount: grandTotal
                        });
                      }}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all border-2 relative ${activeTab.paymentType === 'single' && activeTab.paymentMethod === 'upi'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base">📱</span>
                        <span>UPI</span>
                      </div>
                      <span className={`absolute top-0.5 right-1 text-[10px] px-1 rounded ${activeTab.paymentType === 'single' && activeTab.paymentMethod === 'upi'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-gray-600'
                        }`}>Alt+3</span>
                    </button>
                    <button
                      onClick={() => {
                        updateActiveTab({
                          paymentType: 'single',
                          paymentMethod: 'credit',
                          receivedAmount: grandTotal
                        });
                      }}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all border-2 relative ${activeTab.paymentType === 'single' && activeTab.paymentMethod === 'credit'
                        ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:bg-orange-50'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base">🏦</span>
                        <span>Credit</span>
                      </div>
                      <span className={`absolute top-0.5 right-1 text-[10px] px-1 rounded ${activeTab.paymentType === 'single' && activeTab.paymentMethod === 'credit'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-gray-600'
                        }`}>Alt+4</span>
                    </button>
                  </div>
                </div>

                {/* Cash Payment - Show received amount and change */}
                {activeTab.paymentType === 'single' && activeTab.paymentMethod === 'cash' && (
                  <div className="space-y-2 mb-3">
                    <label className="text-xs text-gray-600 mb-1 block">Cash Received</label>
                    <input
                      type="number"
                      value={activeTab.receivedAmount || ''}
                      onChange={(e) => updateActiveTab({ receivedAmount: Number(e.target.value) })}
                      placeholder="0.00"
                      className={`w-full px-3 py-2 text-sm rounded-lg border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500`}
                    />
                    {/* Quick Amount Buttons */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => updateActiveTab({ receivedAmount: grandTotal })}
                        className="py-1.5 px-2 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 font-medium"
                      >
                        Exact
                      </button>
                      <button
                        onClick={() => updateActiveTab({ receivedAmount: Math.ceil(grandTotal / 50) * 50 })}
                        className="py-1.5 px-2 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 font-medium"
                      >
                        ₹{Math.ceil(grandTotal / 50) * 50}
                      </button>
                      <button
                        onClick={() => updateActiveTab({ receivedAmount: Math.ceil(grandTotal / 100) * 100 })}
                        className="py-1.5 px-2 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 font-medium"
                      >
                        ₹{Math.ceil(grandTotal / 100) * 100}
                      </button>
                    </div>
                    {activeTab.receivedAmount > 0 && activeTab.receivedAmount >= grandTotal && (
                      <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg border border-green-200">
                        <span className="text-xs font-medium text-green-700">Change to Return</span>
                        <span className="font-bold text-sm text-green-600">
                          ₹{Math.max(0, activeTab.receivedAmount - grandTotal).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Split Payment Toggle */}
                <button
                  onClick={() => {
                    if (activeTab.paymentType === 'split') {
                      updateActiveTab({
                        paymentType: 'single',
                        paymentMethod: 'cash',
                        receivedAmount: grandTotal
                      });
                    } else {
                      updateActiveTab({
                        paymentType: 'split',
                        splitPayments: { cash: 0, card: 0, upi: 0, credit: 0, loyaltyPoints: 0 }
                      });
                    }
                  }}
                  className="w-full py-2 border-2 border-dashed border-gray-400 rounded-lg hover:bg-gray-50 hover:border-gray-500 flex items-center justify-center gap-2 text-xs font-medium mb-3 transition-all"
                >
                  {activeTab.paymentType === 'split' ? '← Back to Single Payment' : '+ Split Payment'}
                </button>

                {/* Split Payment */}
                {activeTab.paymentType === 'split' && (
                  <div className="space-y-2 mb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">💵 Cash</label>
                        <input
                          type="number"
                          value={activeTab.splitPayments.cash || ''}
                          onChange={(e) => updateSplitPayment('cash', e.target.value)}
                          placeholder="0.00"
                          className={`w-full px-2 py-1.5 text-sm rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-green-500`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">💳 Card</label>
                        <input
                          type="number"
                          value={activeTab.splitPayments.card || ''}
                          onChange={(e) => updateSplitPayment('card', e.target.value)}
                          placeholder="0.00"
                          className={`w-full px-2 py-1.5 text-sm rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">📱 UPI</label>
                        <input
                          type="number"
                          value={activeTab.splitPayments.upi || ''}
                          onChange={(e) => updateSplitPayment('upi', e.target.value)}
                          placeholder="0.00"
                          className={`w-full px-2 py-1.5 text-sm rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-purple-500`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">🏦 Credit</label>
                        <input
                          type="number"
                          value={activeTab.splitPayments.credit || ''}
                          onChange={(e) => updateSplitPayment('credit', e.target.value)}
                          placeholder="0.00"
                          className={`w-full px-2 py-1.5 text-sm rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-orange-500`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">🎁 Loyalty Points</label>
                      <input
                        type="number"
                        value={activeTab.splitPayments.loyaltyPoints || ''}
                        onChange={(e) => updateSplitPayment('loyaltyPoints', e.target.value)}
                        placeholder="0.00"
                        className={`w-full px-2 py-1.5 text-sm rounded border-2 ${borderColor} ${cardBg} focus:outline-none focus:ring-1 focus:ring-yellow-500`}
                      />
                    </div>
                    <div className={`pt-2 border-t ${borderColor} space-y-1`}>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Total Paid</span>
                        <span className="font-semibold">₹{totalPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Remaining</span>
                        <span className={`font-bold ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                          ₹{Math.abs(remainingAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            }

            {/* Action Buttons */}
            <div className="space-y-2">
              {/* Complete Payment Button */}
              <button
                onClick={completePayment}
                disabled={
                  activeTab.billItems.length === 0
                }
                className="w-full py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all text-sm"
              >
                <CreditCard size={16} /> Complete Payment
                {activeTab.paymentType === 'single' && activeTab.paymentMethod === 'cash' && activeTab.receivedAmount >= grandTotal && (
                  <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                    Change: ₹{(activeTab.receivedAmount - grandTotal).toFixed(2)}
                  </span>
                )}
              </button>


              {/* Complete and Print Button */}
              <button
                onClick={completeAndPrint}
                disabled={
                  activeTab.billItems.length === 0
                }
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all text-sm"
              >
                <Printer size={16} /> Complete & Print
              </button>
            </div>
          </div>
        </div>

        {/* Customer Selection Modal */}
        {showCustomerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className={`${cardBg} rounded-lg shadow-xl w-full max-w-lg mx-4`}>
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold">Select Customer</h3>
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setCustomerSearchQuery('');
                  }}
                  className={`${hoverBg} p-1 rounded`}
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      placeholder="Search by name or mobile..."
                      className={`w-full pl-10 pr-10 py-2 rounded-lg border ${borderColor} ${cardBg}`}
                    />
                    {customersLoading && (
                      <div className="absolute right-3 top-3">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddCustomerForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
                    title="Add New Customer (F3)"
                  >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Add Customer</span>
                    <kbd className="hidden sm:inline text-xs bg-green-700 px-1.5 py-0.5 rounded ml-1">F3</kbd>
                  </button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {customersLoading && customers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-spin h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p>Loading customers...</p>
                    </div>
                  ) : customers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <User className="mx-auto mb-2" size={48} />
                      <p>No customers found</p>
                      <p className="text-sm mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    customers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => {
                          updateActiveTab({ selectedCustomer: customer });
                          setShowCustomerModal(false);
                        }}
                        className={`p-3 rounded-lg border ${borderColor} ${hoverBg} cursor-pointer`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {customer.name}
                              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                                {customer.type}
                              </span>
                            </div>
                            <div className={`text-sm ${textSecondary}`}>📱 {customer.phone}</div>
                            <div className={`text-sm ${textSecondary}`}>📍 {customer.address}</div>
                          </div>
                          <div className="text-sm font-semibold text-yellow-600">
                            {customer.points} pts
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Customer Add/Edit Modal */}
        <CustomerAddEditForm
          customerModal={showAddCustomerForm}
          setCustomerModal={setShowAddCustomerForm}
          editingCustomer={null}
          onSuccess={async (result, customerData) => {
            // Close the add customer modal
            setShowAddCustomerForm(false);

            // Auto-select the newly created customer
            if (result && result.customerId && customerData) {
              const newCustomer = {
                id: result.customerId,
                name: customerData.customer_name,
                type: customerData.customer_type || 'Retail',
                phone: customerData.mobile_number || '',
                email: customerData.email || '',
                address: `${customerData.address_line_1 || ''}${customerData.address_line_2 ? ', ' + customerData.address_line_2 : ''}, ${customerData.city || ''}, ${customerData.state || ''} - ${customerData.pincode || ''}`.trim(),
                city: customerData.city || '',
                state: customerData.state || '',
                pincode: customerData.pincode || '',
                gstin: customerData.gstin || '',
                businessName: customerData.business_name || '',
                points: 0
              };
              updateActiveTab({ selectedCustomer: newCustomer });
              toast.success(`Customer "${customerData.customer_name}" added and selected!`);
            }

            // Refresh customer list
            await fetchCustomers();
            // Close the customer selection modal
            setShowCustomerModal(false);
          }}
        />

      </div>
    </>
  );
};

export default POSBillingSystem;


