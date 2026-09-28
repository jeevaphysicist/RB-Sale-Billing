import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

const GlobalJobContext = createContext();

export const useGlobalJob = () => useContext(GlobalJobContext);

export const GlobalJobProvider = ({ children }) => {
  // Restore from localStorage if available
  const [lastBarcodePdf, setLastBarcodePdf] = useState(() => {
    try {
      const saved = localStorage.getItem('recent_barcode_pdf');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Defensive check for window.api
    if (!window.api || !window.api.on) {
      console.warn('window.api.on is missing in GlobalJobProvider');
      return;
    }

    // Listen for generation complete event
    const removeListener = window.api.on('barcode:job-completed', (data) => {
      console.log('Global Job: Barcode PDF Ready', data);
      setIsGenerating(false);

      const pdfInfo = {
        filePath: data.filePath,
        height: data.height,
        generatedAt: new Date().toISOString(),
        productCount: data.productCount || 0
      };

      setLastBarcodePdf(pdfInfo);
      localStorage.setItem('recent_barcode_pdf', JSON.stringify(pdfInfo));

      toast.success('Barcode PDF Generation Complete!', {
        description: 'You can preview and print it from the Barcode Generator page.',
        duration: 5000,
        action: {
          label: 'Go',
          onClick: () => window.location.hash = '#/barcode-generator' // Assuming hash router or similar, but toast navigation might be tricky outside router context. 
        }
      });
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  const clearLastBarcodePdf = () => {
    setLastBarcodePdf(null);
    localStorage.removeItem('recent_barcode_pdf');
  };

  const startBarcodeGeneration = async (payload) => {
    setIsGenerating(true);
    try {
      const response = await window.api.invoke('barcode:start-generation', payload);
      if (response.success) {
        toast.info('Generation started in background', {
          description: 'You can continue working. We will notify you when it is ready.'
        });
      } else {
        setIsGenerating(false);
        toast.error(response.message || 'Failed to start generation');
      }
      return response;
    } catch (error) {
      setIsGenerating(false);
      console.error("Start generation error", error);
      toast.error("Failed to initiate generation");
      return { success: false, message: error.message };
    }
  };

  const value = {
    lastBarcodePdf,
    clearLastBarcodePdf,
    isGenerating,
    startBarcodeGeneration
  };

  return (
    <GlobalJobContext.Provider value={value}>
      {children}
    </GlobalJobContext.Provider>
  );
};
