import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Komponenta pro testování překladů
 */
const TranslationTester: React.FC = () => {
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  // Klíče, které chceme otestovat
  const keysToTest = [
    'segmentation.resolution',
    'segmentation.selectPolygonForSlice',
    'segmentation.selectPolygonForAddPoints',
    'segmentation.selectPolygonForEdit',
  ];

  // Funkce pro testování překladů
  const testTranslations = () => {
    const results: Record<string, boolean> = {};

    keysToTest.forEach((key) => {
      const translation = t(key);
      // Překlad je platný, pokud není stejný jako klíč a neobsahuje placeholder
      const isValid = translation !== key && !translation.includes('[');
      results[key] = isValid;
    });

    setTestResults(results);
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Test překladů</h2>

      <div className="mb-4">
        <p>
          Aktuální jazyk: <strong>{language}</strong>
        </p>

        <div className="flex flex-wrap gap-2 mt-2">
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-3 py-1 rounded ${
                language === lang ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <button onClick={testTranslations} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
        Spustit test
      </button>

      {Object.keys(testResults).length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold mb-2">Výsledky testu:</h3>
          <ul className="space-y-1">
            {keysToTest.map((key) => (
              <li key={key} className="flex items-center">
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full mr-2 ${
                    testResults[key] ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {testResults[key] ? '✓' : '✗'}
                </span>
                <span className="font-mono">{key}</span>
                <span className="mx-2">→</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TranslationTester;
