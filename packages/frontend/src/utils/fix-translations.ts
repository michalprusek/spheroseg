import fs from 'fs';
import path from 'path';

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

// Deep merge function that combines objects
function deepMerge(target: TranslationObject, source: TranslationObject): TranslationObject {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
          result[key] = deepMerge(result[key] as TranslationObject, source[key] as TranslationObject);
        } else {
          result[key] = source[key];
        }
      } else {
        // Add key if it doesn't exist
        if (!(key in result)) {
          result[key] = source[key];
        }
      }
    }
  }
  
  return result;
}

// Parse translation file and extract sections
function parseTranslationFile(content: string): Map<string, { start: number, end: number, content: string }> {
  const sections = new Map<string, { start: number, end: number, content: string }[]>();
  const lines = content.split('\n');
  
  let currentSection: string | null = null;
  let sectionStart = 0;
  let braceCount = 0;
  let sectionContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for top-level section start
    if (braceCount === 1 && /^(\w+):\s*\{/.test(trimmed)) {
      const match = trimmed.match(/^(\w+):/);
      if (match) {
        currentSection = match[1];
        sectionStart = i;
        sectionContent = [line];
      }
    } else if (currentSection) {
      sectionContent.push(line);
    }
    
    // Count braces
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    
    // End of section
    if (currentSection && braceCount === 1 && line.includes('},')) {
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      sections.get(currentSection)!.push({
        start: sectionStart,
        end: i,
        content: sectionContent.join('\n')
      });
      currentSection = null;
      sectionContent = [];
    }
  }
  
  return sections;
}

// Main function to fix translations
async function fixTranslations() {
  const filePath = path.join(process.cwd(), 'src/translations/en.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Parse sections
  const sections = parseTranslationFile(content);
  
  // Find duplicates and merge them
  const mergedSections = new Map<string, string>();
  
  for (const [sectionName, occurrences] of sections.entries()) {
    if (occurrences.length > 1) {
      console.log(`\nMerging ${occurrences.length} occurrences of section "${sectionName}"`);
      
      // Extract and merge all occurrences
      let merged: TranslationObject = {};
      
      for (const occurrence of occurrences) {
        try {
          // Extract just the object content
          const objectMatch = occurrence.content.match(/^\s*\w+:\s*(\{[\s\S]*\}),?\s*$/);
          if (objectMatch) {
            const sectionObj = new Function(`return ${objectMatch[1]}`)();
            merged = deepMerge(merged, sectionObj);
          }
        } catch (error) {
          console.error(`Error parsing section ${sectionName}:`, error);
        }
      }
      
      // Convert back to string with proper formatting
      const mergedString = JSON.stringify(merged, null, 2)
        .replace(/"/g, "'")
        .replace(/: '/g, ": '")
        .replace(/',$/gm, "',");
      
      mergedSections.set(sectionName, `  ${sectionName}: ${mergedString},`);
    } else {
      // Keep single occurrences as is
      mergedSections.set(sectionName, occurrences[0].content);
    }
  }
  
  // Rebuild the file
  const lines = content.split('\n');
  const newLines: string[] = [];
  const processedSections = new Set<string>();
  let skipUntil = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (i <= skipUntil) continue;
    
    const line = lines[i];
    const sectionMatch = line.trim().match(/^(\w+):\s*\{/);
    
    if (sectionMatch && sections.has(sectionMatch[1])) {
      const sectionName = sectionMatch[1];
      const occurrences = sections.get(sectionName)!;
      
      if (!processedSections.has(sectionName)) {
        // Add the merged section
        newLines.push(mergedSections.get(sectionName)!);
        processedSections.add(sectionName);
        
        // Skip all occurrences
        skipUntil = Math.max(...occurrences.map(o => o.end));
      }
    } else {
      newLines.push(line);
    }
  }
  
  // Write the fixed file
  const outputPath = path.join(process.cwd(), 'src/translations/en-fixed.ts');
  fs.writeFileSync(outputPath, newLines.join('\n'), 'utf-8');
  
  console.log(`\nFixed translation file written to: ${outputPath}`);
  console.log('Merged sections:', Array.from(processedSections).join(', '));
}

// Run the fix
fixTranslations().catch(console.error);