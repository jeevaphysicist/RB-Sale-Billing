import React, { useState, useRef, useEffect } from 'react';
import { Controller } from 'react-hook-form';

const AutocompleteSelect = ({ 
  name,
  label,
  control,
  rules = {},
  options = [], 
  placeholder = 'Search...', 
  className = '',
  inputClassName = '',
  labelClassName = '',
  errorClassName = '',
  disabled,
  emptyRender,
  ...props 
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label 
          htmlFor={name}
          className={`block text-sm font-medium text-gray-700 mb-2 ${labelClassName}`}
        >
          {label}
          {rules.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <AutocompleteSelectInner
            value={value}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            error={error}
            disabled={disabled}
            inputClassName={inputClassName}
            errorClassName={errorClassName}
            name={name}
            emptyRender={emptyRender}
            {...props}
          />
        )}
      />
    </div>
  );
};

const AutocompleteSelectInner = ({
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
  inputClassName,
  errorClassName,
  name,
  emptyRender,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Update search term when value changes
  useEffect(() => {
    const selected = options.find(opt => opt.value === value);
    setSearchTerm(selected ? selected.label : '');
  }, [value, options]);

  // Filter options based on search term
  useEffect(() => {
    if (searchTerm === '') {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchTerm, options]);

  // Calculate dropdown position based on available space and actual dropdown height
  useEffect(() => {
    if (isOpen && containerRef.current && dropdownRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current.offsetHeight;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // If not enough space below but more space above, show on top
      if (spaceBelow < dropdownHeight + 8 && spaceAbove > spaceBelow) {
        setDropdownPosition('top');
      } else {
        setDropdownPosition('bottom');
      }
    }
  }, [isOpen, filteredOptions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        // Reset search term if no valid selection
        const selected = options.find(opt => opt.value === value);
        setSearchTerm(selected ? selected.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  // Handle scroll to close dropdown (but not when scrolling inside dropdown)
  useEffect(() => {
    const handleScroll = (e) => {
      if (isOpen) {
        // Don't close if scrolling inside the dropdown itself
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
          return;
        }
        
        setIsOpen(false);
        // Reset search term if no valid selection
        const selected = options.find(opt => opt.value === value);
        setSearchTerm(selected ? selected.label : '');
      }
    };
    
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen, value, options]);

  const handleSelect = (option) => {
    onChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  // Calculate dropdown top position
  const getDropdownStyle = () => {
    if (!containerRef.current) return {};
    
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current?.offsetHeight || 0;
    
    return {
      zIndex: 99999,
      left: rect.left + 'px',
      top: dropdownPosition === 'top' 
        ? (rect.top - dropdownHeight - 8) + 'px'
        : (rect.bottom + 8) + 'px',
      width: rect.width + 'px'
    };
  };

  return (
    <div>
      <div className="relative" ref={containerRef}>
        <input
          type="text"
          id={name}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${inputClassName}`}
          {...props}
        />
        
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        {isOpen && !disabled && filteredOptions.length > 0 && (
          <div 
            ref={dropdownRef}
            className="fixed bg-white border border-gray-200 rounded-xl shadow-xl max-h-[280px] overflow-y-auto"
            style={getDropdownStyle()}
          >
            {filteredOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option)}
                className={`px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                  option.value === value ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium text-gray-900">{option.label}</div>
                {option.description && (
                  <div className="text-sm text-gray-500 mt-1">{option.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {isOpen && !disabled && filteredOptions.length === 0 && searchTerm && (
          <div 
            ref={dropdownRef}
            className="fixed bg-white border border-gray-200 rounded-xl shadow-xl"
            style={getDropdownStyle()}
          >
            {emptyRender ? (
              emptyRender()
            ) : (
              <div className="p-4 text-center text-gray-500">
                No results found
              </div>
            )}
          </div>
        )}
      </div>
      
      {error && (
        <p className={`mt-1 text-sm text-red-600 ${errorClassName}`}>
          {error.message}
        </p>
      )}
    </div>
  );
};

export default AutocompleteSelect;