import React from 'react';
import { Controller } from 'react-hook-form';

const Checkbox = ({
  name,
  label,
  control,
  rules = {},
  className = '',
  labelClassName = '',
  errorClassName = '',
  disabled = false,
  ...props
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field: { value, onChange, ...field }, fieldState: { error } }) => (
          <div>
            <label 
              htmlFor={name}
              className={`flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                {...field}
                type="checkbox"
                id={name}
                checked={!!value}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className={`w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 ${
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                {...props}
              />
              <span className={`ml-2 text-sm font-medium text-gray-700 ${labelClassName}`}>
                {label}
                {rules.required && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
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

export default Checkbox;
