import React from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../contexts/AccessibilityContext';

const FontSizeControls = ({ variant = 'compact', className = '', showReset = false, showPercent = true }) => {
  const { t } = useTranslation();
  const {
    fontScalePercent,
    increaseFontScale,
    decreaseFontScale,
    resetFontScale,
    canIncrease,
    canDecrease
  } = useAccessibility();

  const isCompact = variant === 'compact';

  const btnClass = isCompact
    ? 'min-w-[28px] h-7 px-1.5 text-xs font-bold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
    : 'min-w-[40px] h-10 px-3 text-sm font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const compactBtn = isCompact
    ? `${btnClass} bg-slate-600/50 hover:bg-slate-500 text-white`
    : `${btnClass} border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-800`;

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      style={{ WebkitAppRegion: 'no-drag' }}
      role="group"
      aria-label={t('accessibility.fontSizeControls')}
    >
      {showPercent && (
        <span
          className={
            isCompact
              ? 'text-xs font-medium text-slate-200 min-w-[2.5rem] text-center'
              : 'text-sm font-semibold text-gray-700 min-w-[3rem] text-center'
          }
        >
          {fontScalePercent}%
        </span>
      )}
      <button
        type="button"
        onClick={decreaseFontScale}
        disabled={!canDecrease}
        className={compactBtn}
        title={t('accessibility.decreaseFont')}
        aria-label={t('accessibility.decreaseFont')}
      >
        <Minus size={isCompact ? 14 : 18} />
      </button>
      <button
        type="button"
        onClick={increaseFontScale}
        disabled={!canIncrease}
        className={compactBtn}
        title={t('accessibility.increaseFont')}
        aria-label={t('accessibility.increaseFont')}
      >
        <Plus size={isCompact ? 14 : 18} />
      </button>
      {showReset && (
        <button
          type="button"
          onClick={resetFontScale}
          className={
            isCompact
              ? `${btnClass} bg-slate-600/50 hover:bg-slate-500 text-white`
              : `${btnClass} border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-600`
          }
          title={t('accessibility.resetFont')}
          aria-label={t('accessibility.resetFont')}
        >
          <RotateCcw size={isCompact ? 14 : 16} />
        </button>
      )}
    </div>
  );
};

export default FontSizeControls;
