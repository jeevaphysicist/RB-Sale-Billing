import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ShoppingCart,
  ShoppingBag,
  Package,
  Users,
  Truck,
  Banknote,
  FileBarChart,
  Settings,
  PlusCircle,
  CreditCard,
  Barcode,
  Soup,
  PcCase,
  HandCoins,
  ShoppingBasket
} from 'lucide-react'

const Index = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const navigationItems = [
    {
      id: 'new-sale',
      label: t('common.newSale'),
      icon: ShoppingBasket,
      path: '/sales/new',
      color: 'bg-emerald-100 text-emerald-700',
      hoverColor: 'hover:bg-emerald-200',
      description: t('homepage.createSalesInvoice')
    },
    {
      id: 'products',
      label: t('nav.products'),
      icon: PcCase,
      path: '/products',
      color: 'bg-orange-100 text-orange-700',
      hoverColor: 'hover:bg-orange-200',
      description: t('homepage.manageInventory')
    },
    {
      id: 'customers',
      label: t('nav.customers'),
      icon: Users,
      path: '/customers',
      color: 'bg-purple-100 text-purple-700',
      hoverColor: 'hover:bg-purple-200',
      description: t('homepage.viewManageCustomers')
    },
    {
      id: 'reports',
      label: t('nav.reports'),
      icon: FileBarChart,
      path: '/reports',
      color: 'bg-teal-100 text-teal-700',
      hoverColor: 'hover:bg-teal-200',
      description: t('homepage.viewAnalytics')
    },
      {
      id: 'expenses',
      label: t('nav.expenses'),
      icon: Banknote,
      path: '/expense-management',
      color: 'bg-red-100 text-red-700',
      hoverColor: 'hover:bg-red-200',
      description: t('homepage.trackExpenses')
    },
    {
      id: 'barcode',
      label: t('products.barcode'),
      icon: Barcode,
      path: '/barcode-generator',
      color: 'bg-pink-100 text-pink-700',
      hoverColor: 'hover:bg-pink-200',
      description: t('homepage.generateBarcodes')
    },
    
    {
      id: 'new-purchase',
      label: t('common.newPurchase'),
      icon: ShoppingBag,
      path: '/purchases/new',
      color: 'bg-blue-100 text-blue-700',
      hoverColor: 'hover:bg-blue-200',
      description: t('homepage.recordPurchase')
    }, 
    {
      id: 'suppliers',
      label: t('nav.suppliers'),
      icon: Truck,
      path: '/suppliers',
      color: 'bg-indigo-100 text-indigo-700',
      hoverColor: 'hover:bg-indigo-200',
      description: t('homepage.manageSupplierDetails')
    },
  
    
    
  ]

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">{t('homepage.welcomeBack')}</h1>
        <p className="text-gray-600">{t('homepage.whatToDo')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`
              flex flex-col items-center justify-center p-8 rounded-2xl
              transition-all duration-300 transform hover:scale-105 hover:shadow-lg
              ${item.color} ${item.hoverColor}
              group border-2 border-transparent hover:border-current
            `}
          >
            <div className="mb-4 p-4 bg-white bg-opacity-60 rounded-full shadow-sm group-hover:bg-opacity-80 transition-all">
              <item.icon size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold mb-2">{item.label}</h3>
            <p className="text-sm opacity-80 text-center font-medium">{item.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default Index