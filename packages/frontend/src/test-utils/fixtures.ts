import { 
  User, 
  Project, 
  Image, 
  Segmentation,
  Cell,
  AuthState,
  NotificationPreferences
} from '@/types';

/**
 * Test Fixtures
 * Pre-defined test data for common use cases
 */

// User fixtures
export const testUsers = {
  admin: {
    id: 'admin-123',
    email: 'admin@spheroseg.com',
    name: 'Admin User',
    organization: 'SpherosegV4',
    role: 'admin',
    avatar: '/avatars/admin.jpg',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    isApproved: true,
    storageUsed: 1073741824, // 1GB
    storageLimit: 10737418240, // 10GB
    lastLogin: '2024-01-15T10:00:00.000Z',
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        inApp: true,
      },
    },
  } as User,
  
  researcher: {
    id: 'researcher-456',
    email: 'researcher@university.edu',
    name: 'Dr. Jane Smith',
    organization: 'University Research Lab',
    role: 'researcher',
    avatar: '/avatars/jane.jpg',
    createdAt: '2024-01-05T00:00:00.000Z',
    updatedAt: '2024-01-20T00:00:00.000Z',
    isApproved: true,
    storageUsed: 5368709120, // 5GB
    storageLimit: 10737418240, // 10GB
    lastLogin: '2024-01-20T14:30:00.000Z',
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        push: false,
        inApp: true,
      },
    },
  } as User,
  
  guest: {
    id: 'guest-789',
    email: 'guest@example.com',
    name: 'Guest User',
    organization: 'Trial Account',
    role: 'user',
    avatar: null,
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
    isApproved: false,
    storageUsed: 0,
    storageLimit: 1073741824, // 1GB
    lastLogin: null,
    preferences: {
      theme: 'system',
      language: 'en',
      notifications: {
        email: false,
        push: false,
        inApp: true,
      },
    },
  } as User,
};

// Project fixtures
export const testProjects = {
  cancerResearch: {
    id: 'project-cancer-123',
    userId: testUsers.researcher.id,
    title: 'Breast Cancer Cell Analysis',
    description: 'Analysis of breast cancer cell morphology and proliferation patterns',
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-20T00:00:00.000Z',
    tags: ['cancer', 'breast', 'morphology', 'research'],
    public: false,
    imageCount: 150,
    collaborators: [
      {
        userId: testUsers.admin.id,
        email: testUsers.admin.email,
        name: testUsers.admin.name,
        role: 'viewer',
      },
    ],
    settings: {
      autoSegmentation: true,
      defaultAlgorithm: 'resunet',
      exportFormat: 'excel',
    },
  } as Project,
  
  stemCells: {
    id: 'project-stem-456',
    userId: testUsers.researcher.id,
    title: 'Stem Cell Differentiation Study',
    description: 'Tracking stem cell differentiation over time',
    createdAt: '2024-01-12T00:00:00.000Z',
    updatedAt: '2024-01-18T00:00:00.000Z',
    tags: ['stem-cells', 'differentiation', 'time-series'],
    public: true,
    imageCount: 75,
    collaborators: [],
    settings: {
      autoSegmentation: false,
      defaultAlgorithm: 'unet',
      exportFormat: 'csv',
    },
  } as Project,
  
  tutorial: {
    id: 'project-tutorial-789',
    userId: testUsers.admin.id,
    title: 'Tutorial Project',
    description: 'Sample project for new users to learn the platform',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: ['tutorial', 'sample', 'learning'],
    public: true,
    imageCount: 10,
    collaborators: [],
    settings: {
      autoSegmentation: true,
      defaultAlgorithm: 'resunet',
      exportFormat: 'csv',
    },
  } as Project,
};

