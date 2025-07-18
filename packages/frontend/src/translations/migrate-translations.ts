#!/usr/bin/env node

/**
 * Migration script to convert flat translation keys to nested structure
 * This helps eliminate duplicate keys and provides better organization
 */

import * as fs from 'fs';

// Mapping of old flat keys to new nested keys
const KEY_MAPPING: Record<string, string> = {
  // Common actions
  save: 'common.actions.save',
  cancel: 'common.actions.cancel',
  delete: 'common.actions.delete',
  edit: 'common.actions.edit',
  create: 'common.actions.create',
  search: 'common.actions.search',
  back: 'common.actions.back',
  close: 'common.actions.close',
  view: 'common.actions.view',
  share: 'common.actions.share',
  export: 'common.actions.export',
  upload: 'common.actions.upload',
  download: 'common.actions.download',
  duplicate: 'common.actions.duplicate',
  tryAgain: 'common.actions.retry',
  reset: 'common.actions.reset',
  clear: 'common.actions.clear',
  selectAll: 'common.actions.selectAll',
  removeAll: 'common.actions.removeAll',
  saveChanges: 'common.actions.saveChanges',
  uploadImages: 'common.actions.uploadImages',
  backToHome: 'common.actions.backToHome',
  goHome: 'common.actions.goHome',
  goBack: 'common.actions.goBack',
  returnToHome: 'common.actions.returnToHome',
  reloadPage: 'common.actions.reloadPage',
  cropAvatar: 'common.actions.cropAvatar',
  uploadAvatar: 'common.actions.uploadAvatar',
  removeAvatar: 'common.actions.removeAvatar',
  enable: 'common.actions.enable',
  disable: 'common.actions.disable',

  // Common status
  loading: 'common.status.loading',
  processing: 'common.status.processing',
  saving: 'common.status.saving',
  uploading: 'common.status.uploading',
  completed: 'common.status.completed',
  failed: 'common.status.failed',
  pending: 'common.status.pending',
  queued: 'common.status.queued',
  success: 'common.status.success',
  error: 'common.status.error',
  active: 'common.status.active',
  archived: 'common.status.archived',
  draft: 'common.status.draft',
  loadingAccount: 'common.status.loadingAccount',
  loadingApplication: 'common.status.loadingApplication',

  // Common form fields
  email: 'common.form.email',
  password: 'common.form.password',
  confirmPassword: 'common.form.confirmPassword',
  firstName: 'common.form.firstName',
  lastName: 'common.form.lastName',
  username: 'common.form.username',
  name: 'common.form.name',
  title: 'common.form.title',
  description: 'common.form.description',
  organization: 'common.form.organization',
  location: 'common.form.location',
  bio: 'common.form.bio',
  optional: 'common.form.optional',
  required: 'common.form.required',
  department: 'common.form.department',
  passwordConfirm: 'common.form.passwordConfirm',

  // Common placeholders
  emailPlaceholder: 'common.placeholders.email',
  passwordPlaceholder: 'common.placeholders.password',
  projectName: 'common.placeholders.projectName',
  projectDescription: 'common.placeholders.projectDescription',

  // Common messages
  saveSuccess: 'common.messages.saveSuccess',
  deleteSuccess: 'common.messages.deleteSuccess',
  updateSuccess: 'common.messages.updateSuccess',
  uploadSuccess: 'common.messages.uploadSuccess',
  createSuccess: 'common.messages.createSuccess',
  validationFailed: 'common.messages.validationFailed',
  unauthorized: 'common.messages.unauthorized',
  forbidden: 'common.messages.forbidden',
  notFound: 'common.messages.notFound',
  and: 'common.messages.and',
  or: 'common.messages.or',
  notSpecified: 'common.messages.notSpecified',
  notProvided: 'common.messages.notProvided',

  // Common labels
  yes: 'common.labels.yes',
  no: 'common.labels.no',
  language: 'common.labels.language',
  theme: 'common.labels.theme',
  light: 'common.labels.light',
  dark: 'common.labels.dark',
  system: 'common.labels.system',
  date: 'common.labels.date',
  images: 'common.labels.images',
  files: 'common.labels.files',
  image: 'common.labels.image',
  lastChange: 'common.labels.lastChange',
  lastUpdated: 'common.labels.lastUpdated',
  createdAt: 'common.labels.createdAt',
  updatedAt: 'common.labels.updatedAt',
  sort: 'common.labels.sort',
  actions: 'common.labels.actions',
  status: 'common.labels.status',
  settings: 'common.labels.settings',
  profile: 'common.labels.profile',
  dashboard: 'common.labels.dashboard',
  welcome: 'common.labels.welcome',
  account: 'common.labels.account',
  termsOfService: 'common.labels.termsOfService',
  privacyPolicy: 'common.labels.privacyPolicy',
  termsOfServiceLink: 'common.labels.termsOfServiceLink',
  privacyPolicyLink: 'common.labels.privacyPolicyLink',
  maxFileSize: 'common.labels.maxFileSize',
  accepted: 'common.labels.accepted',
  imageOnly: 'common.labels.imageOnly',

  // Auth
  signIn: 'auth.actions.signIn',
  signUp: 'auth.actions.signUp',
  signOut: 'auth.actions.signOut',
  signingIn: 'auth.messages.signingIn',
  forgotPassword: 'auth.actions.forgotPassword',
  resetPassword: 'auth.actions.resetPassword',
  createAccount: 'auth.actions.createAccount',
  requestAccess: 'auth.actions.requestAccess',
  signInWithGoogle: 'auth.actions.signInWithGoogle',
  signInWithGithub: 'auth.actions.signInWithGithub',
  resendVerification: 'auth.actions.resendVerification',
  sendResetLink: 'auth.actions.sendResetLink',
  backToSignIn: 'auth.actions.backToSignIn',
  signInTitle: 'auth.titles.signIn',
  signInDescription: 'auth.descriptions.signIn',
  noAccount: 'auth.questions.noAccount',
  emailAddressLabel: 'auth.labels.email',
  passwordLabel: 'auth.labels.password',
  currentPasswordLabel: 'auth.labels.currentPassword',
  newPasswordLabel: 'auth.labels.newPassword',
  confirmPasswordLabel: 'auth.labels.confirmPassword',
  rememberMe: 'auth.labels.rememberMe',
  emailRequired: 'auth.messages.emailRequired',
  passwordRequired: 'auth.messages.passwordRequired',
  alreadyLoggedInTitle: 'auth.titles.alreadyLoggedIn',
  alreadyLoggedInMessage: 'auth.messages.alreadyLoggedInMessage',
  goToDashboardLink: 'auth.messages.goToDashboardLink',
  invalidEmail: 'auth.messages.invalidEmail',
  passwordTooShort: 'auth.messages.passwordTooShort',
  passwordsDontMatch: 'auth.messages.passwordsDontMatch',
  invalidCredentials: 'auth.messages.invalidCredentials',
  accountCreated: 'auth.messages.accountCreated',
  resetLinkSent: 'auth.messages.resetLinkSent',
  resetSuccess: 'auth.messages.resetSuccess',
  signInSuccess: 'auth.messages.signInSuccess',
  signOutSuccess: 'auth.messages.signOutSuccess',
  sessionExpired: 'auth.messages.sessionExpired',
  verifyEmail: 'auth.messages.verifyEmail',
  verificationLinkSent: 'auth.messages.verificationLinkSent',
  verificationSuccess: 'auth.messages.verificationSuccess',
  forgotPasswordLink: 'auth.actions.forgotPassword',
  passwordChanged: 'auth.messages.passwordChanged',
  currentPasswordIncorrect: 'auth.messages.currentPasswordIncorrect',
  registerTitle: 'auth.titles.signUp',
  registerDescription: 'auth.descriptions.signUp',
  registerSuccess: 'auth.messages.registerSuccess',
  firstNamePlaceholder: 'auth.placeholders.firstName',
  lastNamePlaceholder: 'auth.placeholders.lastName',
  passwordConfirmPlaceholder: 'auth.placeholders.confirmPassword',
  signUpTitle: 'auth.titles.signUp',
  signUpDescription: 'auth.descriptions.signUp',
  enterInfoCreateAccount: 'auth.descriptions.enterInfoCreateAccount',
  creatingAccount: 'auth.messages.creatingAccount',
  emailAlreadyExists: 'auth.messages.emailAlreadyExists',
  emailHasPendingRequest: 'auth.messages.emailHasPendingRequest',
  signUpSuccessEmail: 'auth.messages.signUpSuccessEmail',
  signUpFailed: 'auth.messages.signUpFailed',
  alreadyHaveAccess: 'auth.questions.alreadyHaveAccess',
  forgotPasswordTitle: 'auth.titles.forgotPassword',
  checkYourEmail: 'auth.descriptions.checkYourEmail',
  enterEmailForReset: 'auth.descriptions.enterEmail',
  passwordResetLinkSent: 'auth.messages.passwordResetLinkSent',
  passwordResetFailed: 'auth.messages.passwordResetFailed',
  enterEmail: 'auth.placeholders.enterEmail',
  sendingResetLink: 'auth.messages.sendingResetLink',
  dontHaveAccount: 'auth.questions.dontHaveAccount',
  alreadyHaveAccount: 'auth.questions.alreadyHaveAccount',
  termsAndPrivacy: 'auth.descriptions.termsAndPrivacy',

  // Projects
  projects: 'projects.titles.page',
  'projectsPage.title': 'projects.titles.page',
  'projectsPage.description': 'projects.descriptions.page',
  'projectsPage.createNew': 'projects.actions.createNew',
  'projectsPage.createProject': 'projects.actions.create',
  'projectsPage.createProjectDesc': 'projects.descriptions.createDesc',
  'projectsPage.projectName': 'projects.labels.name',
  'projectsPage.projectDescription': 'projects.labels.description',
  'projectsPage.projectNamePlaceholder': 'projects.placeholders.name',
  'projectsPage.projectDescriptionPlaceholder': 'projects.placeholders.description',
  'projectsPage.projectCreated': 'projects.messages.created',
  'projectsPage.projectCreationFailed': 'projects.messages.creationFailed',
  'projectsPage.projectDeleted': 'projects.messages.deleted',
  'projectsPage.projectDeletionFailed': 'projects.messages.deletionFailed',
  'projectsPage.confirmDelete': 'projects.messages.confirmDelete',
  'projectsPage.confirmDeleteDescription': 'projects.messages.confirmDeleteDescription',
  'projectsPage.deleteProject': 'projects.actions.delete',
  'projectsPage.editProject': 'projects.actions.edit',
  'projectsPage.viewProject': 'projects.actions.view',
  'projectsPage.projectUpdated': 'projects.messages.updated',
  'projectsPage.projectUpdateFailed': 'projects.messages.updateFailed',
  'projectsPage.noProjects': 'projects.messages.noProjects',
  'projectsPage.createFirstProject': 'projects.messages.createFirst',
  'projectsPage.searchProjects': 'projects.actions.search',
  'projectsPage.filterProjects': 'projects.actions.filter',
  'projectsPage.sortProjects': 'projects.actions.sort',
  'projectsPage.projectNameRequired': 'projects.messages.nameRequired',
  'projectsPage.loginRequired': 'projects.messages.loginRequired',
  'projectsPage.createdAt': 'projects.labels.createdAt',
  'projectsPage.updatedAt': 'projects.labels.updatedAt',
  'projectsPage.imageCount': 'projects.labels.imageCount',
  'projectsPage.status': 'projects.labels.status',
  'projectsPage.actions': 'common.labels.actions',
  'projectsPage.loading': 'projects.messages.loading',
  'projectsPage.error': 'projects.messages.error',
  'projectsPage.retry': 'projects.actions.retry',
  'projectsPage.duplicating': 'projects.messages.duplicating',
  'projectsPage.duplicate': 'projects.actions.duplicate',
  'projectsPage.duplicateSuccess': 'projects.messages.duplicated',
  'projectsPage.duplicateFailed': 'projects.messages.duplicateFailed',
  'projectsPage.duplicateTitle': 'projects.titles.duplicate',
  'projectsPage.duplicateProject': 'projects.titles.duplicate',
  'projectsPage.duplicateProjectDescription': 'projects.descriptions.duplicate',
  'projectsPage.duplicateCancelled': 'projects.messages.duplicationCancelled',
  'projectsPage.duplicatingProject': 'projects.titles.duplicating',
  'projectsPage.duplicatingProjectDescription': 'projects.messages.duplicatingDescription',
  'projectsPage.duplicateProgress': 'projects.titles.duplicateProgress',
  'projectsPage.duplicationComplete': 'projects.duplication.complete',
  'projectsPage.duplicationTaskFetchError': 'projects.messages.duplicationTaskFetchError',
  'projectsPage.duplicationCancelError': 'projects.messages.duplicationCancelError',
  'projectsPage.duplicateProgressDescription': 'projects.messages.duplicateProgressDescription',
  'projectsPage.duplicationPending': 'projects.duplication.pending',
  'projectsPage.duplicationProcessing': 'projects.duplication.processing',
  'projectsPage.duplicationCompleted': 'projects.duplication.completed',
  'projectsPage.duplicationFailed': 'projects.duplication.failed',
  'projectsPage.duplicationCancelled': 'projects.duplication.cancelled',
  'projectsPage.duplicationCancellationFailed': 'projects.messages.duplicationCancellationFailed',
  'projectsPage.duplicationSuccessMessage': 'projects.messages.duplicationSuccessMessage',
  'projectsPage.copySegmentations': 'projects.labels.copySegmentations',
  'projectsPage.resetImageStatus': 'projects.labels.resetImageStatus',
  'projectsPage.newProjectTitle': 'projects.labels.newProjectTitle',
  'projectsPage.itemsProcessed': 'projects.labels.itemsProcessed',
  'projectsPage.items': 'projects.labels.items',
  'projectsPage.unknownProject': 'projects.labels.unknownProject',
  'projectsPage.activeTasks': 'projects.labels.activeTasks',
  'projectsPage.allTasks': 'projects.labels.allTasks',
  'projectsPage.noActiveDuplications': 'projects.messages.noActiveDuplications',
  'projectsPage.noDuplications': 'projects.messages.noDuplications',
  'projectsPage.deleteProjectDescription': 'projects.descriptions.delete',
  'projectsPage.deleteWarning': 'projects.messages.deleteWarning',
  'projectsPage.untitledProject': 'projects.labels.untitledProject',
  'projectsPage.typeToConfirm': 'projects.messages.typeToConfirm',
  'projectsPage.deleteConfirm': 'projects.messages.confirmDelete',
  'projectsPage.exportProject': 'projects.titles.export',
  'projectsPage.archived': 'projects.status.archived',
  'projectsPage.completed': 'projects.status.completed',
  'projectsPage.draft': 'projects.status.draft',
  'projectsPage.active': 'projects.status.active',
  'projectsPage.createDate': 'projects.labels.createdAt',
  'projectsPage.lastModified': 'projects.labels.updatedAt',
  'projectsPage.projectDescPlaceholder': 'projects.placeholders.description',
  'projectsPage.creatingProject': 'projects.messages.creatingProject',

  // Navigation
  'navbar.home': 'navigation.home',
  'navbar.features': 'navigation.features',
  'navbar.documentation': 'navigation.documentation',
  'navbar.terms': 'navigation.terms',
  'navbar.privacy': 'navigation.privacy',
  'navbar.login': 'navigation.login',
  'navbar.requestAccess': 'navigation.requestAccess',
  'navigation.home': 'navigation.home',
  'navigation.projects': 'navigation.projects',
  'navigation.settings': 'navigation.settings',
  'navigation.profile': 'navigation.profile',
  'navigation.dashboard': 'navigation.dashboard',
  'navigation.back': 'navigation.back',

  // Dashboard
  'dashboard.manageProjects': 'dashboard.messages.manageProjects',
  'dashboard.viewMode.grid': 'dashboard.viewMode.grid',
  'dashboard.viewMode.list': 'dashboard.viewMode.list',
  'dashboard.sort.name': 'dashboard.sort.name',
  'dashboard.sort.updatedAt': 'dashboard.sort.updatedAt',
  'dashboard.sort.segmentationStatus': 'dashboard.sort.segmentationStatus',
  'dashboard.search': 'dashboard.placeholders.searchProjects',
  'dashboard.searchImagesPlaceholder': 'dashboard.placeholders.searchImages',
  'dashboard.noProjects': 'dashboard.messages.noProjects',
  'dashboard.noImagesDescription': 'dashboard.messages.noImagesDescription',
  'dashboard.createFirst': 'dashboard.messages.createFirst',
  'dashboard.createNew': 'dashboard.actions.createNew',
  'dashboard.lastChange': 'dashboard.labels.lastChange',
  'dashboard.statsOverview': 'dashboard.labels.statsOverview',
  'dashboard.totalProjects': 'dashboard.labels.totalProjects',
  'dashboard.activeProjects': 'dashboard.labels.activeProjects',
  'dashboard.totalImages': 'dashboard.labels.totalImages',
  'dashboard.totalAnalyses': 'dashboard.labels.totalAnalyses',
  'dashboard.lastUpdated': 'dashboard.labels.lastUpdated',
  'dashboard.noProjectsDescription': 'dashboard.messages.noProjectsDescription',
  'dashboard.searchProjectsPlaceholder': 'dashboard.placeholders.searchProjects',
  'dashboard.sortBy': 'dashboard.labels.sortBy',
  'dashboard.name': 'dashboard.labels.name',
  'dashboard.completed': 'dashboard.status.completed',
  'dashboard.processing': 'dashboard.status.processing',
  'dashboard.pending': 'dashboard.status.pending',
  'dashboard.failed': 'dashboard.status.failed',
  'dashboard.selectImagesButton': 'dashboard.actions.selectImages',

  // Stats Overview
  'statsOverview.title': 'dashboard.titles.overview',
  'statsOverview.totalProjects': 'dashboard.labels.totalProjects',
  'statsOverview.totalImages': 'dashboard.labels.totalImages',
  'statsOverview.completedSegmentations': 'dashboard.labels.completedSegmentations',
  'statsOverview.storageUsed': 'dashboard.labels.storageUsed',
  'statsOverview.recentActivity': 'dashboard.titles.recentActivity',
  'statsOverview.moreStats': 'dashboard.actions.moreStats',
  'statsOverview.completion': 'dashboard.labels.completion',
  'statsOverview.vsLastMonth': 'dashboard.labels.vsLastMonth',
  'statsOverview.thisMonth': 'dashboard.labels.thisMonth',
  'statsOverview.lastMonth': 'dashboard.labels.lastMonth',
  'statsOverview.projectsCreated': 'dashboard.labels.projectsCreated',
  'statsOverview.imagesUploaded': 'dashboard.labels.imagesUploaded',
  'statsOverview.fetchError': 'dashboard.messages.fetchError',
  'statsOverview.storageLimit': 'dashboard.labels.storageLimit',
  'statsOverview.activityTitle': 'dashboard.titles.recentActivity',
  'statsOverview.noActivity': 'dashboard.messages.noActivity',
  'statsOverview.hide': 'dashboard.actions.hide',
  'statsOverview.activityTypes.project_created': 'dashboard.activityTypes.project_created',
  'statsOverview.activityTypes.image_uploaded': 'dashboard.activityTypes.image_uploaded',
  'statsOverview.activityTypes.segmentation_completed': 'dashboard.activityTypes.segmentation_completed',

  // More mappings can be added here...
};

