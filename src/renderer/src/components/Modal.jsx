import React, { useState } from 'react';
import { X, Plus, Edit3, Tag, Package, Layers, Loader2 } from 'lucide-react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  isSubmitting,
  onSubmit,
  submitText = "Save",
  width = "800px",
  disableBackdropClose = false,
  footer
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
      />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full my-5 flex flex-col transform animate-in zoom-in-95 duration-200"
        style={{ maxWidth: width, maxHeight: 'calc(100vh - 40px)' }}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>

        {footer ? (
          <div className="p-6 border-t border-gray-100 flex-shrink-0">
            {footer}
          </div>
        ) : onSubmit && (
          <div className="flex gap-3 p-6 border-t border-gray-100 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={onSubmit}
              className="flex-1 px-4 py-3 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Saving...
                </span>
              ) : submitText}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Modal;