// Image fixtures
export const testImages = {
  cancerCell1: {
    id: 'image-cancer-1',
    projectId: testProjects.cancerResearch.id,
    userId: testUsers.researcher.id,
    name: 'BC_Sample_001',
    filename: 'bc_sample_001.tif',
    originalFilename: 'breast_cancer_sample_001.tif',
    path: '/uploads/2024/01/bc_sample_001.tif',
    thumbnailPath: '/thumbnails/2024/01/bc_sample_001_thumb.jpg',
    fileSize: 5242880, // 5MB
    width: 2048,
    height: 2048,
    format: 'tiff',
    status: 'completed',
    segmentationStatus: 'completed',
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T01:00:00.000Z',
    metadata: {
      camera: 'Nikon Eclipse Ti2',
      magnification: 40,
      pixelSize: 0.65,
      channel: 'brightfield',
      staining: 'H&E',
      acquisitionDate: '2024-01-14T00:00:00.000Z',
      notes: 'Control sample from patient BC001',
    },
  } as Image,
  
  stemCell1: {
    id: 'image-stem-1',
    projectId: testProjects.stemCells.id,
    userId: testUsers.researcher.id,
    name: 'SC_Day0_001',
    filename: 'sc_day0_001.png',
    originalFilename: 'stem_cells_day0_001.png',
    path: '/uploads/2024/01/sc_day0_001.png',
    thumbnailPath: '/thumbnails/2024/01/sc_day0_001_thumb.jpg',
    fileSize: 2097152, // 2MB
    width: 1024,
    height: 1024,
    format: 'png',
    status: 'completed',
    segmentationStatus: 'pending',
    createdAt: '2024-01-12T00:00:00.000Z',
    updatedAt: '2024-01-12T00:00:00.000Z',
    metadata: {
      camera: 'Zeiss Axio Observer',
      magnification: 20,
      pixelSize: 1.3,
      channel: 'fluorescence',
      staining: 'DAPI',
      acquisitionDate: '2024-01-12T00:00:00.000Z',
      notes: 'Day 0 of differentiation protocol',
    },
  } as Image,
  
  tutorialImage: {
    id: 'image-tutorial-1',
    projectId: testProjects.tutorial.id,
    userId: testUsers.admin.id,
    name: 'Tutorial_Sample',
    filename: 'tutorial_sample.jpg',
    originalFilename: 'tutorial_sample.jpg',
    path: '/uploads/tutorial/tutorial_sample.jpg',
    thumbnailPath: '/thumbnails/tutorial/tutorial_sample_thumb.jpg',
    fileSize: 524288, // 512KB
    width: 512,
    height: 512,
    format: 'jpg',
    status: 'completed',
    segmentationStatus: 'completed',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    metadata: {
      camera: 'Sample Camera',
      magnification: 10,
      pixelSize: 2.6,
      channel: 'brightfield',
      staining: 'None',
      acquisitionDate: '2024-01-01T00:00:00.000Z',
      notes: 'Sample image for tutorial',
    },
  } as Image,
};

// Cell fixtures
export const testCells = {
  healthyCell: {
    id: 'cell-healthy-1',
    segmentationId: 'seg-1',
    index: 0,
    polygon: [
      [100, 100], [150, 100], [150, 150], [100, 150]
    ] as Array<[number, number]>,
    boundingBox: { x: 100, y: 100, width: 50, height: 50 },
    area: 2500,
    perimeter: 200,
    circularity: 0.785,
    sphericity: 0.886,
    solidity: 0.95,
    compactness: 0.785,
    convexity: 0.98,
    eccentricity: 0.1,
    majorAxis: 56.57,
    minorAxis: 56.57,
    orientation: 0,
    centroid: { x: 125, y: 125 },
    classification: {
      type: 'healthy',
      confidence: 0.95,
    },
    features: {
      intensity: {
        mean: 128,
        std: 15,
        min: 100,
        max: 160,
      },
      texture: {
        contrast: 25,
        homogeneity: 0.8,
        energy: 0.15,
        correlation: 0.85,
      },
    },
  } as Cell,
  
  cancerCell: {
    id: 'cell-cancer-1',
    segmentationId: 'seg-1',
    index: 1,
    polygon: [
      [200, 200], [280, 190], [300, 250], [250, 280], [190, 260]
    ] as Array<[number, number]>,
    boundingBox: { x: 190, y: 190, width: 110, height: 90 },
    area: 7850,
    perimeter: 314,
    circularity: 0.65,
    sphericity: 0.72,
    solidity: 0.82,
    compactness: 0.68,
    convexity: 0.89,
    eccentricity: 0.65,
    majorAxis: 112.5,
    minorAxis: 88.9,
    orientation: 25.5,
    centroid: { x: 245, y: 235 },
    classification: {
      type: 'cancer',
      confidence: 0.88,
    },
    features: {
      intensity: {
        mean: 165,
        std: 25,
        min: 120,
        max: 210,
      },
      texture: {
        contrast: 45,
        homogeneity: 0.6,
        energy: 0.08,
        correlation: 0.65,
      },
    },
  } as Cell,
};

