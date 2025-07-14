/**
 * Consolidation Module Exports
 * 
 * Automated tools for checking and maintaining code consolidation patterns
 */

export {
  ConsolidationChecker,
  ConsolidationRule,
  CheckContext,
  CheckResult,
  ConsolidationReport,
  runConsolidationCheck,
} from './consolidationChecker';

// Re-export as default
export { default } from './consolidationChecker';