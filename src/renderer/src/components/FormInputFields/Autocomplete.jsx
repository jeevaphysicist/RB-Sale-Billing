import React, { useState } from "react";

const Autocomplete = ({ value, onChange, options, placeholder, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const selected = options.find(opt => opt.value === value);
    setSearchTerm(selected ? selected.label : '');
  }, [value, options]);

  React.useEffect(() => {
    if (searchTerm === '') {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchTerm, options]);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
        {...props}
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-[280px] overflow-y-auto">
          {filteredOptions.map((option) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option)}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{option.label}</div>
              {option.description && (
                <div className="text-sm text-gray-500 mt-1">{option.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {isOpen && filteredOptions.length === 0 && searchTerm && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-center text-gray-500">
          No results found
        </div>
      )}
    </div>
  );
};

export default Autocomplete;