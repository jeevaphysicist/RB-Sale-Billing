import React from 'react';
import { useForm } from 'react-hook-form';

const Form = ({
  children,
  onSubmit,
  defaultValues = {},
  className = '',
  mode = 'onChange',
  ...props
}) => {
  const methods = useForm({
    defaultValues,
    mode,
  });

  const handleSubmit = (data) => {
    if (onSubmit) {
      onSubmit(data, methods);
    }
  };

  return (
    <form 
      onSubmit={methods.handleSubmit(handleSubmit)}
      className={`space-y-4 ${className}`}
      {...props}
    >
      {typeof children === 'function' ? children(methods) : children}
    </form>
  );
};

export default Form;
