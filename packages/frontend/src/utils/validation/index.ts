/**
 * Validation Module
 *
 * Centralized form validation utilities, schemas, and components
 */

// Export all schemas and types
export * from './schemas';

// Export all form components
export * from './components';

// Re-export commonly used items for convenience
export {
  // Schemas
  emailSchema,
  passwordSchema,
  signUpSchema,
  signInSchema,
  createProjectSchema,

  // Types
  type SignUpForm,
  type SignInForm,
  type CreateProjectForm,

  // Validation rules
  VALIDATION_RULES,

  // Helpers
  getPasswordStrength,
} from './schemas';

export {
  // Components
  TextField,
  EmailField,
  PasswordField,
  TextareaField,
  CheckboxField,
  SelectField,
  FormErrorSummary,
  SubmitButton,
} from './components';