function migrateTranslations(inputPath: string, outputPath: string) {
  // Read the input file
  const fileContent = fs.readFileSync(inputPath, 'utf-8');

  // Parse the module to extract the default export
  const match = fileContent.match(/export default\s*({[\s\S]*})\s*;?$/);
  if (!match) {
    throw new Error('Could not find default export in translation file');
  }

  // Use Function constructor to safely evaluate the object
  const translationObj = new Function(`return ${match[1]}`)();

  // Create nested structure
  const nestedTranslations: any = {};

  // Process each key
  for (const [oldKey, value] of Object.entries(translationObj)) {
    const newKey = KEY_MAPPING[oldKey];
    if (newKey) {
      setNestedValue(nestedTranslations, newKey, value);
    } else {
      // If no mapping exists, check if it's already nested
      if (typeof value === 'object' && !Array.isArray(value)) {
        // It's already a nested object, preserve it
        nestedTranslations[oldKey] = value;
      } else {
        // Log unmapped keys for manual review
        console.warn(`Unmapped key: ${oldKey}`);
      }
    }
  }

  // Write the new structure
  const output = `// Auto-migrated translations
export default ${JSON.stringify(nestedTranslations, null, 2)};`;

  fs.writeFileSync(outputPath, output);
  console.log(`Migration completed: ${outputPath}`);
}

function setNestedValue(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

// Run migration if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: node migrate-translations.js <input-file> <output-file>');
    process.exit(1);
  }

  try {
    migrateTranslations(args[0], args[1]);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

export { migrateTranslations, setNestedValue };
