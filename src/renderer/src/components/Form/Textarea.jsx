import React from 'react';
import { Controller } from 'react-hook-form';

const Textarea = ({
  name,
  label,
  control,
  rules = {},
  placeholder = '',
  rows = 4,
  className = '',
  textareaClassName = '',
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
            <textarea
              {...field}
              id={name}
              rows={rows}
              placeholder={placeholder}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                error ? 'border-red-500' : 'border-gray-300'
              } ${textareaClassName}`}
              {...props}
            />
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

export default Textarea;
