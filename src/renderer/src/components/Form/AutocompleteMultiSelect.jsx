import React, { useState, useRef, useEffect } from 'react';
import { Controller } from 'react-hook-form';

const AutocompleteMultiSelect = ({ 
  name,
  label,
  control,
  rules = {},
  options = [], 
  placeholder = 'Search and select...', 
  className = '',
  inputClassName = '',
  labelClassName = '',
  errorClassName = '',
  disabled,
  maxSelections,
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
        defaultValue={[]}
        render={({ field: { value = [], onChange }, fieldState: { error } }) => (
          <AutocompleteMultiSelectInner
            value={value}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            error={error}
            disabled={disabled}
            inputClassName={inputClassName}
            errorClassName={errorClassName}
            maxSelections={maxSelections}
            name={name}
            {...props}
          />
        )}
      />
    </div>
  );
};

const AutocompleteMultiSelectInner = ({
  value = [],
  onChange,
  options,
  placeholder,
  error,
  disabled,
  inputClassName,
  errorClassName,
  maxSelections,
  name,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

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
    if (isOpen && containerRef.current) {
      // Use setTimeout to ensure dropdown has rendered with content
      const timeoutId = setTimeout(() => {
        if (dropdownRef.current) {
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
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, filteredOptions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle scroll to close dropdown (but not when scrolling inside dropdown)
  useEffect(() => {
    const handleScroll = (e) => {
      if (isOpen) {
        // Don't close if scrolling inside the dropdown itself
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
          return;
        }
        
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen]);

  const handleSelect = (option) => {
    const isSelected = value.includes(option.value);
    
    if (isSelected) {
      // Remove from selection
      onChange(value.filter(v => v !== option.value));
    } else {
      // Add to selection if max not reached
      if (!maxSelections || value.length < maxSelections) {
        onChange([...value, option.value]);
      }
    }
    
    setSearchTerm('');
  };

  const handleRemove = (valueToRemove) => {
    onChange(value.filter(v => v !== valueToRemove));
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleClearAll = () => {
    onChange([]);
    setSearchTerm('');
  };

  const getSelectedOptions = () => {
    return options.filter(opt => value.includes(opt.value));
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

  const selectedOptions = getSelectedOptions();

  return (
    <div>
      {maxSelections && (
        <div className="text-gray-500 text-xs mb-1">
          ({value.length}/{maxSelections})
        </div>
      )}
      
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
        
        {value.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleClearAll}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs font-medium"
          >
            Clear All
          </button>
        )}
        
        {isOpen && !disabled && filteredOptions.length > 0 && (
          <div 
            ref={dropdownRef}
            className="fixed bg-white border border-gray-200 rounded-xl shadow-xl max-h-[280px] overflow-y-auto"
            style={getDropdownStyle()}
          >
            {filteredOptions.map((option) => {
              const isSelected = value.includes(option.value);
              const isDisabled = maxSelections && value.length >= maxSelections && !isSelected;
              
              return (
                <div
                  key={option.value}
                  onClick={() => !isDisabled && handleSelect(option)}
                  className={`px-4 py-3 transition-colors border-b border-gray-100 last:border-b-0 flex items-center justify-between ${
                    isDisabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-blue-50 cursor-pointer'
                  } ${isSelected ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{option.label}</div>
                    {option.description && (
                      <div className="text-sm text-gray-500 mt-1">{option.description}</div>
                    )}
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {isOpen && !disabled && filteredOptions.length === 0 && searchTerm && (
          <div 
            ref={dropdownRef}
            className="fixed bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-center text-gray-500"
            style={getDropdownStyle()}
          >
            No results found
          </div>
        )}
      </div>
      
      {/* Selected items display */}
      {selectedOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <div
              key={option.value}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
            >
              <span>{option.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(option.value)}
                  className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      
      {error && (
        <p className={`mt-1 text-sm text-red-600 ${errorClassName}`}>
          {error.message}
        </p>
      )}
    </div>
  );
};

export default AutocompleteMultiSelect;