// English translations - Restructured version
export default {
  // Global/common translations used across the app
  common: {
    appName: 'Spheroid Segmentation',
    appNameShort: 'SpheroSeg',
    
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      search: 'Search',
      back: 'Back',
      close: 'Close',
      view: 'View',
      share: 'Share',
      export: 'Export',
      upload: 'Upload',
      download: 'Download',
      duplicate: 'Duplicate',
      retry: 'Try Again',
      reset: 'Reset',
      clear: 'Clear',
      select: 'Select',
      selectAll: 'Select all',
      removeAll: 'Remove All',
      saveChanges: 'Save Changes',
      uploadImages: 'Upload Images',
      backToHome: 'Back to Home',
      goHome: 'Go to home page',
      goBack: 'Go back',
      returnToHome: 'Return to Home',
      reloadPage: 'Reload Page',
      cropAvatar: 'Crop Profile Picture',
      uploadAvatar: 'Upload Profile Picture',
      removeAvatar: 'Remove Profile Picture',
      enable: 'Enable',
      disable: 'Disable',
    },
    
    status: {
      loading: 'Loading...',
      processing: 'Processing...',
      saving: 'Saving...',
      uploading: 'Uploading...',
      completed: 'Completed',
      failed: 'Failed',
      pending: 'Pending',
      queued: 'Queued',
      success: 'Success',
      error: 'Error',
      active: 'Active',
      archived: 'Archived',
      draft: 'Draft',
      loadingAccount: 'Loading your account...',
      loadingApplication: 'Loading application...',
    },
    
    form: {
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      firstName: 'First Name',
      lastName: 'Last Name',
      username: 'Username',
      name: 'Name',
      title: 'Title',
      description: 'Description',
      organization: 'Organization',
      location: 'Location',
      bio: 'Bio',
      optional: 'Optional',
      required: 'Required',
      department: 'Department',
      passwordConfirm: 'Confirm Password',
    },
    
    placeholders: {
      email: 'Enter your email',
      password: 'Enter your password',
      search: 'Search...',
      projectName: 'Enter project name',
      projectDescription: 'Enter project description',
      username: 'Enter your username',
      fullName: 'Enter your full name',
      organization: 'Enter your organization or institution',
      bio: 'Write a short bio about yourself',
      location: 'e.g. Prague, Czech Republic',
      title: 'e.g. Researcher, Professor',
      department: 'Enter your department',
    },
    
    messages: {
      saveSuccess: 'Changes saved successfully',
      deleteSuccess: 'Successfully deleted',
      updateSuccess: 'Successfully updated',
      uploadSuccess: 'Successfully uploaded',
      createSuccess: 'Created successfully',
      validationFailed: 'Validation failed',
      unauthorized: 'You are not authorized to perform this action',
      forbidden: 'Access forbidden',
      notFound: 'Not found',
      and: 'and',
      or: 'or',
      notSpecified: 'Not Specified',
      notProvided: 'Not provided',
    },
    
    labels: {
      yes: 'Yes',
      no: 'No',
      language: 'Language',
      theme: 'Theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
      date: 'Date',
      images: 'Images',
      files: 'Files',
      image: 'Image',
      lastChange: 'Last Change',
      lastUpdated: 'Last Updated',
      createdAt: 'Created',
      updatedAt: 'Last updated',
      sort: 'Sort',
      actions: 'Actions',
      status: 'Status',
      settings: 'Settings',
      profile: 'Profile',
      dashboard: 'Dashboard',
      welcome: 'Welcome to the Spheroid Segmentation Platform',
      account: 'Account',
      termsOfService: 'Terms of Service',
      privacyPolicy: 'Privacy Policy',
      termsOfServiceLink: 'Terms of Service',
      privacyPolicyLink: 'Privacy Policy',
      maxFileSize: 'Max file size: {{size}}MB',
      accepted: 'Accepted',
      imageOnly: '(Image files only)',
    },
  },

  // Authentication module
  auth: {
    titles: {
      signIn: 'Sign In',
      signUp: 'Create Account',
      forgotPassword: 'Reset Your Password',
      requestAccess: 'Request Access',
      alreadyLoggedIn: "You're already logged in",
    },
    
    actions: {
      signIn: 'Sign In',
      signUp: 'Sign Up',
      signOut: 'Sign Out',
      forgotPassword: 'Forgot Password?',
      resetPassword: 'Reset Password',
      createAccount: 'Create Account',
      requestAccess: 'Request Access',
      signInWithGoogle: 'Sign In with Google',
      signInWithGithub: 'Sign In with GitHub',
      resendVerification: 'Resend verification email',
      sendResetLink: 'Send New Password',
      backToSignIn: 'Back to Sign In',
    },
    
    labels: {
      email: 'Email address',
      password: 'Password',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      rememberMe: 'Remember me',
    },
    
    messages: {
      signingIn: 'Signing In...',
      signInSuccess: 'Signed in successfully',
      signOutSuccess: 'Signed out successfully',
      accountCreated: 'Account created successfully',
      passwordChanged: 'Password changed successfully',
      invalidCredentials: 'Invalid email or password',
      sessionExpired: 'Your session has expired. Please sign in again.',
      emailAlreadyExists: 'This email is already registered. Please use a different email or sign in.',
      passwordTooShort: 'Password must be at least 6 characters',
      emailRequired: 'Email is required',
      passwordRequired: 'Password is required',
      invalidEmail: 'Invalid email address',
      passwordsDontMatch: "Passwords don't match",
      currentPasswordIncorrect: 'Current password is incorrect',
      resetLinkSent: 'Password reset link sent to your email',
      resetSuccess: 'Password reset successfully',
      verifyEmail: 'Please verify your email address',
      verificationLinkSent: 'Verification link sent to your email',
      verificationSuccess: 'Email verified successfully',
      creatingAccount: 'Creating Account...',
      registerSuccess: 'Registration successful\! You can now sign in.',
      signUpFailed: 'Registration failed. Please try again.',
      signUpSuccessEmail: 'Registration successful! Please check your email or wait for admin approval.',
      emailHasPendingRequest: 'This email already has a pending access request. Please wait for approval.',
      passwordResetLinkSent: 'If an account exists for this email, a new password has been sent',
      passwordResetFailed: 'Failed to send new password. Please try again.',
      sendingResetLink: 'Sending new password...',
      alreadyLoggedInMessage: 'You are already logged in to your account',
      goToDashboardLink: 'Go to Dashboard',
    },
    
    descriptions: {
      signIn: 'Sign in to your account',
      signUp: 'Sign up for a new account',
      enterEmail: 'Enter your email address and we will send you a new password',
      checkYourEmail: 'Check your email for a new password',
      enterInfoCreateAccount: 'Enter your information to create an account',
      termsAndPrivacy: 'By signing up, you agree to our Terms of Service and Privacy Policy.',
    },
    
    questions: {
      dontHaveAccount: "Don't have an account?",
      alreadyHaveAccount: 'Already have an account?',
      alreadyHaveAccess: 'Already have access?',
      noAccount: "Don't have an account?",
    },
    
    placeholders: {
      email: 'Enter your email',
      password: 'Enter your password',
      firstName: 'e.g. John',
      lastName: 'e.g. Smith',
      confirmPassword: 'Confirm your password',
      enterEmail: 'Please enter your email address',
    },
  },

  // Request Access form
  requestAccess: {
    titles: {
      main: 'Request Access to Spheroid Segmentation Platform',
      thankYou: 'Thank you for your interest',
    },
    
    labels: {
      email: 'Your Email Address',
      name: 'Your Name',
      institution: 'Institution/Company',
      reason: 'Reason for Access',
    },
    
    actions: {
      submit: 'Submit Request',
      signIn: 'Sign In',
    },
    
    messages: {
      description: 'Fill out the following form to request access to our platform. We will review your request and contact you soon.',
      requestReceived: 'Request Received',
      weWillContact: 'We will review your request and contact you soon',
      submitSuccess: 'Request submitted successfully!',
      submitError: 'Failed to submit request',
      alreadyPending: 'An access request for this email is already pending',
      fillRequired: 'Please fill in all required fields',
      submittingRequest: 'Submitting Request...',
      agreeToTerms: 'By submitting this request, you agree to our',
      and: 'and',
    },
    
    placeholders: {
      email: 'Enter your email address',
      name: 'Enter your full name',
      institution: 'Enter your institution or company name',
      reason: 'Please describe how you plan to use the platform',
    },
    
    prompts: {
      signIn: 'Already have an account?',
    },
  },

  // Projects module
  projects: {
    titles: {
      page: 'Projects',
      create: 'Create Project',
      edit: 'Edit Project',
      delete: 'Delete Project',
      duplicate: 'Duplicate Project',
      share: 'Share Project',
      export: 'Export Project',
      duplicateProgress: 'Duplication Progress',
      duplicating: 'Duplicating Project',
    },
    
    labels: {
      name: 'Project Name',
      description: 'Project Description',
      status: 'Status',
      createdAt: 'Created',
      updatedAt: 'Last updated',
      imageCount: 'Images',
      newProjectTitle: 'New Project Title',
      copySegmentations: 'Copy segmentation results',
      resetImageStatus: 'Reset image processing status',
      untitledProject: 'Untitled Project',
      unknownProject: 'Unknown Project',
      itemsProcessed: 'items processed',
      items: 'items',
      activeTasks: 'Active',
      allTasks: 'All',
    },
    
    actions: {
      create: 'Create project',
      createNew: 'Create new project',
      edit: 'Edit project',
      delete: 'Delete project',
      view: 'View project',
      duplicate: 'Duplicate',
      share: 'Share',
      export: 'Export',
      search: 'Search projects...',
      filter: 'Filter projects',
      sort: 'Sort projects',
      retry: 'Retry',
    },
    
    messages: {
      loading: 'Loading projects...',
      creatingProject: 'Creating project...',
      created: 'Project created successfully',
      updated: 'Project updated successfully',
      deleted: 'Project deleted successfully',
      duplicated: 'Project duplicated successfully',
      notFound: 'Project not found',
      noProjects: 'No projects found',
      createFirst: 'Create your first project to get started',
      confirmDelete: 'Are you sure you want to delete this project?',
      confirmDeleteDescription: 'This action cannot be undone. All data associated with this project will be permanently deleted.',
      creationFailed: 'Failed to create project',
      deletionFailed: 'Failed to delete project',
      updateFailed: 'Failed to update project',
      duplicateFailed: 'Failed to duplicate project',
      loginRequired: 'You must be logged in to create a project',
      nameRequired: 'Project name is required',
      error: 'Error loading projects',
      deleting: 'Deleting project...',
      missingId: 'Cannot delete project: missing project identifier',
      typeToConfirm: 'Type the project name to confirm',
      confirmDeleteError: 'Please type the project name exactly to confirm',
      deleteWarning: 'You are about to delete the following project:',
      duplicating: 'Duplicating project...',
      duplicatingDescription: 'Your project is being duplicated. This may take a few moments.',
      duplicateProgressDescription: 'Your project is being duplicated. This process may take some time for large projects.',
      duplicationSuccessMessage: 'Project duplicated successfully! You can now access the new project.',
      duplicationCancelled: 'Project duplication cancelled',
      duplicationTaskFetchError: 'Error fetching task data',
      duplicationCancelError: 'Error cancelling duplication',
      duplicationCancellationFailed: 'Failed to cancel duplication',
      noActiveDuplications: 'No active duplications',
      noDuplications: 'No duplication tasks found',
    },
    
    descriptions: {
      page: 'Manage your research projects',
      create: 'Start a new research project',
      duplicate: 'Create a copy of this project including all images. You can customize the options below.',
      delete: 'This action will permanently delete the project and all associated data.',
      createDesc: 'Create a new project to start working with images and segmentation.',
    },
    
    placeholders: {
      name: 'Enter project name',
      description: 'Enter project description',
      search: 'Search projects...',
    },
    
    status: {
      active: 'Active',
      archived: 'Archived',
      completed: 'Completed',
      draft: 'Draft',
      pending: 'Pending',
      processing: 'Processing',
      failed: 'Failed',
      cancelled: 'Cancelled',
    },
    
    duplication: {
      pending: 'Pending',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
      complete: 'Project duplication completed',
    },
    
    detail: {
      noImagesSelected: 'No images selected',
      triggeringResegmentation: 'Triggering re-segmentation for {{count}} images...',
      deleteConfirmation: 'Are you sure you want to delete {{count}} images? This action cannot be undone.',
      deletingImages: 'Deleting {{count}} images...',
      deleteSuccess: 'Successfully deleted {{count}} images',
      deleteFailed: 'Failed to delete {{count}} images',
      preparingExport: 'Preparing export of {{count}} images...',
      loading: 'Loading project...',
      notFound: 'Project not found',
      error: 'Error loading project',
      empty: 'This project is empty',
      noImages: 'No images found in this project',
      addImages: 'Add images to get started',
      deleteProject: 'Delete Project',
      deleteConfirmation: 'Are you sure you want to delete the project "{{projectName}}"? This action cannot be undone.',
      duplicateProject: 'Duplicate Project',
      duplicateDescription: 'Create a copy of this project. The new project will be created with the name you provide below.',
      newProjectName: 'New Project Name',
      enterProjectName: 'Enter the new project name',
      duplicate: 'Duplicate',
      noImagesTitle: 'No Images Yet',
      noImagesDescription: "This project doesn't have any images yet. Upload images to get started.",
      uploadButton: 'Upload Images',
    },
    
    segmentation: {
      processingInBatches: 'Starting segmentation for {{count}} images in {{batches}} batches...',
      batchQueued: 'Batch {{current}}/{{total}} successfully queued',
      batchQueuedFallback: 'Batch {{current}}/{{total}} successfully queued (fallback endpoint)',
      batchError: 'Error processing batch {{current}}/{{total}}',
      partialSuccess: 'Segmentation: {{success}} images successfully queued, {{failed}} failed',
      allSuccess: 'Segmentation: All {{count}} images successfully queued',
      allFailed: 'Segmentation: All {{count}} images failed',
      startedImages: 'Segmentation started for {{count}} images',
      queuedLocallyWarning: 'Segmentation queued locally for {{count}} images. Server connection failed.'
    },
  },

  // Segmentation editor
  segmentation: {
    titles: {
      editor: 'Segmentation Editor',
      queue: 'Segmentation Queue',
      shortcuts: 'Keyboard Shortcuts',
      tips: 'Tips:',
    },
    
    contextMenu: {
      editPolygon: 'Edit polygon',
      splitPolygon: 'Split polygon',
      deletePolygon: 'Delete polygon',
      duplicateVertex: 'Duplicate vertex',
      deleteVertex: 'Delete vertex',
      confirmDeleteTitle: 'Are you sure you want to delete polygon?',
      confirmDeleteMessage: 'This action is irreversible. The polygon will be permanently removed from segmentation.',
    },
    
    modes: {
      view: 'View Mode',
      edit: 'Edit Mode',
      create: 'Create Mode',
      slice: 'Slice Mode',
      addPoints: 'Add Points Mode',
      deletePolygon: 'Delete Polygon Mode',
      createPolygon: 'Create Polygon Mode',
      editVertices: 'Edit Vertices Mode',
      editMode: 'Edit Mode',
      slicingMode: 'Slicing Mode',
      pointAddingMode: 'Point Adding Mode',
    },
    
    status: {
      processing: 'Processing',
      queued: 'Queued',
      completed: 'Completed',
      failed: 'Failed',
      pending: 'Pending',
      ready: 'Ready',
    },
    
    queue: {
      summary: '{{total}} tasks total ({{running}} processing, {{queued}} queued)',
      noRunningTasks: 'No running tasks',
      noQueuedTasks: 'No queued tasks',
      task: 'Task',
      statusRunning: 'Segmentation: {{count}} running{{queued}}',
      statusQueued: ', {{count}} queued',
      statusOnlyQueued: 'Segmentation: {{count}} queued',
      statusOnlyQueued_one: 'Segmentation: 1 queued',
      statusOnlyQueued_other: 'Segmentation: {{count}} queued',
      statusProcessing: 'Segmentation: {{count}} processing',
      tasksTotal: '{{total}} tasks total ({{running}} processing, {{queued}} queued)',
    },
    
    autoSave: {
      enabled: 'Auto-save: Enabled',
      disabled: 'Auto-save: Disabled',
      idle: 'Auto-save: Idle',
      pending: 'Pending...',
      saving: 'Saving...',
      success: 'Saved',
      error: 'Error',
    },
    
    messages: {
      loading: 'Loading segmentation...',
      saveSuccess: 'Segmentation saved successfully',
      resegmentSuccess: 'Resegmentation started successfully',
      resegmentComplete: 'Resegmentation completed successfully',
      resegmentError: 'Failed to resegment image',
      noData: 'No segmentation data available',
      noPolygons: 'No polygons found',
      polygonDeleted: 'Polygon successfully deleted',
      selectPolygonForEdit: 'Select a polygon to edit',
      selectPolygonForSlice: 'Select a polygon to slice',
      selectPolygonForAddPoints: 'Select a polygon to add points',
      clickToAddPoint: 'Click to add a point',
      clickToCompletePolygon: 'Click on the first point to complete the polygon',
      clickToAddFirstSlicePoint: 'Click to add the first slice point',
      clickToAddSecondSlicePoint: 'Click to add the second slice point',
      imageNotFound: 'Image not found',
      returnToProject: 'Return to project',
      backToProject: 'Back to project',
      completedSegmentation: 'Completed',
    },
    
    labels: {
      resolution: '{width}x{height}',
      totalPolygons: 'Total Polygons',
      totalVertices: 'Total Vertices',
      vertices: 'Vertices',
      zoom: 'Zoom',
      mode: 'Mode',
      selected: 'Selected',
      none: 'None',
      polygons: 'Polygons',
      polygon: 'Polygon',
      regions: 'Segmentation',
      position: 'Position',
      unsavedChanges: 'Unsaved changes',
    },
    
    actions: {
      previousImage: 'Previous image',
      nextImage: 'Next image',
      toggleShortcuts: 'Toggle shortcuts',
      resegmentButton: 'Resegment',
      resegmentButtonTooltip: 'Resegment with Neural Network',
    },
    
    modes: {
      polygonCreationMode: 'Polygon Creation Mode',
      polygonEditMode: 'Polygon Edit Mode',
      polygonSliceMode: 'Polygon Slice Mode',
      polygonAddPointsMode: 'Add Points Mode',
      viewMode: 'View Mode',
    },
    
    helpTips: {
      edit: {
        createPoint: 'Click to create a new point',
        shiftPoints: 'Hold Shift to automatically create a sequence of points',
        closePolygon: 'Close the polygon by clicking on the first point',
      },
      slice: {
        start: 'Click to start slice',
        finish: 'Click again to finish slice',
        cancel: 'Esc to cancel slicing',
      },
      addPoint: {
        hover: 'Hover over polygon line',
        click: 'Click to add point to selected polygon',
        exit: 'Esc to exit add mode',
      },
    },
  },

  // Documentation pages
  documentation: {
    titles: {
      main: 'SpheroSeg Documentation',
      tag: 'User Guide',
      sections: 'Sections',
    },
    
    sections: {
      introduction: 'Introduction',
      gettingStarted: 'Getting Started',
      uploadingImages: 'Uploading Images',
      segmentationProcess: 'Segmentation Process',
      apiReference: 'API Reference',
    },
    
    introduction: {
      title: 'Introduction',
      imageAlt: 'Illustration of spheroid analysis workflow',
      whatIs: {
        title: 'What is SpheroSeg?',
        paragraph1: 'SpheroSeg is a cutting-edge platform designed for the segmentation and analysis of cell spheroids in microscopic images. Our tool provides researchers with precise detection and analytical capabilities.',
        paragraph2: 'It utilizes advanced AI algorithms based on deep learning to automatically identify and segment spheroids in your images with high accuracy and consistency.',
        paragraph3: 'This documentation will guide you through all aspects of using the platform, from getting started to advanced features and API integration.',
      },
    },
    
    gettingStarted: {
      title: 'Getting Started',
      accountCreation: {
        title: 'Account Creation',
        paragraph1: 'To use SpheroSeg, you need to create an account. This allows us to securely store your projects and images.',
        step1Prefix: 'Visit the',
        step1Link: 'sign-up page',
        step2: 'Enter your institutional email address and create a password',
        step3: 'Complete your profile with your name and institution',
        step4: 'Verify your email address via the link sent to your inbox',
      },
      creatingProject: {
        title: 'Creating Your First Project',
        paragraph1: 'Projects help you organize your work. Each project can contain multiple images and their corresponding segmentation results.',
        step1: 'On your dashboard, click on "New Project"',
        step2: 'Enter a project name and description',
        step3: 'Select project type (default: Spheroid Analysis)',
        step4: 'Click "Create Project" to continue',
      },
    },
    
    uploadingImages: {
      title: 'Uploading Images',
      paragraph1: 'SpheroSeg supports various image formats commonly used in microscopy, including TIFF, PNG, and JPEG.',
      methods: {
        title: 'Upload Methods',
        paragraph1: 'There are several ways to upload images:',
        step1: 'Drag and drop files directly into the upload area',
        step2: 'Click on the upload area to browse and select files from your computer',
        step3: 'Batch upload multiple images at once',
      },
      note: {
        prefix: 'Note:',
        text: 'For optimal results, ensure your microscopy images have good contrast between the spheroid and background.',
      },
    },
    
    segmentationProcess: {
      title: 'Segmentation Process',
      paragraph1: 'The segmentation process identifies the boundaries of spheroids in your images, allowing for precise analysis of their morphology.',
      automatic: {
        title: 'Automatic Segmentation',
        paragraph1: 'Our AI-powered automatic segmentation can detect spheroid boundaries with high accuracy:',
        step1: 'Select an image from your project',
        step2: 'Click on "Auto-Segment" to initiate the process',
        step3: 'The system will process the image and display the detected boundaries',
        step4: 'Review the results in the segmentation editor',
      },
      manual: {
        title: 'Manual Adjustments',
        paragraph1: 'Sometimes automatic segmentation may require refinement. Our editor provides tools for:',
        step1: 'Adding or removing vertices along the boundary',
        step2: 'Adjusting vertex positions for more accurate boundaries',
        step3: 'Splitting or merging regions',
        step4: 'Adding or removing holes within spheroids',
      },
    },
    
    apiReference: {
      title: 'API Reference',
      paragraph1: "SpheroSeg offers a RESTful API for programmatic access to the platform's features. This is ideal for integration with your existing workflows or batch processing.",
      endpoint1Desc: 'Retrieves a list of all your projects',
      endpoint2Desc: 'Retrieves all images within a specific project',
      endpoint3Desc: 'Initiates segmentation for a specific image',
      contactPrefix: 'For full API documentation and authentication details, please contact us at',
    },
    
    navigation: {
      backToHome: 'Back to Home',
      backToTop: 'Back to Top',
    },
    
    subtitle: 'Learn how to use the Spheroid Segmentation Platform effectively.',
  },

  // Settings page
  settings: {
    titles: {
      page: 'Settings',
      profile: 'Profile Settings',
      account: 'Account Settings',
      security: 'Security Settings',
      appearance: 'Appearance Settings',
      language: 'Language Settings',
      theme: 'Theme Settings',
      privacy: 'Privacy Settings',
      accessibility: 'Accessibility Settings',
      advanced: 'Advanced Settings',
      display: 'Display Settings',
      preference: 'Preference Settings',
    },
    
    labels: {
      language: 'Language',
      theme: 'Theme',
      fullName: 'Full Name',
      username: 'Username',
      organization: 'Organization',
      department: 'Department',
      bio: 'Bio',
      location: 'Location',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm New Password',
      publicProfile: 'Public Profile',
      makeProfileVisible: 'Make my profile visible to other researchers',
      useBrowserLanguage: 'Use browser language',
      emailNotifications: 'Email Notifications',
      pushNotifications: 'Push Notifications',
      weeklyDigest: 'Weekly Digest',
      monthlyReport: 'Monthly Report',
      twoFactorAuth: 'Two-Factor Authentication',
      dangerZone: 'Danger Zone',
      password: 'Password',
      confirmUsername: 'Confirm your email',
      personal: 'Personal Information',
    },
    
    actions: {
      save: 'Save Changes',
      updateProfile: 'Update Profile',
      changePassword: 'Change Password',
      deleteAccount: 'Delete Account',
      uploadAvatar: 'Upload Profile Picture',
      removeAvatar: 'Remove Profile Picture',
      exportData: 'Export Data',
      importData: 'Import Data',
      savePreferences: 'Save Preferences',
      toggleTheme: 'Toggle theme',
    },
    
    messages: {
      saved: 'Settings saved successfully',
      profileUpdated: 'Profile updated successfully',
      passwordChanged: 'Password changed successfully',
      languageUpdated: 'Language updated successfully',
      themeUpdated: 'Theme updated successfully',
      profileLoadError: 'Failed to load profile',
      savingChanges: 'Saving changes...',
      usernameTaken: 'This username is already taken',
      passwordChangeError: 'Error changing password',
      passwordsDoNotMatch: 'Passwords do not match',
      accountDeleteSuccess: 'Account deleted successfully',
      accountDeleteError: 'Error deleting account',
      deletingAccount: 'Deleting account...',
    },
    
    descriptions: {
      appearance: 'Customize the appearance of the application',
      language: 'Choose your preferred language',
      theme: 'Choose your preferred theme',
      passwordSettings: 'Password Settings',
      changePassword: 'Change your password to keep your account secure',
      deleteAccount: 'This action is irreversible. All your data will be permanently deleted.',
      deleteAccountWarning: 'Once you delete your account, there is no going back. All your data will be permanently deleted.',
      dangerZone: 'These actions are irreversible and will permanently remove your data',
    },
    
    placeholders: {
      enterPassword: 'Enter your password',
    },
    
    theme: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
  },

  // Error messages
  errors: {
    titles: {
      generic: 'Something went wrong',
      notFound: 'Page not found',
      unauthorized: 'Unauthorized',
      forbidden: 'Access forbidden',
      server: 'Server error',
      componentError: 'An error occurred in this component',
    },
    
    messages: {
      generic: 'An error occurred',
      notFound: 'The page you requested could not be found',
      unauthorized: 'You are not authorized to access this resource',
      forbidden: 'Access to this resource is forbidden',
      network: 'Network error',
      timeout: 'Request timed out',
      validation: 'Validation error',
      unknown: 'Unknown error',
      fetchSegmentationFailed: 'Failed to fetch segmentation',
      fetchImageFailed: 'Failed to fetch image',
      saveSegmentationFailed: 'Failed to save segmentation',
      missingPermissions: 'Insufficient permissions',
      invalidInput: 'Invalid input',
      resourceNotFound: 'Resource not found',
      componentError: 'An error occurred in this component',
    },
    
    actions: {
      tryAgain: 'Try again',
      goBack: 'Go back',
      goHome: 'Go to home page',
      reloadPage: 'Reload Page',
      returnToHome: 'Return to Home',
    },
    
    labels: {
      errorDetails: 'Error Details',
    },
  },

  // Navigation
  navigation: {
    home: 'Home',
    projects: 'Projects',
    settings: 'Settings',
    profile: 'Profile',
    dashboard: 'Dashboard',
    back: 'Back',
    features: 'Features',
    documentation: 'Documentation',
    terms: 'Terms',
    privacy: 'Privacy',
    login: 'Sign In',
    requestAccess: 'Request Access',
  },

  // Dashboard
  dashboard: {
    titles: {
      overview: 'Dashboard Overview',
      statsOverview: 'Stats Overview',
      recentActivity: 'Recent Activity',
    },
    
    labels: {
      totalProjects: 'Total Projects',
      activeProjects: 'Active Projects',
      totalImages: 'Total Images',
      totalAnalyses: 'Total Analyses',
      completedSegmentations: 'Completed Segmentations',
      storageUsed: 'Storage Used',
      storageLimit: 'Storage Limit',
      lastUpdated: 'Last Updated',
      completion: 'completion rate',
      vsLastMonth: 'vs. last month',
      thisMonth: 'This Month',
      lastMonth: 'Last Month',
      projectsCreated: 'Projects Created',
      imagesUploaded: 'Images Uploaded',
      name: 'Name',
      sortBy: 'Sort by',
    },
    
    actions: {
      createNew: 'Create New Project',
      moreStats: 'View Detailed Statistics',
      hide: 'Hide',
      selectImages: 'Select Images',
    },
    
    messages: {
      manageProjects: 'Manage and organize your research projects',
      noProjects: 'No projects found',
      createFirst: 'Create your first project to get started',
      noProjectsDescription: 'You haven\'t created any projects yet. Create your first project to get started.',
      noImagesDescription: 'No images match your search criteria',
      fetchError: 'Failed to load statistics',
      noActivity: 'No recent activity',
    },
    
    placeholders: {
      searchProjects: 'Search projects by name...',
      searchImages: 'Search images...',
    },
    
    viewMode: {
      grid: 'Grid View',
      list: 'List View',
    },
    
    sort: {
      name: 'Name',
      updatedAt: 'Last Updated',
      segmentationStatus: 'Status',
    },
    
    status: {
      completed: 'Completed',
      processing: 'Processing',
      pending: 'Pending',
      failed: 'Failed',
    },
    
    activityTypes: {
      project_created: 'Created project',
      image_uploaded: 'Uploaded image',
      segmentation_completed: 'Completed segmentation',
    },
  },

  // Home/Hero page
  hero: {
    titles: {
      main: 'AI-powered Cell Analysis for Biomedical Research',
      welcome: 'Welcome to SpheroSeg',
      features: 'Powerful Features',
      cta: 'Ready to transform your cell analysis workflow?',
    },
    
    labels: {
      platformTag: 'Advanced Spheroid Segmentation Platform',
      featuresSubtitle: 'Advanced tools for biomedical research',
      ctaSubtitle: 'Join leading researchers already using our platform to accelerate their discoveries.',
      welcomeSubtitle: 'Advanced platform for cell spheroid segmentation and analysis',
    },
    
    actions: {
      getStarted: 'Get Started',
      learnMore: 'Learn More',
      createAccount: 'Create Account',
    },
    
    descriptions: {
      main: 'Elevate your microscopic cell image analysis with our cutting-edge spheroid segmentation platform. Designed for researchers seeking precision and efficiency.',
      welcome: 'Our platform combines cutting-edge artificial intelligence algorithms with an intuitive interface for precise detection and analysis of cell spheroids in microscopic images.',
    },
    
    features: {
      aiSegmentation: 'Advanced Segmentation',
      aiSegmentationDesc: 'Precise spheroid detection with boundary analysis for accurate cell measurements.',
      editing: 'AI-powered Analysis',
      editingDesc: 'Leverage deep learning algorithms for automated detection and cell classification.',
      analytics: 'Easy Uploading',
      analyticsDesc: 'Drag and drop your microscopy images for immediate processing and analysis.',
      export: 'Statistical Insights',
      exportDesc: 'Comprehensive metrics and visualizations for extracting meaningful data patterns.',
    },
    
    imageAlts: {
      hero1: 'Spheroid microscopy image',
      hero2: 'Spheroid microscopy image with analysis',
    },
  },

  // Features page
  features: {
    titles: {
      main: 'Discover Our Platform Capabilities',
      tag: 'Features',
    },
    
    labels: {
      subtitle: 'Advanced tools for biomedical research',
    },
    
    cards: {
      segmentation: {
        title: 'Advanced Segmentation',
        description: 'Precise spheroid detection with boundary analysis for accurate cell measurements',
      },
      aiAnalysis: {
        title: 'AI-powered Analysis',
        description: 'Leverage deep learning algorithms for automated cell detection and classification',
      },
      uploads: {
        title: 'Easy Uploading',
        description: 'Drag and drop your microscopy images for immediate processing and analysis',
      },
      insights: {
        title: 'Statistical Insights',
        description: 'Comprehensive metrics and visualizations to extract meaningful data patterns',
      },
      collaboration: {
        title: 'Team Collaboration',
        description: 'Share projects and results with colleagues for more efficient research',
      },
      pipeline: {
        title: 'Automated Pipeline',
        description: 'Streamline your workflow with our batch processing tools',
      },
    },
  },

  // About/Index page
  index: {
    about: {
      tag: 'About the Platform',
      title: 'What is SpheroSeg?',
      imageAlt: 'Spheroid segmentation example',
      paragraph1: 'SpheroSeg is an advanced platform specifically designed for the segmentation and analysis of cell spheroids in microscopic images.',
      paragraph2: 'Our tool combines cutting-edge artificial intelligence algorithms with an intuitive interface to provide researchers with precise spheroid boundary detection and analytical capabilities.',
      paragraph3: 'The platform was developed by Michal Průšek from FNSPE CTU in Prague under the supervision of Adam Novozámský from UTIA CAS, in collaboration with researchers from the Department of Biochemistry and Microbiology at UCT Prague.',
      contactPrefix: 'spheroseg@utia.cas.cz',
    },
    cta: {
      title: 'Ready to transform your research?',
      subtitle: 'Start using SpheroSeg today and discover new possibilities in cell spheroid analysis',
      boxTitle: 'Create a free account',
      boxText: 'Get access to all platform features and start analyzing your microscopy images',
      button: 'Create Account',
    },
  },

  // Footer
  footer: {
    labels: {
      developerName: 'Bc. Michal Průšek',
      facultyName: 'FNSPE CTU in Prague',
      description: 'Advanced platform for spheroid segmentation and analysis',
      contactLabel: 'spheroseg@utia.cas.cz',
      developerLabel: 'Bc. Michal Průšek',
      facultyLabel: 'FNSPE CTU in Prague',
      copyrightNotice: 'SpheroSeg. All rights reserved.',
      madeWith: 'Made with',
      by: 'by',
    },
    
    sections: {
      resources: 'Resources',
      legal: 'Legal Information',
      information: 'Information',
      contact: 'Contact',
    },
    
    links: {
      documentation: 'Documentation',
      features: 'Features',
      tutorials: 'Tutorials',
      research: 'Research',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      contactUs: 'Contact Us',
      requestAccess: 'Request Access',
    },
  },

  // Tools
  tools: {
    title: 'Tools',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetView: 'Reset View',
    createPolygon: 'Create New Polygon',
    exitPolygonCreation: 'Exit Polygon Creation Mode',
    splitPolygon: 'Split Polygon in Two',
    exitSlicingMode: 'Exit Slicing Mode',
    addPoints: 'Add Points to Polygon',
    exitPointAddingMode: 'Exit Point Adding Mode',
    undo: 'Undo',
    redo: 'Redo',
    save: 'Save',
    resegment: 'Resegment',
  },

  // Profile page
  profile: {
    titles: {
      page: 'User Profile',
      main: 'Profile',
      about: 'About',
      activity: 'Activity',
      projects: 'Projects',
      recentProjects: 'Recent Projects',
      recentAnalyses: 'Recent Analyses',
      accountDetails: 'Account Details',
      statistics: 'Statistics',
      recentActivity: 'Recent Activity',
      aboutMe: 'About Me',
    },
    
    labels: {
      title: 'Title',
      accountType: 'Account Type',
      joinDate: 'Join Date',
      lastActive: 'Last Active',
      projectsCreated: 'Projects Created',
      imagesUploaded: 'Images Uploaded',
      segmentationsCompleted: 'Completed Segmentations',
      joined: 'Joined',
      images: 'Images',
      analyses: 'Analyses',
      storageUsed: 'Storage Used',
      email: 'Email',
      username: 'Username',
      fullName: 'Full Name',
      organization: 'Organization',
      bio: 'Bio',
      location: 'Location',
      notProvided: 'Not provided',
    },
    
    actions: {
      editProfile: 'Edit Profile',
      saveProfile: 'Save Profile',
      uploadAvatar: 'Upload Profile Picture',
      removeAvatar: 'Remove Profile Picture',
      cropAvatar: 'Crop Profile Picture',
    },
    
    messages: {
      noRecentActivity: 'No recent activity',
      fetchError: 'Failed to load profile data',
      noBio: 'No bio provided',
      avatarHelp: 'Click the camera icon to upload a profile picture',
      avatarImageOnly: 'Please select an image file',
      avatarTooLarge: 'Image must be smaller than 5MB',
      avatarUpdated: 'Profile picture updated',
      avatarUploadError: 'Failed to upload profile picture',
      avatarRemoved: 'Profile picture removed',
      avatarRemoveError: 'Failed to remove profile picture',
      activityDescription: 'System activity',
    },
    
    descriptions: {
      page: 'Update your personal information and profile picture',
      cropAvatar: 'Adjust the cropping area to set your profile picture',
      bio: 'A brief description about you that will be visible on your profile',
    },
    
    placeholders: {
      username: 'Enter your username',
      fullName: 'Enter your full name',
      title: 'e.g. Researcher, Professor',
      organization: 'Enter your organization or institution',
      bio: 'Tell us about yourself',
      location: 'e.g. Prague, Czech Republic',
    },
  },

  // Terms of Service page
  termsPage: {
    title: 'Terms of Service',
    acceptance: {
      title: '1. Acceptance of Terms',
      paragraph1: 'By accessing or using SpheroSeg, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this service.',
    },
    useLicense: {
      title: '2. Use License',
      paragraph1: 'Permission is granted to temporarily use SpheroSeg for personal, non-commercial, or academic research purposes only. This is the grant of a license, not a transfer of title.',
    },
    dataUsage: {
      title: '3. Data Usage',
      paragraph1: 'All data uploaded to SpheroSeg remains your property. We do not claim ownership of your content, but we require certain permissions to provide the service.',
    },
    limitations: {
      title: '4. Limitations',
      paragraph1: 'In no event shall SpheroSeg be liable for any damages arising from the use or inability to use the platform, even if we have been advised of the possibility of such damage.',
    },
    revisions: {
      title: '5. Revisions and Errors',
      paragraph1: 'The materials appearing on SpheroSeg could include technical, typographical, or photographic errors. We do not warrant that any of the materials are accurate, complete or current.',
    },
    governingLaw: {
      title: '6. Governing Law',
      paragraph1: 'These terms shall be governed and construed in accordance with the laws of the country in which the service is hosted, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.',
    },
  },

  // Privacy Policy page
  privacyPage: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: July 1, 2023',
    introduction: {
      title: '1. Introduction',
      paragraph1: 'This Privacy Policy explains how SpheroSeg ("we", "us", "our") collects, uses, and shares your information when you use our spheroid segmentation and analysis platform.',
    },
    informationWeCollect: {
      title: '2. Information We Collect',
      paragraph1: 'We collect information that you directly provide to us when you create an account, upload images, create projects, and otherwise interact with our services.',
    },
    personalInformation: {
      title: '2.1 Personal Information',
      paragraph1: 'This includes your name, email address, institution/organization, and other information you provide when creating an account or requesting access to our services.',
    },
    researchData: {
      title: '2.2 Research Data',
      paragraph1: 'This includes images you upload, project details, analysis results, and other research-related data that you create or upload to our platform.',
    },
    usageInformation: {
      title: '2.3 Usage Information',
      paragraph1: 'We collect information about how you use our platform, including log data, device information, and usage patterns.',
    },
    howWeUse: {
      title: '3. How We Use Your Information',
      paragraph1: 'We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to fulfill our legal obligations.',
    },
    dataSecurity: {
      title: '4. Data Security',
      paragraph1: 'We implement appropriate security measures to protect your personal information and research data from unauthorized access, alteration, disclosure, or destruction.',
    },
    dataSharing: {
      title: '5. Data Sharing',
      paragraph1: 'We do not sell your personal information or research data. We may share your information under limited circumstances, such as with your consent, to fulfill legal obligations, or with service providers who help us operate our platform.',
    },
    yourChoices: {
      title: '6. Your Choices',
      paragraph1: 'You can access, update, or delete your account information and research data through your account settings. You may also contact us to request access, correction, or deletion of any personal information that we have about you.',
    },
    changes: {
      title: '7. Changes to this Policy',
      paragraph1: 'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.',
    },
    contactUs: {
      title: '8. Contact Us',
      paragraph1: 'If you have any questions about this Privacy Policy, please contact us at privacy@spheroseg.com.',
    },
  },

  // Keyboard shortcuts
  shortcuts: {
    titles: {
      main: 'Keyboard Shortcuts',
      button: 'Shortcuts',
    },
    
    labels: {
      viewMode: 'View Mode',
      editMode: 'Edit Mode',
      editVerticesMode: 'Edit Vertices Mode',
      sliceMode: 'Slice Mode',
      addPointsMode: 'Add Points Mode',
      createPolygonMode: 'Create Polygon Mode',
      holdShift: 'Hold Shift to auto-add points (in Edit Mode)',
    },
    
    actions: {
      editMode: 'Switch to Edit Mode',
      sliceMode: 'Switch to Slice Mode',
      addPointMode: 'Switch to Add Point Mode',
      undo: 'Undo',
      redo: 'Redo',
      deletePolygon: 'Delete selected polygon',
      cancel: 'Cancel current operation',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      resetView: 'Reset view',
      save: 'Save',
    },
    
    description: 'These shortcuts work within the segmentation editor for faster and more comfortable work.',
  },

  // Image processor
  imageProcessor: {
    messages: {
      segmentationStarted: 'Segmentation process has started...',
    },
    
    tooltips: {
      startSegmentation: 'Start Segmentation',
      processing: 'Processing...',
      saving: 'Saving...',
      completed: 'Segmentation completed',
      retry: 'Retry segmentation',
    },
  },

  // File uploader
  uploader: {
    titles: {
      uploadImages: 'Upload Images',
    },
    
    labels: {
      dragDrop: 'Drag and drop images here or click to select files',
      dropFiles: 'Drop files here...',
      segmentAfterUpload: 'Segment images immediately after upload',
      filesToUpload: 'Files to upload',
      selectProject: 'Select project',
      imageOnly: '(Image files only)',
      acceptedFormats: 'Supported formats: JPEG, PNG, TIFF, BMP (max 10MB)',
      currentProject: 'Current Project',
      autoSegment: 'Automatically segment images after upload',
    },
    
    actions: {
      upload: 'Upload',
      clickToUpload: 'Click to browse files',
      clickToSelect: 'Click to select files',
      uploadBtn: 'Upload {{count}} images',
    },
    
    messages: {
      uploadError: 'An error occurred during upload. Please try again.',
      noProjectsFound: 'No projects found. Create a new one first.',
      uploadingImages: 'Uploading images...',
      uploadComplete: 'Upload complete',
      uploadFailed: 'Upload failed',
      processingImages: 'Processing images...',
      dragAndDropFiles: 'Drag and drop files here',
      or: 'or',
      uploadProgress: 'Upload Progress',
      uploadingTo: 'Uploading to',
      uploadCompleted: 'Upload Completed',
      imagesUploaded: 'Images uploaded successfully',
      imagesFailed: 'Image upload failed',
      dropImagesHere: 'Drop images here...',
      selectProjectFirst: 'Please select a project first',
      projectRequired: 'You must select a project before uploading images',
      filesToUploadCount: 'Files to upload ({{count}})',
      noProjectsToUpload: 'No projects available. Create a project first.',
      notFound: 'Project "{{projectName}}" not found. It may have been deleted.',
    },
    
    placeholders: {
      selectProject: 'Select project...',
    },
  },

  // Image viewer/list
  images: {
    actions: {
      viewAnalyses: 'View Analyses',
      runAnalysis: 'Run Analysis',
      viewResults: 'View Results',
    },
    
    messages: {
      noAnalysesYet: 'No analyses yet',
    },
  },

  // Export functionality
  export: {
    titles: {
      main: 'Export Segmentation Data',
      spheroidMetrics: 'Spheroid Metrics',
      visualization: 'Visualization',
    },
    
    labels: {
      cocoFormat: 'COCO Format',
      selectImagesForExport: 'Select images for export',
    },
    
    actions: {
      close: 'Close',
    },
    
    messages: {
      exportCompleted: 'Export completed',
      exportFailed: 'Export failed',
      metricsExported: 'Metrics exported successfully',
    },
    
    options: {
      includeMetadata: 'Include metadata',
      includeSegmentation: 'Include segmentation',
      selectExportFormat: 'Select export format',
      includeObjectMetrics: 'Include object metrics',
      selectMetricsFormat: 'Select metrics format',
      includeImages: 'Include original images',
      exportMetricsOnly: 'Export metrics only',
      metricsRequireSegmentation: 'Exporting metrics requires completed segmentation',
      metricsFormatDescription: {
        EXCEL: 'Excel file (.xlsx)',
        CSV: 'CSV file (.csv)',
      },
    },
    
    formats: {
      COCO: "COCO JSON",
      YOLO: "YOLO TXT",
      MASK: 'Mask (TIFF)',
      POLYGONS: 'Polygons (JSON)',
    },
    
    formatDescriptions: {
      COCO: "Common Objects in Context (COCO) JSON format for object detection",
      YOLO: "You Only Look Once (YOLO) text format for object detection",
      MASK: "Binary mask images for each segmented object",
      POLYGONS: "Polygon coordinates in JSON format"
    },
    
    metricsFormats: {
      EXCEL: 'Excel (.xlsx)',
      CSV: 'CSV (.csv)',
    },
  },

  // Metrics
  metrics: {
    labels: {
      area: 'Area',
      perimeter: 'Perimeter',
      circularity: 'Circularity',
      sphericity: 'Sphericity',
      solidity: 'Solidity',
      compactness: 'Compactness',
      convexity: 'Convexity',
    },
    
    titles: {
      visualization: 'Metrics Visualization',
      keyMetricsComparison: 'Key Metrics Comparison',
      areaDistribution: 'Area Distribution',
      shapeMetricsComparison: 'Shape Metrics Comparison',
    },
    
    charts: {
      bar: 'Bar Chart',
      pie: 'Pie Chart',
      comparison: 'Comparison Chart',
    },
    
    messages: {
      visualizationHelp: 'Visual representation of metrics for all spheroids in this image',
      noPolygonsFound: 'No polygons found for analysis',
    },
  },

  // Image status
  imageStatus: {
    completed: 'Processed',
    processing: 'Processing',
    pending: 'Pending',
    failed: 'Failed',
    noImage: 'No image',
    untitledImage: 'Untitled image',
  },

  // Project actions
  projectActions: {
    tooltips: {
      duplicate: 'Duplicate project',
      delete: 'Delete project',
      makePrivate: 'Mark as private',
      makePublic: 'Mark as public',
      share: 'Share project',
      download: 'Download project',
    },
    
    messages: {
      deleteConfirmTitle: 'Are you sure?',
      deleteConfirmDesc: 'Are you sure you want to delete the project "{{projectName}}"? This action cannot be undone.',
      deleteSuccess: 'Project "{{projectName}}" has been successfully deleted.',
      deleteError: 'Project deletion failed.',
      duplicateSuccess: 'Project "{{projectName}}" has been successfully duplicated.',
      duplicateError: 'Project duplication failed.',
      notFound: 'Project "{{projectName}}" not found. It may have already been deleted.',
    },
  },

  // Editor
  editor: {
    tooltips: {
      back: 'Back to project overview',
      export: 'Export current segmentation data',
      save: 'Save changes',
      resegment: 'Run segmentation again on this image',
      exportMask: 'Export segmentation mask for this image',
      saving: 'Saving...',
    },
    
    labels: {
      image: 'Image',
      error: 'Error',
      success: 'Success',
      edit: 'Edit',
      create: 'Create',
    },
    
    actions: {
      previousImage: 'Previous image',
      nextImage: 'Next image',
      resegment: 'Resegment',
      exportMask: 'Export mask',
      back: 'Back',
      export: 'Export',
      save: 'Save',
    },
    
    messages: {
      loadingProject: 'Loading project...',
      loadingImage: 'Loading image...',
      sliceErrorInvalidPolygon: 'Cannot slice: Invalid polygon selected.',
      sliceWarningInvalidResult: 'Slicing created polygons that are too small and invalid.',
      sliceWarningInvalidIntersections: 'Invalid slice: Slice line must intersect the polygon at exactly two points.',
      sliceSuccess: 'Polygon successfully sliced.',
      noPolygonToSlice: 'No polygons available to slice.',
    },
  },

  // Segmentation page specific
  segmentationPage: {
    messages: {
      noImageSelected: 'No image selected for resegmentation.',
      resegmentationStarted: 'Starting resegmentation using ResUNet neural network...',
      resegmentationQueued: 'Resegmentation has been queued.',
      resegmentationCompleted: 'Resegmentation completed successfully.',
      resegmentationFailed: 'Resegmentation failed.',
      resegmentationTimeout: 'Resegmentation timed out. Check queue status.',
      resegmentationError: 'Failed to start resegmentation.',
    },
    
    tooltips: {
      resegment: 'Resegment',
    },
  },

  // Share functionality
  share: {
    titles: {
      main: 'Share Project',
      shareProject: 'Share project "{{projectName}}"',
    },
    
    labels: {
      accepted: 'Accepted',
      alreadyShared: 'Already shared with this user',
      canEdit: 'Can edit',
      email: 'Email',
      linkPermissions: 'Link permissions',
      noPermission: 'No permission',
      pendingAcceptance: 'Pending acceptance',
      permissions: 'Permissions',
      status: 'Status',
      userEmail: 'User email',
      view: 'View',
      viewOnly: 'View only',
      edit: 'Edit',
      sharedWith: 'Shared with',
    },
    
    actions: {
      copyToClipboard: 'Copy to clipboard',
      generateLink: 'Generate link',
      generateNewLink: 'Generate new link',
      invite: 'Invite',
      removeShare: 'Remove share',
      selectAccessLevel: 'Select access level',
    },
    
    messages: {
      failedToCopy: 'Failed to copy link',
      failedToGenerateLink: 'Failed to generate share link',
      failedToLoadShares: 'Failed to load shared users',
      failedToRemove: 'Failed to remove share',
      failedToShare: 'Failed to share project',
      generating: 'Generating...',
      invalidEmail: 'Invalid email address',
      invalidEmailOrPermission: 'Invalid email or permission',
      linkCopied: 'Link copied to clipboard',
      linkGenerated: 'Share link generated',
      noShares: 'No shared users',
      projectNotFound: 'Project not found',
      selectPermission: 'Please select a permission type',
      shareDescription: 'Share this project with other users',
      shareLinkDescription: 'Anyone with this link can access the project',
      sharing: 'Sharing...',
      sharedSuccess: 'Project "{{projectName}}" has been shared with {{email}}',
      removedSuccess: 'Share with {{email}} has been removed',
    },
    
    sections: {
      inviteByEmail: 'Invite by email',
      inviteByLink: 'Invite by link',
    },
  },

  // Project toolbar
  projectToolbar: {
    selectImages: 'Select Images',
    cancelSelection: 'Cancel Selection',
    export: 'Export',
    uploadImages: 'Upload Images',
  },

  // Accessibility
  accessibility: {
    skipToContent: 'Skip to main content',
  },
};