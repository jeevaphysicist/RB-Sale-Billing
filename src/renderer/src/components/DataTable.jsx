import React, { useState, useEffect } from 'react'
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Download,
  Loader2
} from 'lucide-react'

const DataTable = ({
  data = [],
  columns = [],
  actions = [],
  onRowClick,
  searchable = true,
  sortable = true,
  pagination = true,
  totalRecords = 0,
  loading = false,
  onFilterChange,
  initialFilters = {
    search: '',
    sortBy: null,
    sortOrder: null,
    page: 1,
    limit: 10
  },
  customRowClass,
  emptyMessage = 'No data available'
}) => {
  const [filters, setFilters] = useState(initialFilters)
  const [openActionMenu, setOpenActionMenu] = useState(null)
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 })
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search)
    }, 500)

    return () => clearTimeout(timer)
  }, [filters.search])

  // Initial load - call API on mount
  useEffect(() => {
    if (isInitialLoad && onFilterChange) {
      onFilterChange({
        search: initialFilters.search,
        sortBy: initialFilters.sortBy,
        sortOrder: initialFilters.sortOrder,
        page: initialFilters.page,
        limit: initialFilters.limit
      })
      setIsInitialLoad(false)
    }
  }, [])

  // Send filters to parent only when filters actually change (not on initial render)
  useEffect(() => {
    if (!isInitialLoad && onFilterChange) {
      onFilterChange({
        search: debouncedSearch,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        limit: filters.limit
      })
    }
  }, [debouncedSearch, filters.sortBy, filters.sortOrder, filters.page, filters.limit])

  // Calculate pagination
  const totalPages = Math.ceil(totalRecords / filters.limit)

  // Handle sort
  const handleSort = (key) => {
    if (!sortable) return

    setFilters(prev => {
      let sortOrder = 'asc'
      if (prev.sortBy === key) {
        if (prev.sortOrder === 'asc') sortOrder = 'desc'
        else if (prev.sortOrder === 'desc') {
          return { ...prev, sortBy: null, sortOrder: null, page: 1 }
        }
      }
      return { ...prev, sortBy: key, sortOrder, page: 1 }
    })
  }

  // Get sort icon
  const getSortIcon = (key) => {
    if (!sortable || filters.sortBy !== key) return <ArrowUpDown size={14} className="text-gray-400" />
    if (filters.sortOrder === 'asc') return <ArrowUp size={14} className="text-blue-600" />
    if (filters.sortOrder === 'desc') return <ArrowDown size={14} className="text-blue-600" />
    return <ArrowUpDown size={14} className="text-gray-400" />
  }

  // Handle action click
  const handleActionClick = (action, row, e) => {
    e.stopPropagation()
    setOpenActionMenu(null)
    if (action.onClick) {
      action.onClick(row)
    }
  }

  // Toggle action menu
  const toggleActionMenu = (index, e) => {
    e.stopPropagation()
    
    if (openActionMenu === index) {
      setOpenActionMenu(null)
    } else {
      const button = e.currentTarget
      const rect = button.getBoundingClientRect()
      
      // Calculate position for the menu
      const menuWidth = 192 // w-48 = 12rem = 192px
      const menuHeight = actions.length * 40 // Approximate height per action
      
      let top = rect.bottom + 8 // 8px gap below button
      let left = rect.right - menuWidth // Align right edge with button
      
      // Adjust if menu goes off screen
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      
      if (top + menuHeight > viewportHeight) {
        top = rect.top - menuHeight - 8 // Show above if no space below
      }
      
      if (left < 8) {
        left = 8 // Minimum 8px from left edge
      }
      
      if (left + menuWidth > viewportWidth - 8) {
        left = viewportWidth - menuWidth - 8 // Stay 8px from right edge
      }
      
      setActionMenuPosition({ top, left })
      setOpenActionMenu(index)
    }
  }

  // Render cell content
  const renderCell = (row, column) => {
    if (column.render) {
      return column.render(row[column.key], row)
    }
    return row[column.key]
  }

  // Handle search change
  const handleSearchChange = (value) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }))
  }

  // Handle page change
  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }))
  }

  // Handle limit change
  const handleLimitChange = (limit) => {
    setFilters(prev => ({ ...prev, limit: parseInt(limit), page: 1 }))
  }

  const startIndex = (filters.page - 1) * filters.limit
  const endIndex = Math.min(startIndex + filters.limit, totalRecords)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Search Bar and Items Per Page */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
        {searchable && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
        
        {pagination && (
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">Rows per page:</label>
            <select
              value={filters.limit}
              onChange={(e) => handleLimitChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto relative">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                    sortable && column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                  style={{ width: column.width }}
                >
                  <div className="flex items-center space-x-2">
                    <span>{column.label}</span>
                    {sortable && column.sortable !== false && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider sticky right-0 bg-gray-50">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                  className="px-6 py-12 text-center"
                >
                  <div className="flex items-center justify-center space-x-2 text-gray-500">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-gray-50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${customRowClass ? customRowClass(row) : ''}`}
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}
                  {actions && actions.length > 0 && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-white">
                      <button
                        onClick={(e) => toggleActionMenu(rowIndex, e)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors inline-block"
                      >
                        <MoreVertical size={18} className="text-gray-600" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Action Menu Overlay - Outside table */}
        {openActionMenu !== null && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation()
                setOpenActionMenu(null)
              }}
            />
            <div 
              className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-48"
              style={{
                top: `${actionMenuPosition.top}px`,
                left: `${actionMenuPosition.left}px`
              }}
            >
              {actions.map((action, actionIndex) => {
                const ActionIcon = action.icon
                return (
                  <button
                    key={actionIndex}
                    onClick={(e) => handleActionClick(action, data[openActionMenu], e)}
                    className={`w-full flex items-center space-x-2 px-4 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      action.className || 'text-gray-700'
                    }`}
                  >
                    {ActionIcon && <ActionIcon size={16} />}
                    <span>{action.label}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination && totalRecords > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {endIndex} of {totalRecords} entries
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={filters.page === 1 || loading}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsLeft size={18} />
            </button>
            <button
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page === 1 || loading}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (filters.page <= 3) {
                  pageNum = i + 1
                } else if (filters.page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = filters.page - 2 + i
                }
                return (
                  <button
                    key={i}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={loading}
                    className={`px-3 py-1 rounded ${
                      filters.page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    } disabled:cursor-not-allowed`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page === totalPages || loading}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={filters.page === totalPages || loading}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


export default DataTable;