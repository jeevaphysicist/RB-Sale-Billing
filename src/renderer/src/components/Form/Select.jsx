import React from 'react';
import { Controller } from 'react-hook-form';

const Select = ({
  name,
  label,
  control,
  options = [],
  rules = {},
  placeholder = 'Select an option',
  className = '',
  selectClassName = '',
  labelClassName = '',
  errorClassName = '',
  ...props
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label 
          htmlFor={name}
          className={`block text-sm font-medium text-gray-700 mb-1 ${labelClassName}`}
        >
          {label}
          {rules.required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState: { error } }) => (
          <div>
            <select
              {...field}
              id={name}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                error ? 'border-red-500' : 'border-gray-300'
              } ${selectClassName}`}
              {...props}
            >
              <option value="">{placeholder}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error && (
              <p className={`mt-1 text-sm text-red-600 ${errorClassName}`}>
                {error.message}
              </p>
            )}
          </div>
        )}
      />
    </div>
  );
};

export default Select;
