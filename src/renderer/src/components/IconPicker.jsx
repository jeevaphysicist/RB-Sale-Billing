import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search, ChevronDown } from 'lucide-react';

const COMMON_ICONS = [
    'Utensils', 'Pizza', 'Coffee', 'Cake', 'IceCream', 'Beer', 'Wine', 'Sandwich',
    'Cookie', 'Apple', 'Banana', 'Cherry', 'Grape', 'Strawberry', 'ShoppingBag',
    'Store', 'Package', 'Tag', 'Star', 'Heart', 'Smile', 'Sun', 'Moon', 'Cloud',
    'Home', 'Settings', 'User', 'Mail', 'Phone', 'Camera', 'Music', 'Video',
    'Gift', 'Truck', 'Zap', 'Flame', 'Leaf', 'Droplets', 'Thermometer', 'Umbrella'
];

const IconPicker = ({ value, onChange, label, error }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Use CircleHelp as primary fallback, then HelpCircle, then Info
    const FallbackIcon = LucideIcons.CircleHelp || LucideIcons.HelpCircle || LucideIcons.Info;
    const SelectedIcon = value && LucideIcons[value] ? LucideIcons[value] : FallbackIcon;

    const filteredIcons = COMMON_ICONS.filter(iconName => {
        const nameMatch = iconName.toLowerCase().includes(searchTerm.toLowerCase());
        const exists = !!LucideIcons[iconName];
        return nameMatch && exists;
    });

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && (
                <label className="text-sm font-semibold text-gray-700">
                    {label}
                </label>
            )}

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`group flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-xl transition-all duration-200 hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 ${error ? 'border-red-500' : 'border-gray-200'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${value ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                            <SelectedIcon size={20} strokeWidth={2.5} />
                        </div>
                        <span className={`text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                            {value || 'Select an icon...'}
                        </span>
                    </div>
                    <ChevronDown
                        size={18}
                        className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search icons..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-100"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {filteredIcons.map((iconName) => {
                                const Icon = LucideIcons[iconName];
                                const isSelected = value === iconName;

                                return (
                                    <button
                                        key={iconName}
                                        type="button"
                                        onClick={() => {
                                            onChange(iconName);
                                            setIsOpen(false);
                                        }}
                                        title={iconName}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 group ${isSelected
                                            ? 'bg-orange-50 text-orange-600 ring-2 ring-orange-200'
                                            : 'hover:bg-gray-50 text-gray-500 hover:text-orange-500'
                                            }`}
                                    >
                                        <Icon size={24} strokeWidth={isSelected ? 3 : 2} />
                                    </button>
                                );
                            })}
                        </div>

                        {filteredIcons.length === 0 && (
                            <div className="py-8 text-center text-gray-400 text-sm">
                                No icons found for "{searchTerm}"
                            </div>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <span className="text-xs font-medium text-red-500 mt-1 ml-1 capitalize">
                    {error}
                </span>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default IconPicker;
