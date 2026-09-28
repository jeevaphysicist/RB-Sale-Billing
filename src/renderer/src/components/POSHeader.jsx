import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  ShoppingCart,
  Receipt,
  FileText,
  Settings,
  Users,
  Package,
  BarChart3,
  Clock,
  Maximize2,
  Minimize2
} from 'lucide-react';
import FontSizeControls from './FontSizeControls';

const POSHeader = ({
  billNo = 'SO-2025-221',
  counter = 'Counter 1',
  cashier = 'John Doe',
  store = 'Main Store - Mumbai',
  paymentMode = 'Cash'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Initial fullscreen state
    if (window.api && window.api.isFullscreen) {
      window.api.isFullscreen().then(setIsFullscreen);
    }

    // Fullscreen listeners
    let unsubscribeFs;
    let unsubscribeUnFs;
    if (window.api && window.api.onWindowFullscreen) {
      unsubscribeFs = window.api.onWindowFullscreen(() => setIsFullscreen(true));
      unsubscribeUnFs = window.api.onWindowUnfullscreen(() => setIsFullscreen(false));
    }

    return () => {
      clearInterval(timer);
      if (unsubscribeFs) unsubscribeFs();
      if (unsubscribeUnFs) unsubscribeUnFs();
    };
  }, []);

  const toggleFullscreen = () => {
    if (window.api && window.api.toggleFullscreen) {
      window.api.toggleFullscreen();
    }
  };

  const formatDateTime = (date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  const navigationItems = [
    { icon: Home, label: 'Dashboard', path: '/', color: 'text-blue-600', bgColor: 'bg-blue-50', hoverColor: 'hover:bg-blue-100' },
    { icon: ShoppingCart, label: 'Sales', path: '/sales', color: 'text-green-600', bgColor: 'bg-green-50', hoverColor: 'hover:bg-green-100' },
    { icon: Receipt, label: 'Purchase', path: '/purchases', color: 'text-purple-600', bgColor: 'bg-purple-50', hoverColor: 'hover:bg-purple-100' },
    { icon: Package, label: 'Products', path: '/products', color: 'text-orange-600', bgColor: 'bg-orange-50', hoverColor: 'hover:bg-orange-100' },
    { icon: Users, label: 'Customers', path: '/customers', color: 'text-pink-600', bgColor: 'bg-pink-50', hoverColor: 'hover:bg-pink-100' },
    { icon: BarChart3, label: 'Reports', path: '/reports', color: 'text-indigo-600', bgColor: 'bg-indigo-50', hoverColor: 'hover:bg-indigo-100' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-gray-600', bgColor: 'bg-gray-50', hoverColor: 'hover:bg-gray-100' }
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bg-white shadow-md">
      {/* Top Row - Business Info & Navigation */}
      <div className="px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">


          {/* left - Navigation */}
          <div className="flex items-center gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${active
                      ? `${item.bgColor} ${item.color} font-medium shadow-sm`
                      : `text-gray-600 ${item.hoverColor}`
                    }`}
                  title={item.label}
                >
                  <Icon size={18} />
                  <span className="text-sm hidden xl:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* right - Bill No, Counter, Cashier*/}
          <div className={` flex items-center  gap-8 justify-between  `}>
            <div>
              <span className="text-gray-500 text-xs">Bill No</span>
              <div className="font-semibold text-gray-900">{billNo}</div>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Counter</span>
              <div className="font-semibold text-gray-900">{counter}</div>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Cashier</span>
              <div className="font-semibold text-gray-900">{cashier}</div>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Store</span>
              <div className="font-semibold text-gray-900">{store}</div>
            </div>
            <FontSizeControls variant="default" />
            <button
              onClick={toggleFullscreen}
              className={`p-2 rounded-lg transition-all ${isFullscreen ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSHeader;
