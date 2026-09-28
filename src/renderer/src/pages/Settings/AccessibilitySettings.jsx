import React from 'react';
import { useTranslation } from 'react-i18next';
import { Type, RotateCcw } from 'lucide-react';
import { useAccessibility, FONT_SCALE_PRESETS } from '../../contexts/AccessibilityContext';
import FontSizeControls from '../../components/FontSizeControls';

const AccessibilitySettings = () => {
  const { t } = useTranslation();
  const { fontScalePercent, setPreset, getActivePresetId, resetFontScale } = useAccessibility();
  const activePreset = getActivePresetId();

  const presetLabels = {
    compact: t('accessibility.presets.compact'),
    normal: t('accessibility.presets.normal'),
    large: t('accessibility.presets.large'),
    xlarge: t('accessibility.presets.xlarge'),
    maximum: t('accessibility.presets.maximum')
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Type size={22} className="text-blue-600" />
          {t('accessibility.title')}
        </h2>
        <p className="text-gray-500 text-sm mt-1">{t('accessibility.subtitle')}</p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Live preview */}
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-6">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-3">
            {t('accessibility.previewLabel')}
          </p>
          <p className="text-lg font-semibold text-gray-900 mb-1">
            {t('accessibility.previewTitle')}
          </p>
          <p className="text-base text-gray-700 mb-2">{t('accessibility.previewBody')}</p>
          <p className="text-sm text-gray-600">
            {t('accessibility.previewSmall')} — {fontScalePercent}%
          </p>
        </div>

        {/* Step controls */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('accessibility.adjustStep')}
          </label>
          <FontSizeControls variant="default" showReset showPercent className="gap-2" />
        </div>

        {/* Presets */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('accessibility.presetsLabel')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FONT_SCALE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPreset(preset.id)}
                className={`px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  activePreset === preset.id
                    ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <span className="block text-sm font-medium">{presetLabels[preset.id]}</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {Math.round(preset.scale * 100)}%
                </span>
              </button>
            ))}
          </div>
          {activePreset === 'custom' && (
            <p className="text-xs text-gray-500 mt-2">{t('accessibility.customScale', { percent: fontScalePercent })}</p>
          )}
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={resetFontScale}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RotateCcw size={16} />
          {t('accessibility.resetToDefault')}
        </button>

        <p className="text-xs text-gray-500 border-t border-gray-200 pt-4">
          {t('accessibility.hint')}
        </p>
      </div>
    </div>
  );
};

export default AccessibilitySettings;
