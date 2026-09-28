import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Home,
  Settings,
  User,
  FileText,
  ShoppingCart,
  LogOut,
  Users,
  ChevronDown,
  ChevronRight,
  Menu,
  Banknote,
  UserPlus,
  Truck,
  UserCog,
  ShoppingBasket
} from 'lucide-react'
import WindowControls from './WindowControls'
import FontSizeControls from './FontSizeControls'

const Layout = ({ children, onLogout, currentUser }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({})
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [profileImage, setProfileImage] = useState(null)

  React.useEffect(() => {
    const fetchProfileImage = async () => {
      if (currentUser?.id) {
        try {
          const response = await window.api.getProfileImage(currentUser.id)
          if (response.success && response.imageData) {
            setProfileImage(response.imageData)
          } else {
            setProfileImage(null)
          }
        } catch (error) {
          console.error('Error fetching profile image:', error)
          setProfileImage(null)
        }
      }
    }
    fetchProfileImage()
  }, [currentUser])

  const mainMenuItems = [
    {
      id: 'dashboard',
      icon: Home,
      label: t('nav.dashboard'),
      path: '/'
    },
    {
      id: 'sales',
      icon: ShoppingCart,
      label: t('nav.sales'),
      isGroup: true,
      subItems: [
        { icon: ShoppingBasket, label: t('nav.addSales'), path: '/sales/new' },
        { icon: FileText, label: t('nav.salesList'), path: '/sales' },
        { icon: Banknote, label: t('nav.paymentTracking'), path: '/sales/payments' },
        // { icon: ShoppingBasket, label: "Sales POS", path: "/sales/pos" }
      ]
    },
    {
      id: 'parties',
      icon: Users,
      label: 'Parties', // Using hardcoded label 'Parties' as key might not exist
      isGroup: true,
      subItems: [
        { icon: UserPlus, label: t('nav.customers'), path: '/customers', defaultSub: '/customers' },
        { icon: Truck, label: t('nav.suppliers'), path: '/suppliers', defaultSub: '/suppliers' }
      ]
    },
    {
      id: 'admin',
      icon: UserCog,
      label: 'Administration',
      isGroup: true,
      subItems: [
        { icon: Settings, label: t('nav.settings'), path: '/settings' }
      ]
    }
  ]

  const isActivePath = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const isMenuActive = (item) => {
    // Check if main item is active
    if (item.path && isActivePath(item.path)) {
      return true
    }

    // Check if any submenu item is active
    if (item.subItems) {
      for (const subItem of item.subItems) {
        if (subItem.path && isActivePath(subItem.path)) {
          return true
        }
        // Check nested submenu items
        if (subItem.submenuItems) {
          for (const nestedItem of subItem.submenuItems) {
            if (isActivePath(nestedItem.path)) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  const getCurrentPageTitle = () => {
    // Check all menu items and their nested items
    for (const item of mainMenuItems) {
      if (item.path && isActivePath(item.path) && !item.isGroup) {
        return item.label
      }

      if (item.subItems) {
        for (const subItem of item.subItems) {
          if (subItem.path && isActivePath(subItem.path)) {
            if (subItem.hasSubmenu && subItem.submenuItems) {
              // Check nested submenu items
              for (const nestedItem of subItem.submenuItems) {
                if (isActivePath(nestedItem.path)) {
                  return nestedItem.label
                }
              }
              return subItem.label
            }
            return subItem.label
          }
        }
      }
    }
    return t('nav.dashboard')
  }

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => {
      // Close all other menus and toggle the current one
      const allClosed = {}
      Object.keys(prev).forEach(key => {
        allClosed[key] = false
      })
      return {
        ...allClosed,
        [menuId]: !prev[menuId]
      }
    })
  }

  const handleGroupItemClick = (subItem, groupId, idx) => {
    if (subItem.hasSubmenu) {
      const menuKey = `${groupId}-${idx}`
      setExpandedMenus(prev => {
        // Close all other menus and toggle the current one
        const allClosed = {}
        Object.keys(prev).forEach(key => {
          allClosed[key] = false
        })
        return {
          ...allClosed,
          [menuKey]: !prev[menuKey]
        }
      })
      // Navigate to default submenu if exists
      if (subItem.defaultSub) {
        navigate(subItem.defaultSub)
      }
    } else {
      navigate(subItem.path)
    }
  }

  const renderMenuItem = (item) => {
    const hasSubItems = item.subItems && item.subItems.length > 0
    const isExpanded = expandedMenus[item.id]
    const isActive = isMenuActive(item)

    if (item.isGroup) {
      return (
        <li key={item.id} className="mt-4">
          {!isSidebarCollapsed && (
            <div className="px-3 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {item.label}
              </span>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="border-t border-gray-200 my-2"></div>
          )}
          <ul className="space-y-1">
            {item.subItems.map((subItem, idx) => {
              const hasNestedSubmenu = subItem.hasSubmenu && subItem.submenuItems
              const isNestedExpanded = expandedMenus[`${item.id}-${idx}`]
              const isSubItemActive = isActivePath(subItem.path) || (subItem.submenuItems && subItem.submenuItems.some(nested => isActivePath(nested.path)))

              return (
                <li key={idx}>
                  <button
                    onClick={() => handleGroupItemClick(subItem, item.id, idx)}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2.5 rounded-lg transition-all text-left ${isSubItemActive
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    title={isSidebarCollapsed ? subItem.label : ''}
                  >
                    <subItem.icon size={20} className="flex-shrink-0" />
                    {!isSidebarCollapsed && (
                      <>
                        <span className="text-sm flex-1">{subItem.label}</span>
                        {hasNestedSubmenu && (
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${isNestedExpanded ? 'rotate-180' : ''}`}
                          />
                        )}
                      </>
                    )}
                  </button>

                  {hasNestedSubmenu && isNestedExpanded && !isSidebarCollapsed && (
                    <ul className="mt-1 ml-9 space-y-1">
                      {subItem.submenuItems.map((nestedItem, nestedIdx) => (
                        <li key={nestedIdx}>
                          <button
                            onClick={() => navigate(nestedItem.path)}
                            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-left text-sm ${isActivePath(nestedItem.path)
                              ? 'bg-blue-50 text-blue-600 font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            <ChevronRight size={14} className="flex-shrink-0" />
                            <span>{nestedItem.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </li>
      )
    }

    return (
      <li key={item.id}>
        <div>
          <button
            onClick={() => {
              if (hasSubItems) {
                toggleMenu(item.id)
                // Navigate to default submenu if exists
                if (item.defaultSub) {
                  navigate(item.defaultSub)
                }
              } else {
                navigate(item.path)
              }
            }}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2.5 rounded-lg transition-all text-left ${isActive
              ? 'bg-blue-50 text-blue-600 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
              }`}
            title={isSidebarCollapsed ? item.label : ''}
          >
            <item.icon size={20} className="flex-shrink-0" />
            {!isSidebarCollapsed && (
              <>
                <span className="text-sm flex-1">{item.label}</span>
                {hasSubItems && (
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                )}
              </>
            )}
          </button>

          {hasSubItems && isExpanded && !isSidebarCollapsed && (
            <ul className="mt-1 ml-9 space-y-1">
              {item.subItems.map((subItem, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => navigate(subItem.path)}
                    className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-left text-sm ${isActivePath(subItem.path)
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    <ChevronRight size={14} className="flex-shrink-0" />
                    <span>{subItem.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="h-screen top-0 w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Title Bar */}
      <WindowControls title={t('appTitle')} />

      {/* Sidebar Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'
            } flex flex-col`}
        >
          {/* Sidebar Header */}
          <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4">
            {!isSidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-gray-400" size={20} />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-800">
                    {currentUser?.username || 'User'}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    {currentUser?.role === 'admin' ? t('common.admin') : t('common.user')}
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-1.5 hover:bg-gray-100 rounded-lg transition-colors ${isSidebarCollapsed ? 'mx-auto' : ''}`}
            >
              <Menu size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-4 px-2">
            <ul className="space-y-1">
              {mainMenuItems.map(item => renderMenuItem(item))}
            </ul>
          </nav>

          {/* Sidebar Footer */}
          <div className="border-t border-gray-200 p-2">
            <button
              onClick={onLogout}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-all`}
              title={isSidebarCollapsed ? t('auth.logout') : ''}
            >
              <LogOut size={20} className="flex-shrink-0" />
              {!isSidebarCollapsed && <span className="text-sm">{t('auth.logout')}</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with Quick Action Icons */}
          <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
            <h1 className="text-lg font-semibold text-gray-800">
              {getCurrentPageTitle()}
            </h1>
            <div className="flex items-center gap-3">
              {/* Primary Action Buttons - New Sale & New Purchase */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/sales/new')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium text-sm group"
                  title={t('common.createNewSale')}
                >
                  <ShoppingBasket size={18} className="group-hover:scale-110 transition-transform" />
                  <span>{t('common.newSale')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 overflow-auto bg-gray-50">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export default Layout