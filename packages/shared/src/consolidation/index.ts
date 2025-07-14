/**
 * Consolidation Module Exports
 * 
 * Automated tools for checking and maintaining code consolidation patterns
 */

export {
  ConsolidationChecker,
  runConsolidationCheck,
} from './consolidationChecker';

export type {
  ConsolidationRule,
  CheckContext,
  CheckResult,
  ConsolidationReport,
} from './consolidationChecker';

// Re-export as default
export { default } from './consolidationChecker';