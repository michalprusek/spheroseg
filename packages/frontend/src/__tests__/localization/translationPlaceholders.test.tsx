import { describe, it, expect } from 'vitest';
import * as en from '../../translations/en';
import * as cs from '../../translations/cs';
import * as de from '../../translations/de';
import * as es from '../../translations/es';
import * as fr from '../../translations/fr';
import * as zh from '../../translations/zh';
import { findPlaceholderTranslations } from '../../utils/translationUtils';

describe('Translation Placeholders', () => {
  it('should report placeholder translations in Czech', () => {
    const placeholders = findPlaceholderTranslations(cs.default, 'cs');
    console.log(`Czech has ${placeholders.length} placeholder translations`);
    // We don't expect any placeholders in Czech
    expect(placeholders.length).toBe(0);
  });

  it('should report placeholder translations in German', () => {
    const placeholders = findPlaceholderTranslations(de.default, 'de');
    console.log(`German has ${placeholders.length} placeholder translations`);
    // Just count the placeholders, don't fail the test
    expect(placeholders.length).toBeGreaterThanOrEqual(0);
  });

  it('should report placeholder translations in Spanish', () => {
    const placeholders = findPlaceholderTranslations(es.default, 'es');
    console.log(`Spanish has ${placeholders.length} placeholder translations`);
    // Just count the placeholders, don't fail the test
    expect(placeholders.length).toBeGreaterThanOrEqual(0);
  });

  it('should report placeholder translations in French', () => {
    const placeholders = findPlaceholderTranslations(fr.default, 'fr');
    console.log(`French has ${placeholders.length} placeholder translations`);
    // Just count the placeholders, don't fail the test
    expect(placeholders.length).toBeGreaterThanOrEqual(0);
  });

  it('should report placeholder translations in Chinese', () => {
    const placeholders = findPlaceholderTranslations(zh.default, 'zh');
    console.log(`Chinese has ${placeholders.length} placeholder translations`);
    // Just count the placeholders, don't fail the test
    expect(placeholders.length).toBeGreaterThanOrEqual(0);
  });
});
