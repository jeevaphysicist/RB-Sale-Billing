import React from 'react';
import { useForm } from 'react-hook-form';

const Form = ({
  children,
  onSubmit,
  defaultValues = {},
  className = '',
  ...props
}) => {
  const methods = useForm({
    defaultValues,
    mode: 'onChange',
  });

  const handleSubmit = (data) => {
    console.log('Form Data:', data);
    if (onSubmit) onSubmit(data);
  };

  return (
    <form 
      onSubmit={methods.handleSubmit(handleSubmit)}
      className={`space-y-6 ${className}`}
      {...props}
    >
      {children(methods)}
    </form>
  );
};

export default Form;
