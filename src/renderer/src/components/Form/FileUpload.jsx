import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Controller } from 'react-hook-form';
import { UploadCloud, X, File as FileIcon } from 'lucide-react';
import { toast } from 'sonner';

const FileUpload = ({
  name,
  control,
  label,
  rules = {},
  multiple = false,
  accept = 'image/*',
  maxFiles = 1,
  minFiles = 0,
  maxSize = 2 * 1024 * 1024, // 2MB
  previews = true,
  className = '',
  ...props
}) => {
  const [previewsState, setPreviewsState] = useState([]);

  const render = ({ field, fieldState: { error } }) => {
    const onDrop = useCallback(
      (acceptedFiles, rejectedFiles) => {
        if (rejectedFiles.length > 0) {
          rejectedFiles.forEach(({ file, errors }) => {
            errors.forEach((err) => {
              if (err.code === 'file-too-large') {
                toast.error(`File is too large: ${file.name}`);
              } else if (err.code === 'file-invalid-type') {
                toast.error(`Invalid file type: ${file.name}`);
              } else {
                toast.error(err.message);
              }
            });
          });
          return;
        }

        const newFiles = multiple ? [...(field.value || []), ...acceptedFiles] : acceptedFiles;

        if (multiple && newFiles.length > maxFiles) {
          toast.error(`You can only upload a maximum of ${maxFiles} files.`);
          return;
        }

        field.onChange(newFiles);
      },
      [field, multiple, maxFiles]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      multiple,
      accept,
      maxSize,
      minFiles,
    });

    useEffect(() => {
      const files = Array.isArray(field.value) ? field.value : (field.value ? [field.value] : []);
      const previewUrls = files.map((file) => (
        typeof file === 'string' ? file : URL.createObjectURL(file)
      ));
      setPreviewsState(previewUrls);

      return () => {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
      };
    }, [field.value]);

    const handleRemove = (index) => {
      if (multiple) {
        const updatedFiles = [...field.value];
        updatedFiles.splice(index, 1);
        field.onChange(updatedFiles);
      } else {
        field.onChange(null);
      }
    };

    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {rules.required && <span className="text-red-500"> *</span>}
          </label>
        )}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center">
            <UploadCloud className="w-12 h-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive ? 'Drop files here...' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-gray-500">{accept.replace('image/*', 'Images')} up to {maxSize / 1024 / 1024}MB</p>
          </div>
        </div>

        {previews && previewsState.length > 0 && (
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {previewsState.map((preview, index) => (
              <div key={index} className="relative group">
                <div className="aspect-w-1 aspect-h-1">
                  {preview.startsWith('blob:') ? (
                    <img src={preview} alt={`Preview ${index}`} className="object-cover rounded-lg" />
                  ) : (
                    <div className="bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
      </div>
    );
  };

  return <Controller name={name} control={control} rules={rules} render={render} {...props} />;
};

export default FileUpload;
