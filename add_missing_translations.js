// Script to add missing translation keys to en.ts

const missingKeys = {
  auth: {
    accountLocked: 'Your account has been locked. Please contact support.',
    fillAllFields: 'Please fill in all required fields',
    serverError: 'Server error. Please try again later.',
    signInError: 'Error signing in',
    signInFailed: 'Sign in failed. Please check your credentials.',
  },
  common: {
    pleaseLogin: 'Please log in to continue',
    retry: 'Retry',
    segmentation: 'Segmentation',
    copiedToClipboard: 'Copied to clipboard!',
    failedToCopy: 'Failed to copy to clipboard',
    confirm: 'Confirm',
    cancel: 'Cancel',
  },
  editor: {
    autoSaveDisabled: 'Auto-save disabled',
    autoSaveEnabled: 'Auto-save enabled',
    autoSaveError: 'Auto-save error',
    autoSaveSuccess: 'Auto-saved successfully',
    loadError: 'Error loading editor',
    resegmentError: 'Resegmentation error',
    resegmentStarted: 'Resegmentation started',
    resegmentSuccess: 'Resegmentation successful',
    resegmentingButtonTooltip: 'Processing resegmentation...',
    saveError: 'Error saving changes',
    saveSuccess: 'Changes saved successfully',
  },
  error: {
    handler: {
      defaultMessage: 'An unexpected error occurred',
      title: 'Error',
    },
  },
  errors: {
    somethingWentWrong: 'Something went wrong',
    componentError: "An error occurred in this component. We've been notified and will fix the issue as soon as possible.",
    errorDetails: 'Error Details',
    tryAgain: 'Try Again',
    reloadPage: 'Reload Page',
    goBack: 'Go Back',
    networkError: 'Network error. Please check your connection.',
    validationErrors: 'Validation errors:',
  },
  export: {
    backToProject: 'Back to Project',
    exportImages: 'Export Images',
    maskExportError: 'Error exporting mask',
    maskExportStarted: 'Mask export started',
    metricsRequireSegmentation: 'Metrics require segmentation to be completed',
    noImageSelectedError: 'No image selected for export',
  },
  greeting: {
    evening: 'Good evening',
    morning: 'Good morning',
    welcome: 'Welcome',
  },
  hello: 'Hello',
  imageProcessor: {
    resultSaveError: 'Error saving segmentation results',
    resultSaveSuccess: 'Segmentation results saved successfully',
    segmentationStartError: 'Error starting segmentation',
  },
  images: {
    deleteError: 'Error deleting image',
    deleteMultipleError: 'Error deleting images',
    deleteMultipleSuccess: 'Images deleted successfully',
    deleteSuccess: 'Image deleted successfully',
    deleting: 'Deleting image...',
    deletingMultiple: 'Deleting images...',
  },
  items: {
    one: '{{count}} item',
    other: '{{count}} items',
    zero: 'No items',
  },
  landing: {
    cta: {
      button: 'Get Started',
      description: 'Join our platform to access powerful segmentation tools',
      title: 'Ready to start?',
    },
    features: {
      feature1: {
        description: 'Advanced AI-powered cell segmentation',
        point1: 'Accurate detection',
        point2: 'Fast processing',
        title: 'Smart Segmentation',
      },
      feature2: {
        description: 'Comprehensive analysis and metrics',
        point1: 'Detailed statistics',
        point2: 'Export capabilities',
        title: 'Data Analysis',
      },
      feature3: {
        description: 'Work together on projects',
        point1: 'Share projects',
        point2: 'Team collaboration',
        title: 'Collaboration',
      },
      subtitle: 'Everything you need for cell analysis',
      title: 'Features',
    },
    hero: {
      getStarted: 'Get Started',
      imageAlt: 'Cell segmentation example',
      requestAccess: 'Request Access',
      subtitle: 'Advanced AI-powered cell segmentation and analysis platform',
      title: 'SpherosegV4',
    },
  },
  missing: {
    key: 'Translation missing',
  },
  nav: {
    about: 'About',
    home: 'Home',
  },
  nested: {
    deeply: {
      key: 'Nested key value',
    },
  },
  newProject: {
    createError: 'Error creating project',
    createSuccess: 'Project created successfully',
  },
  params: 'Parameters',
  privacyPage: {
    contactUs: {
      paragraph1: 'If you have any questions about this Privacy Policy, please contact us.',
      title: 'Contact Us',
    },
    dataSecurity: {
      paragraph1: 'We implement appropriate security measures to protect your data.',
      title: 'Data Security',
    },
    howWeUse: {
      paragraph1: 'We use the information we collect to provide and improve our services.',
      title: 'How We Use Information',
    },
    informationWeCollect: {
      paragraph1: 'We collect information you provide directly to us.',
      title: 'Information We Collect',
    },
    personalInformation: {
      paragraph1: 'We collect personal information such as name and email when you register.',
      title: 'Personal Information',
    },
    researchData: {
      paragraph1: 'We process research data you upload for segmentation and analysis.',
      title: 'Research Data',
    },
    usageInformation: {
      paragraph1: 'We collect usage information to improve our services.',
      title: 'Usage Information',
    },
    yourChoices: {
      paragraph1: 'You can manage your account settings and data preferences.',
      title: 'Your Choices',
    },
  },
  profile: {
    avatar: 'Avatar',
    avatarAlt: 'User avatar',
    cropError: 'Error cropping image',
    darkTheme: 'Dark',
    dropzoneText: 'Drop image here or click to select',
    language: 'Language',
    lightTheme: 'Light',
    noImageToUpload: 'No image to upload',
    personalInfo: 'Personal Information',
    preferences: 'Preferences',
    professional: 'Professional',
    selectAvatar: 'Select Avatar',
    systemTheme: 'System',
    theme: 'Theme',
    updateError: 'Error updating profile',
    updateSuccess: 'Profile updated successfully',
  },
  project: {
    create: 'Create Project',
    createDescription: 'Create a new project to organize your images',
    createError: 'Error creating project',
    createNew: 'Create New Project',
    description: 'Description',
    descriptionPlaceholder: 'Enter project description',
    title: 'Title',
    titlePlaceholder: 'Enter project title',
    titleRequired: 'Project title is required',
  },
  projects: {
    createError: 'Error creating project',
    createSuccess: 'Project created successfully',
    duplicate: 'Duplicate',
    duplicateFailed: 'Project duplication failed',
    duplicateProgress: 'Duplicating project...',
    duplicateProject: 'Duplicate Project',
    duplicateProjectDescription: 'Create a copy of this project',
    duplicateSuccess: 'Project duplicated successfully',
    duplicating: 'Duplicating...',
    duplicationCancelError: 'Error cancelling duplication',
    duplicationCancellationFailed: 'Failed to cancel duplication',
    duplicationCancelled: 'Duplication cancelled',
    duplicationComplete: 'Duplication complete',
    duplicationCompleted: 'Duplication completed',
    duplicationFailed: 'Duplication failed',
    duplicationPending: 'Duplication pending',
    duplicationProcessing: 'Processing duplication',
    duplicationSuccessMessage: 'Project has been successfully duplicated',
    duplicationTaskFetchError: 'Error fetching duplication status',
    edit: 'Edit',
    noActiveDuplications: 'No active duplications',
    noDuplications: 'No duplications',
    projectDescPlaceholder: 'Enter project description',
    projectSelection: 'Project Selection',
    selectProject: 'Select a project',
  },
  segmentation: {
    helpTips: {
      view: {
        pan: 'Pan: Click and drag',
        selectPolygon: 'Select: Click on polygon',
        zoom: 'Zoom: Mouse wheel',
      },
    },
    imageNotFoundDescription: 'The requested image could not be found',
    invalidImageDimensions: 'Invalid image dimensions',
    noDataToSave: 'No changes to save',
    polygonDuplicated: 'Polygon duplicated',
    polygonNotFound: 'Polygon not found',
    polygonSimplified: 'Polygon simplified',
    polygonSimplifyFailed: 'Failed to simplify polygon',
    polygonSliced: 'Polygon sliced successfully',
    resegment: {
      error: {
        exception: 'Resegmentation error: {{error}}',
        failed: 'Resegmentation failed',
        missingData: 'Missing required data for resegmentation',
      },
      success: 'Resegmentation completed successfully',
    },
    resegmentMultipleError: 'Error resegmenting multiple images',
    resegmentMultipleSuccess: 'Multiple images resegmented successfully',
    resegmenting: 'Resegmenting...',
    resegmentingMultiple: 'Resegmenting multiple images...',
    saveError: 'Error saving segmentation',
    segmentationLoading: 'Loading segmentation...',
    segmentationPolygon: 'Segmentation polygon',
    selectPolygonFirst: 'Please select a polygon first',
    sliceFailed: 'Failed to slice polygon',
    undoRestored: 'Action undone',
    undoWhileDraggingError: 'Cannot undo while dragging',
    vertexDeleteFailed: 'Failed to delete vertex',
    vertexDeleted: 'Vertex deleted',
    vertexDuplicateFailed: 'Failed to duplicate vertex',
    vertexDuplicated: 'Vertex duplicated',
  },
  segmentationPage: {
    errorFetchingProjectOrImages: 'Error fetching project or images',
    fetchError: 'Error fetching data',
    fetchSegmentationError: 'Error fetching segmentation data',
    imageNotFoundError: 'Image not found',
    saveError: 'Error saving segmentation',
    saveSuccess: 'Segmentation saved successfully',
    segmentationFailedPreviously: 'Segmentation failed previously. Please try again.',
    validationError: 'Validation error',
  },
  settings: {
    accountDeleted: 'Account deleted successfully',
    emailConfirmError: 'Email confirmation does not match',
    fetchError: 'Error fetching settings',
    noChanges: 'No changes to save',
    passwordRequired: 'Current password is required',
    updateError: 'Error updating settings',
    updateSuccess: 'Settings updated successfully',
  },
  shared: {
    sharedBy: 'Shared by {{name}}',
  },
  statsOverview: {
    loadError: 'Error loading statistics',
  },
  test: {
    key: 'Test value',
  },
  upload: {
    cancel: 'Cancel',
    dragDropMultiple: 'Drag & drop files here, or click to select',
    dragDropSingle: 'Drag & drop a file here, or click to select',
    dropFiles: 'Drop files here',
    error: 'Upload error',
    filesTooLarge: 'Some files are too large',
    maxFiles: 'Maximum {{count}} files',
    maxSize: 'Maximum size: {{size}}',
    removeFile: 'Remove file',
    retry: 'Retry',
    singleFileOnly: 'Only one file allowed',
    success: 'Upload successful',
    tooManyFiles: 'Too many files. Maximum allowed: {{max}}',
    unsupportedFileTypes: 'Unsupported file type(s)',
    uploaderDisabled: 'Uploader is disabled',
    uploading: 'Uploading...',
  },
};

