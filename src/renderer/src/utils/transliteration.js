/**
 * Tamil Transliteration Utility
 * Converts English keyboard input to Tamil script
 * Uses Sanscript library for accurate transliteration
 */

import Sanscript from 'sanscript';

/**
 * Transliterate English text to Tamil using ITRANS scheme
 * @param {string} englishText - Text typed in English
 * @returns {string} Tamil transliterated text
 */
export const transliterateToTamil = (englishText) => {
  if (!englishText || typeof englishText !== 'string') {
    return '';
  }

  try {
    // Use ITRANS scheme (most intuitive for Tamil)
    // Example: "vanakkam" → "வணக்கம்", "arisi" → "அரிசி"
    return Sanscript.t(englishText, 'itrans', 'tamil');
  } catch (error) {
    console.error('Transliteration error:', error);
    return englishText; // Return original if transliteration fails
  }
};

/**
 * Create multiple search terms for better product matching
 * Returns both original input, Tamil transliteration, and variants
 * @param {string} input - User search input
 * @returns {Array<string>} Array of search terms
 */
export const createSearchTerms = (input) => {
  if (!input || input.trim() === '') {
    return [];
  }

  const terms = [
    input.trim(), // Original input (for English products or direct Tamil)
  ];

  // Add transliterated version if input contains latin characters
  const hasLatinChars = /[a-zA-Z]/.test(input);
  if (hasLatinChars) {
    const trimmedInput = input.trim();
    const lowerInput = trimmedInput.toLowerCase();
    
    // CRITICAL FIX: Handle multi-word inputs (e.g., "ponni arisi")
    // Check if input contains spaces (multiple words)
    if (trimmedInput.includes(' ')) {
      // Split by spaces and transliterate each word separately
      const words = trimmedInput.split(/\s+/);
      const transliteratedWords = words.map(word => {
        const lowerWord = word.toLowerCase();
        // Check dictionary first for this word
        const commonWord = commonTamilWords[lowerWord];
        if (commonWord) {
          return commonWord;
        }
        // Otherwise use ITRANS
        const tamilWord = transliterateToTamil(word);
        // Apply ச/ஸ fix to this word
        return tamilWord.replace(/ஸ/g, 'ச');
      });
      
      // Combine transliterated words with space
      const multiWordTamil = transliteratedWords.join(' ');
      if (multiWordTamil !== trimmedInput) {
        terms.push(multiWordTamil);
      }
    } else {
      // Single word - use existing logic
      // PRIORITY 1: Check common words dictionary first (most accurate)
      const commonWord = commonTamilWords[lowerInput];
      if (commonWord) {
        terms.push(commonWord);
      } else {
        // PRIORITY 2: Use ITRANS transliteration with variants
        const tamilVersion = transliterateToTamil(trimmedInput);
        if (tamilVersion && tamilVersion !== trimmedInput) {
          terms.push(tamilVersion);
          
          // CRITICAL FIX: Handle both Tamil 's' sounds
          // ITRANS produces 'ஸ' (Sanskrit s) but many traditional Tamil words use 'ச' (native s)
          // Example: "arisi" → "அரிஸி" (ITRANS) vs "அரிசி" (traditional rice)
          const variant1 = tamilVersion.replace(/ஸ/g, 'ச');  // Replace ஸ with ச
          const variant2 = tamilVersion.replace(/ச/g, 'ஸ');  // Replace ச with ஸ
          
          if (variant1 !== tamilVersion) terms.push(variant1);
          if (variant2 !== tamilVersion) terms.push(variant2);
        }
      }
    }
  }

  return terms;
};

/**
 * Check if text contains Tamil characters
 * @param {string} text - Text to check
 * @returns {boolean} True if Tamil characters found
 */
export const containsTamil = (text) => {
  if (!text) return false;
  // Tamil Unicode range: 0B80-0BFF
  return /[\u0B80-\u0BFF]/.test(text);
};

/**
 * Filter products by search term with Tamil transliteration support
 * @param {Array} products - Array of product objects
 * @param {string} searchTerm - Search query
 * @returns {Array} Filtered products
 */
export const filterProductsWithTamil = (products, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return products;
  }

  const searchTerms = createSearchTerms(searchTerm);
  
  return products.filter(product => {
    // Check if any search term matches product fields
    return searchTerms.some(term => {
      const lowerTerm = term.toLowerCase();
      return (
        product.name?.toLowerCase().includes(lowerTerm) ||
        product.code?.toLowerCase().includes(lowerTerm) ||
        product.barcode?.toLowerCase().includes(lowerTerm) ||
        product.category?.toLowerCase().includes(lowerTerm) ||
        product.hsnCode?.toLowerCase().includes(lowerTerm)
      );
    });
  });
};

/**
 * Common Tamil product name mappings for better UX
 * Users can type these common words in English
 */
export const commonTamilWords = {
  'arisi': 'அரிசி',       // Rice
  'ponni': 'பொன்னி',      // Ponni (rice variety)
  'ennai': 'எண்ணெய்',    // Oil
  'paal': 'பால்',         // Milk
  'uppu': 'உப்பு',         // Salt
  'sakkarai': 'சக்கரை',  // Sugar
  'thanni': 'தண்ணீர்',    // Water
  'dosai': 'தோசை',        // Dosa
  'idli': 'இட்லி',        // Idli
  'sambar': 'சாம்பார்',   // Sambar
  'rasam': 'ரசம்',        // Rasam
  'curd': 'தயிர்',         // Curd (using Tamil pronunciation)
  'thayir': 'தயிர்'       // Curd
};

/**
 * Get suggestion for common Tamil words
 * @param {string} input - English input
 * @returns {string|null} Tamil suggestion if found
 */
export const getCommonWordSuggestion = (input) => {
  if (!input) return null;
  const lowerInput = input.toLowerCase().trim();
  return commonTamilWords[lowerInput] || null;
};
