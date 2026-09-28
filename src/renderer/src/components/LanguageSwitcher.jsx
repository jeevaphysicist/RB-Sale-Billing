import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';

const LanguageSwitcher = () => {
  const { currentLanguage, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
    setIsOpen(false);
  };

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ta', label: 'தமிழ்' }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors hover:bg-slate-600/50 text-slate-200"
        title="Change Language"
      >
        <Globe size={12} />
        <span>{currentLanguage === 'en' ? 'EN' : 'TA'}</span>
        <ChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                currentLanguage === lang.code ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-700'
              }`}
            >
              <span>{lang.label}</span>
              {currentLanguage === lang.code && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