// Read the current en.ts file
const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'packages/frontend/src/translations/en.ts');
const enContent = fs.readFileSync(enPath, 'utf8');

// Parse the existing translations
const existingMatch = enContent.match(/export default ([\s\S]*);?\s*$/);
if (!existingMatch) {
  console.error('Could not parse existing translations');
  process.exit(1);
}

// Function to merge objects deeply
function deepMerge(target, source) {
  const output = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = deepMerge(output[key] || {}, source[key]);
      } else {
        if (!(key in output)) {
          output[key] = source[key];
        }
      }
    }
  }
  
  return output;
}

// Parse existing object (this is a simplified parser, might need adjustment)
let existingObj;
try {
  // Remove 'export default ' and trailing semicolon
  const objStr = existingMatch[1].replace(/;$/, '');
  // Use eval to parse the object (be careful with this in production)
  existingObj = eval('(' + objStr + ')');
} catch (e) {
  console.error('Error parsing existing translations:', e);
  process.exit(1);
}

// Merge missing keys into existing object
const mergedObj = deepMerge(existingObj, missingKeys);

// Convert object to string with proper formatting
function objToString(obj, indent = 2) {
  const spaces = ' '.repeat(indent);
  const entries = [];
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      entries.push(`${key}: ${objToString(value, indent + 2)}`);
    } else if (typeof value === 'string') {
      // Escape single quotes in the string
      const escaped = value.replace(/'/g, "\\'");
      entries.push(`${key}: '${escaped}'`);
    } else {
      entries.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  
  if (entries.length === 0) return '{}';
  
  return `{\n${spaces}${entries.join(`,\n${spaces}`)}\n${' '.repeat(indent - 2)}}`;
}

// Generate new content
const newContent = `// English translations
export default ${objToString(mergedObj)};
`;

// Write back to file
fs.writeFileSync(enPath, newContent);

console.log('✅ Successfully added missing translation keys to en.ts');
console.log('📝 Added keys for:', Object.keys(missingKeys).join(', '));