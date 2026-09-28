import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { X } from 'lucide-react';
import { toast } from 'sonner';

const FormImageUpload = ({ name, control, label, multiple = true, minFiles=2, maxFiles = 4, rules, ...props }) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <ImageUpload
            value={value}
            onChange={onChange}
            multiple={multiple}
            maxFiles={maxFiles}
            minFiles={minFiles}
            error={error}
            {...props}
          />
          {error && (
            <p className="mt-1 text-sm text-danger">
              {error.message}
            </p>
          )}
        </div>
      )}
    />
  );
};

const ImageUpload = ({ value = [], onChange, multiple,minFiles, maxFiles, error }) => {
  const [previews, setPreviews] = useState([]);

  // Use memoized value comparison to avoid infinite effect loops
  const memoizedValue = useMemo(() => {
    const files = Array.isArray(value) ? value : value ? [value] : [];
    return JSON.stringify(
      files.map((item) =>
        item instanceof File ? `${item.name}-${item.size}` : item
      )
    );
  }, [value]);

  useEffect(() => {
    const files = Array.isArray(value) ? value : value ? [value] : [];

    if (files.length === 0) {
      setPreviews([]);
      return;
    }

    const newPreviews = files.map((file, index) => {
      const isFile = file instanceof File;
      return {
        id: `${index}_${Math.random().toString(36).substr(2, 9)}`,
        objectUrl: isFile ? URL.createObjectURL(file) : file,
        file,
        isFile,
      };
    });

    // console.log("newPreviews",newPreviews);

    setPreviews(newPreviews);

    return () => {
      newPreviews.forEach((preview) => {
        if (preview.isFile && preview.objectUrl) {
          URL.revokeObjectURL(preview.objectUrl);
        }
      });
    };
  }, [memoizedValue]);

  const onDrop = useCallback(
    (acceptedFiles) => {
      const current = Array.isArray(value) ? [...value] : value ? [value] : [];
      const remainingSlots = maxFiles - current.length;

      if (remainingSlots <= 0) {
        toast.error(`Maximum ${maxFiles} images allowed.`);
        return;
      }

      if (acceptedFiles.length === 0) {
        toast.error(`You can only select up to ${maxFiles} image${maxFiles > 1 ? 's' : ''}.`);
        return;
      }

      const filesToAdd = acceptedFiles.slice(0, remainingSlots);
      const newList = [...current, ...filesToAdd];

      if (filesToAdd.length === 0) {
        toast.warning(`Only ${remainingSlots} more image${remainingSlots > 1 ? 's' : ''} allowed.`);
        return;
      }

      onChange(newList);
    },
    [value, onChange, maxFiles]
  );

  const removeImage = (indexToRemove) => {
    const current = Array.isArray(value) ? [...value] : value ? [value] : [];
    current.splice(indexToRemove, 1);
    onChange(current);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
    },
    multiple: true,
    maxFiles,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'}
          ${error ? 'border-danger' : ''}
        `}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-gray-600">
          {isDragActive
            ? "Drop the files here..."
            : `Drag 'n' drop images here, or click to select`}
        </p>
        <p className="text-xs text-gray-500 mt-1">
            min {minFiles}, max {maxFiles} images allowed
        </p>
      </div>

      {previews.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4">
          {previews.map((preview, index) => (
            <div key={preview.id} className="relative border border-gray-300 rounded-[10px]">
              <div className="w-[100px]  aspect-square overflow-hidden">
                <div className="p-0">
                  <img
                    src={preview.objectUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 bg-white bg-opacity-80 hover:bg-red-500 hover:text-white text-red-500 p-1 rounded-full transition"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormImageUpload;