// Segmentation fixtures
export const testSegmentations = {
  completed: {
    id: 'seg-completed-1',
    imageId: testImages.cancerCell1.id,
    projectId: testProjects.cancerResearch.id,
    userId: testUsers.researcher.id,
    name: 'Segmentation 1',
    modelType: 'resunet',
    modelVersion: 'v2.0',
    status: 'completed',
    createdAt: '2024-01-15T01:00:00.000Z',
    updatedAt: '2024-01-15T01:05:00.000Z',
    cellCount: 125,
    processingTime: 4500, // 4.5 seconds
    parameters: {
      threshold: 0.5,
      minArea: 50,
      maxArea: 5000,
      watershed: true,
      smoothing: true,
    },
    metrics: {
      accuracy: 0.945,
      precision: 0.932,
      recall: 0.958,
      f1Score: 0.945,
    },
    cells: [testCells.healthyCell, testCells.cancerCell],
    maskPath: '/masks/2024/01/seg_completed_1.png',
  } as Segmentation,
  
  processing: {
    id: 'seg-processing-1',
    imageId: testImages.stemCell1.id,
    projectId: testProjects.stemCells.id,
    userId: testUsers.researcher.id,
    name: 'Segmentation in Progress',
    modelType: 'unet',
    modelVersion: 'v1.1',
    status: 'processing',
    createdAt: '2024-01-20T10:00:00.000Z',
    updatedAt: '2024-01-20T10:00:00.000Z',
    cellCount: 0,
    processingTime: 0,
    parameters: {
      threshold: 0.45,
      minArea: 30,
      maxArea: 3000,
      watershed: false,
      smoothing: true,
    },
    cells: [],
  } as Segmentation,
  
  failed: {
    id: 'seg-failed-1',
    imageId: 'image-invalid',
    projectId: 'project-invalid',
    userId: testUsers.guest.id,
    name: 'Failed Segmentation',
    modelType: 'maskrcnn',
    modelVersion: 'v1.0',
    status: 'failed',
    createdAt: '2024-01-18T15:00:00.000Z',
    updatedAt: '2024-01-18T15:01:00.000Z',
    cellCount: 0,
    processingTime: 1000,
    parameters: {
      threshold: 0.5,
      minArea: 50,
      maxArea: 5000,
      watershed: true,
      smoothing: true,
    },
    cells: [],
    error: 'Invalid image format',
  } as Segmentation,
};

// Auth state fixtures
export const testAuthStates = {
  authenticated: {
    isAuthenticated: true,
    user: testUsers.researcher,
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    refreshToken: 'refresh_token_123',
    loading: false,
    error: null,
  } as AuthState,
  
  unauthenticated: {
    isAuthenticated: false,
    user: null,
    token: null,
    refreshToken: null,
    loading: false,
    error: null,
  } as AuthState,
  
  loading: {
    isAuthenticated: false,
    user: null,
    token: null,
    refreshToken: null,
    loading: true,
    error: null,
  } as AuthState,
  
  error: {
    isAuthenticated: false,
    user: null,
    token: null,
    refreshToken: null,
    loading: false,
    error: 'Invalid credentials',
  } as AuthState,
};

// Notification preferences fixtures
export const testNotificationPreferences = {
  allEnabled: {
    email: true,
    push: true,
    inApp: true,
    desktop: true,
    categories: {
      system: true,
      project: true,
      segmentation: true,
      export: true,
      collaboration: true,
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  } as NotificationPreferences,
  
  onlyInApp: {
    email: false,
    push: false,
    inApp: true,
    desktop: false,
    categories: {
      system: true,
      project: true,
      segmentation: true,
      export: true,
      collaboration: true,
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  } as NotificationPreferences,
  
  withQuietHours: {
    email: true,
    push: true,
    inApp: true,
    desktop: true,
    categories: {
      system: true,
      project: true,
      segmentation: true,
      export: true,
      collaboration: true,
    },
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
    },
  } as NotificationPreferences,
};

// API response fixtures
export const testApiResponses = {
  success: <T>(data: T) => ({
    success: true,
    data,
    message: 'Operation successful',
    timestamp: new Date().toISOString(),
  }),
  
  error: (message: string = 'An error occurred', status: number = 400) => ({
    success: false,
    error: message,
    status,
    timestamp: new Date().toISOString(),
  }),
  
  paginated: <T>(items: T[], page: number = 1, pageSize: number = 10) => ({
    success: true,
    data: {
      items,
      pagination: {
        page,
        pageSize,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / pageSize),
        hasNext: page < Math.ceil(items.length / pageSize),
        hasPrev: page > 1,
      },
    },
    timestamp: new Date().toISOString(),
  }),
};

// File upload fixtures
export const testFiles = {
  validImage: new File([''], 'test-image.png', { type: 'image/png' }),
  largeImage: Object.defineProperty(
    new File([''], 'large-image.tiff', { type: 'image/tiff' }),
    'size',
    { value: 50 * 1024 * 1024 } // 50MB
  ),
  invalidFile: new File([''], 'document.pdf', { type: 'application/pdf' }),
  corruptedImage: new File(['corrupted'], 'corrupted.jpg', { type: 'image/jpeg' }),
};

// Form data fixtures
export const testFormData = {
  loginForm: {
    email: 'test@example.com',
    password: 'password123',
    remember: true,
  },
  
  registerForm: {
    email: 'newuser@example.com',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    name: 'New User',
    organization: 'Test Organization',
    acceptTerms: true,
  },
  
  projectForm: {
    title: 'New Research Project',
    description: 'Description of the research project',
    tags: ['research', 'cells', 'analysis'],
    public: false,
  },
  
  profileForm: {
    name: 'Updated Name',
    organization: 'Updated Organization',
    bio: 'Updated bio information',
    preferredLanguage: 'en',
    theme: 'dark',
  },
};