import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'appFontScale';

export const FONT_SCALE_PRESETS = [
  { id: 'compact', scale: 0.9 },
  { id: 'normal', scale: 1 },
  { id: 'large', scale: 1.15 },
  { id: 'xlarge', scale: 1.3 },
  { id: 'maximum', scale: 1.5 }
];

const MIN_SCALE = 0.9;
const MAX_SCALE = 1.5;
const SCALE_STEP = 0.05;
const BASE_FONT_PX = 16;

const getMaxScaleForScreen = () => {
  if (typeof window === 'undefined') return MAX_SCALE;
  return window.innerWidth < 1280 ? 1.3 : MAX_SCALE;
};

const clampScale = (value) => {
  const max = getMaxScaleForScreen();
  return Math.min(max, Math.max(MIN_SCALE, Math.round(value * 100) / 100));
};

export const loadStoredFontScale = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!Number.isNaN(parsed)) return clampScale(parsed);
    }
  } catch (error) {
    console.error('Error loading font scale:', error);
  }
  return 1;
};

export const applyFontScaleToDocument = (scale) => {
  const clamped = clampScale(scale);
  document.documentElement.style.setProperty('--font-scale', String(clamped));
  document.documentElement.style.fontSize = `${BASE_FONT_PX * clamped}px`;
  return clamped;
};

const AccessibilityContext = createContext();

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

export const AccessibilityProvider = ({ children }) => {
  const [fontScale, setFontScaleState] = useState(() => loadStoredFontScale());

  const setFontScale = useCallback((scale) => {
    const clamped = applyFontScaleToDocument(scale);
    setFontScaleState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch (error) {
      console.error('Error saving font scale:', error);
    }
    return clamped;
  }, []);

  const increaseFontScale = useCallback(() => {
    return setFontScale(fontScale + SCALE_STEP);
  }, [fontScale, setFontScale]);

  const decreaseFontScale = useCallback(() => {
    return setFontScale(fontScale - SCALE_STEP);
  }, [fontScale, setFontScale]);

  const resetFontScale = useCallback(() => setFontScale(1), [setFontScale]);

  const setPreset = useCallback(
    (presetId) => {
      const preset = FONT_SCALE_PRESETS.find((p) => p.id === presetId);
      if (preset) return setFontScale(preset.scale);
      return fontScale;
    },
    [fontScale, setFontScale]
  );

  const getActivePresetId = useCallback(() => {
    const match = FONT_SCALE_PRESETS.find((p) => Math.abs(p.scale - fontScale) < 0.001);
    return match?.id || 'custom';
  }, [fontScale]);

  const fontScalePercent = Math.round(fontScale * 100);

  useEffect(() => {
    applyFontScaleToDocument(fontScale);
  }, [fontScale]);

  useEffect(() => {
    const handleResize = () => {
      setFontScaleState((current) => applyFontScaleToDocument(current));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const value = {
    fontScale,
    fontScalePercent,
    setFontScale,
    increaseFontScale,
    decreaseFontScale,
    resetFontScale,
    setPreset,
    getActivePresetId,
    canIncrease: fontScale < getMaxScaleForScreen() - 0.001,
    canDecrease: fontScale > MIN_SCALE + 0.001,
    minScale: MIN_SCALE,
    maxScale: getMaxScaleForScreen()
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};
