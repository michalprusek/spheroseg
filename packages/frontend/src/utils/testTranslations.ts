// Test file to verify translations are loading correctly
import enTranslations from '@/translations/en';

export function testTranslations() {
  console.log('[testTranslations] Testing translation structure:');
  
  // Test if the translations object exists
  console.log('EN translations exists:', !!enTranslations);
  
  // Test common keys
  console.log('common.loadingApplication:', enTranslations?.common?.loadingApplication);
  console.log('common.delete:', enTranslations?.common?.delete);
  
  // Test projects keys
  console.log('projects.createProject:', enTranslations?.projects?.createProject);
  console.log('projects.share:', enTranslations?.projects?.share);
  console.log('projects.delete:', enTranslations?.projects?.delete);
  
  // Test statsOverview keys
  console.log('statsOverview.totalProjects:', enTranslations?.statsOverview?.totalProjects);
  console.log('statsOverview.vsLastMonth:', enTranslations?.statsOverview?.vsLastMonth);
  
  // Log the full structure
  console.log('Top-level keys:', Object.keys(enTranslations || {}));
  
  return enTranslations;
}