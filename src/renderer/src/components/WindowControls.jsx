import React, { useState, useEffect } from 'react'
import { Minimize2, Square, X,Truck, UserPlus,PcCase,ChartColumnBig, LayoutDashboard, ShoppingCart, ShoppingBag, Package, FolderTree, Tag, FileText, Settings } from 'lucide-react'
import LanguageSwitcher from './LanguageSwitcher'
import FontSizeControls from './FontSizeControls'
import icon from '../assets/icon.png'
import { useNavigate, useLocation } from 'react-router-dom'

const WindowControls = ({ title = 'Application', showIcon = true, showTitle = true, showNav = true, showFontControls = true, className = '' }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMaximized, setIsMaximized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const isElectron = typeof window !== 'undefined' && window.api

  useEffect(() => {
    if (isElectron) {
      window.api.isMaximized().then(setIsMaximized)
      window.api.isFullscreen().then(setIsFullscreen)

      const handleMaximized = () => setIsMaximized(true)
      const handleUnmaximized = () => setIsMaximized(false)
      const handleFullscreen = () => setIsFullscreen(true)
      const handleUnfullscreen = () => setIsFullscreen(false)

      window.api.onWindowMaximized(handleMaximized)
      window.api.onWindowUnmaximized(handleUnmaximized)
      window.api.onWindowFullscreen(handleFullscreen)
      window.api.onWindowUnfullscreen(handleUnfullscreen)
    }
  }, [isElectron])

  const handleMinimize = () => {
    if (isElectron) window.api.minimize()
  }

  const handleMaximize = () => {
    if (isElectron) window.api.maximize()
  }

  const handleClose = () => {
    if (isElectron) window.api.close()
  }

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Sales', icon: ShoppingCart, path: '/sales' },
    { name: 'Purchase', icon: ShoppingBag, path: '/purchases' },
    { name: 'Products', icon: PcCase, path: '/products' },
    { name: 'Customers', icon: UserPlus, path: '/customers' },
    { name: 'Vendors', icon: Truck, path: '/suppliers' },
    { name: 'Reports', icon: ChartColumnBig, path: '/reports' },
    { name: 'Settings', icon: Settings, path: '/settings' }
  ]

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <div
      className={`flex items-center justify-between h-8 select-none flex-shrink-0 ${className || 'bg-gradient-to-r from-slate-800 to-slate-700 text-white'}`}
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left Section - Icon & Title */}
      <div className="flex items-center gap-2 px-3">
        {showIcon && (
          <img src={icon} alt="App Icon" className="w-4 h-4 ring-2 ring-amber-50 rounded-xl" />
        )}
        {showTitle && (
          <span className="text-sm font-semibold">{title}</span>
        )}
      </div>

      {/* Center Section - Navigation / accessibility */}
      {(showNav || showFontControls) && (
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          {showNav && menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                  active 
                    ? 'bg-slate-600 text-white' 
                    : 'hover:bg-slate-600/50 text-slate-200'
                }`}
                title={item.name}
              >
                <Icon size={12} />
                <span>{item.name}</span>
              </button>
            )
          })}

          <div className={`flex items-center gap-1 ${showNav ? 'ml-1 pl-1 border-l border-slate-600/50' : ''}`}>
            {showFontControls && <FontSizeControls variant="compact" />}
            <LanguageSwitcher />
          </div>
        </div>
      )}

      {/* Right Section - Window Controls */}
      
        <div className="flex items-center space-x-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={handleMinimize}
            className="w-8 h-6 hover:bg-slate-600 rounded flex items-center justify-center transition-colors"
            aria-label="Minimize"
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-6 hover:bg-slate-600 rounded flex items-center justify-center transition-colors"
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            <Square size={14} />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-6 hover:bg-red-600 rounded flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      
    </div>
  )
}

export default WindowControls
