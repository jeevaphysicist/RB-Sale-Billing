import React, { useEffect, useRef } from 'react';
import { motion } from "framer-motion";
import { AlertTriangle, X } from 'lucide-react';

const AlertModal = ({
  isVisible,
  message,
  modeltitle,
  onConfirm,
  onCancel,
  loading,
  buttonText
}) => {
  const previouslyFocusedElement = useRef(null);
  const cancelButtonRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isVisible) {
      // Store the previously focused element
      previouslyFocusedElement.current = document.activeElement;
      
      // Focus the cancel button when modal opens
      setTimeout(() => {
        if (cancelButtonRef.current) {
          cancelButtonRef.current.focus();
        }
      }, 100);
      
      // Add keyboard event listener
      const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
          onCancel();
        } else if (event.key === 'Tab') {
          // Handle tab navigation between buttons
          event.preventDefault();
          if (document.activeElement === cancelButtonRef.current) {
            confirmButtonRef.current?.focus();
          } else {
            cancelButtonRef.current?.focus();
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      // Restore focus to previously focused element when modal closes
      if (previouslyFocusedElement.current) {
        setTimeout(() => {
          previouslyFocusedElement.current?.focus();
        }, 100);
      }
    }
  }, [isVisible, onCancel]);

  const handleCancel = () => {
    onCancel();
  };

  const handleConfirm = () => {
    onConfirm();
  };

  if (!isVisible) return null;

  return (
    <div 
      ref={modalRef}
      className="fixed z-50 top-[30%] rounded-[10px] inset-0 flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-title"
      aria-describedby="alert-description"
    >
      <motion.div
        className="fixed inset-0 bg-neutral-700/50"
        onClick={handleCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      ></motion.div>
      <motion.div
        className="rounded-[10px] w-[100%] md:w-[450px] z-10"
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.75 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-[90%] relative mt-10 rounded-[20px] bg-white flex flex-col justify-center items-center">
          <div className="mb-4 mt-6">
            <div className="bg-red-600/10 rounded-full p-1.5">
              <div className="bg-red-600/20 rounded-full p-2">
                <AlertTriangle className="text-red-600 text-2xl font-bold" />
              </div>
            </div>
          </div>
          <div id="alert-title" className="font-semibold text-xl py-1">{modeltitle}</div>
          <div id="alert-description" className="text-sm font-semibold text-black/70 mb-10">
            <p className="text-center">{message}</p>
            {buttonText === 'Delete' && <p className="text-center">This action cannot be undone.</p>
            }
          </div>
          <div className="w-[90%] flex justify-center gap-2 mb-6">
            <button
              ref={cancelButtonRef}
              onClick={handleCancel}
              className="w-[40%] bg-slate-200 hover:bg-slate-300 text-black p-2 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 flex items-center justify-center"
              type="button"
              disabled={loading}
            >
              <X size={18} className="mr-1" />
              No
            </button>
            <button
              ref={confirmButtonRef}
              onClick={handleConfirm}
              className={`w-[40%] ${buttonText === 'Logout' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-500 hover:bg-red-600'} text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-1 ${buttonText === 'Logout' ? 'focus:ring-orange-400' : 'focus:ring-red-400'} flex items-center justify-center`}
              type="button"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <AlertTriangle size={18} className="mr-1" />
              )}
              {buttonText || 'Delete'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AlertModal;