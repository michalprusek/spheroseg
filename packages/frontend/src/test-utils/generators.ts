import { faker } from '@faker-js/faker';
import { User, Project, Image, Segmentation, Cell } from '@/types';

/**
 * Test Data Generators
 * Generate realistic test data for testing
 */

// User generator
export function generateUser(overrides?: Partial<User>): User {
  return {
    id: faker.datatype.uuid(),
    email: faker.internet.email(),
    name: faker.name.fullName(),
    organization: faker.company.name(),
    role: faker.helpers.arrayElement(['user', 'admin', 'researcher']),
    avatar: faker.image.avatar(),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    isApproved: true,
    storageUsed: faker.datatype.number({ min: 0, max: 10737418240 }),
    storageLimit: 10737418240, // 10GB
    lastLogin: faker.date.recent().toISOString(),
    preferences: {
      theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
      language: faker.helpers.arrayElement(['en', 'cs', 'de', 'es', 'fr']),
      notifications: {
        email: faker.datatype.boolean(),
        push: faker.datatype.boolean(),
        inApp: faker.datatype.boolean(),
      },
    },
    ...overrides,
  };
}

// Project generator
export function generateProject(overrides?: Partial<Project>): Project {
  return {
    id: faker.datatype.uuid(),
    userId: faker.datatype.uuid(),
    title: faker.lorem.sentence(3),
    description: faker.lorem.paragraph(),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    tags: faker.helpers.arrayElements(['cancer', 'cells', 'research', 'analysis', 'microscopy'], 3),
    public: faker.datatype.boolean(),
    imageCount: faker.datatype.number({ min: 0, max: 100 }),
    collaborators: Array.from({ length: faker.datatype.number({ min: 0, max: 5 }) }, () => ({
      userId: faker.datatype.uuid(),
      email: faker.internet.email(),
      name: faker.name.fullName(),
      role: faker.helpers.arrayElement(['viewer', 'editor', 'admin']),
    })),
    settings: {
      autoSegmentation: faker.datatype.boolean(),
      defaultAlgorithm: faker.helpers.arrayElement(['resunet', 'unet', 'maskrcnn']),
      exportFormat: faker.helpers.arrayElement(['csv', 'json', 'excel']),
    },
    ...overrides,
  };
}

// Image generator
export function generateImage(overrides?: Partial<Image>): Image {
  const width = faker.datatype.number({ min: 512, max: 4096 });
  const height = faker.datatype.number({ min: 512, max: 4096 });
  
  return {
    id: faker.datatype.uuid(),
    projectId: faker.datatype.uuid(),
    userId: faker.datatype.uuid(),
    name: faker.system.fileName({ extensionCount: 0 }),
    filename: faker.system.fileName(),
    originalFilename: faker.system.fileName(),
    path: `/uploads/${faker.datatype.uuid()}/${faker.system.fileName()}`,
    thumbnailPath: `/thumbnails/${faker.datatype.uuid()}.jpg`,
    fileSize: faker.datatype.number({ min: 100000, max: 10000000 }),
    width,
    height,
    format: faker.helpers.arrayElement(['png', 'jpg', 'tiff', 'bmp']),
    status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
    segmentationStatus: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    metadata: {
      camera: faker.helpers.arrayElement(['Nikon D850', 'Canon EOS R5', 'Sony A7R IV']),
      magnification: faker.helpers.arrayElement([10, 20, 40, 60, 100]),
      pixelSize: faker.datatype.float({ min: 0.1, max: 2.0, precision: 0.01 }),
      channel: faker.helpers.arrayElement(['brightfield', 'fluorescence', 'phase-contrast']),
      staining: faker.helpers.arrayElement(['H&E', 'DAPI', 'GFP', 'None']),
      acquisitionDate: faker.date.recent().toISOString(),
      notes: faker.lorem.sentence(),
    },
    ...overrides,
  };
}

// Segmentation generator
export function generateSegmentation(overrides?: Partial<Segmentation>): Segmentation {
  const cellCount = faker.datatype.number({ min: 10, max: 500 });
  
  return {
    id: faker.datatype.uuid(),
    imageId: faker.datatype.uuid(),
    projectId: faker.datatype.uuid(),
    userId: faker.datatype.uuid(),
    name: `Segmentation ${faker.datatype.number({ min: 1, max: 100 })}`,
    modelType: faker.helpers.arrayElement(['resunet', 'unet', 'maskrcnn']),
    modelVersion: faker.helpers.arrayElement(['v1.0', 'v1.1', 'v2.0']),
    status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    cellCount,
    processingTime: faker.datatype.number({ min: 1000, max: 10000 }),
    parameters: {
      threshold: faker.datatype.float({ min: 0.1, max: 0.9, precision: 0.01 }),
      minArea: faker.datatype.number({ min: 10, max: 100 }),
      maxArea: faker.datatype.number({ min: 1000, max: 10000 }),
      watershed: faker.datatype.boolean(),
      smoothing: faker.datatype.boolean(),
    },
    metrics: {
      accuracy: faker.datatype.float({ min: 0.8, max: 0.99, precision: 0.01 }),
      precision: faker.datatype.float({ min: 0.8, max: 0.99, precision: 0.01 }),
      recall: faker.datatype.float({ min: 0.8, max: 0.99, precision: 0.01 }),
      f1Score: faker.datatype.float({ min: 0.8, max: 0.99, precision: 0.01 }),
    },
    cells: Array.from({ length: cellCount }, () => generateCell()),
    maskPath: `/masks/${faker.datatype.uuid()}.png`,
    ...overrides,
  };
}

// Cell generator
export function generateCell(overrides?: Partial<Cell>): Cell {
  const x = faker.datatype.number({ min: 0, max: 1000 });
  const y = faker.datatype.number({ min: 0, max: 1000 });
  const width = faker.datatype.number({ min: 20, max: 200 });
  const height = faker.datatype.number({ min: 20, max: 200 });
  
  return {
    id: faker.datatype.uuid(),
    segmentationId: faker.datatype.uuid(),
    index: faker.datatype.number({ min: 0, max: 1000 }),
    polygon: generatePolygon(x, y, width / 2),
    boundingBox: { x, y, width, height },
    area: faker.datatype.number({ min: 100, max: 10000 }),
    perimeter: faker.datatype.number({ min: 50, max: 500 }),
    circularity: faker.datatype.float({ min: 0.5, max: 1.0, precision: 0.01 }),
    sphericity: faker.datatype.float({ min: 0.5, max: 1.0, precision: 0.01 }),
    solidity: faker.datatype.float({ min: 0.7, max: 1.0, precision: 0.01 }),
    compactness: faker.datatype.float({ min: 0.5, max: 1.0, precision: 0.01 }),
    convexity: faker.datatype.float({ min: 0.8, max: 1.0, precision: 0.01 }),
    eccentricity: faker.datatype.float({ min: 0.0, max: 1.0, precision: 0.01 }),
    majorAxis: faker.datatype.number({ min: 20, max: 200 }),
    minorAxis: faker.datatype.number({ min: 10, max: 100 }),
    orientation: faker.datatype.float({ min: -90, max: 90, precision: 0.1 }),
    centroid: {
      x: x + width / 2,
      y: y + height / 2,
    },
    classification: {
      type: faker.helpers.arrayElement(['healthy', 'cancer', 'dead', 'dividing', 'unknown']),
      confidence: faker.datatype.float({ min: 0.7, max: 0.99, precision: 0.01 }),
    },
    features: {
      intensity: {
        mean: faker.datatype.float({ min: 0, max: 255, precision: 0.1 }),
        std: faker.datatype.float({ min: 0, max: 50, precision: 0.1 }),
        min: faker.datatype.number({ min: 0, max: 100 }),
        max: faker.datatype.number({ min: 150, max: 255 }),
      },
      texture: {
        contrast: faker.datatype.float({ min: 0, max: 100, precision: 0.1 }),
        homogeneity: faker.datatype.float({ min: 0, max: 1, precision: 0.01 }),
        energy: faker.datatype.float({ min: 0, max: 1, precision: 0.01 }),
        correlation: faker.datatype.float({ min: -1, max: 1, precision: 0.01 }),
      },
    },
    ...overrides,
  };
}

// Helper function to generate polygon points
function generatePolygon(centerX: number, centerY: number, radius: number): Array<[number, number]> {
  const numPoints = faker.datatype.number({ min: 8, max: 20 });
  const points: Array<[number, number]> = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const r = radius * (0.8 + Math.random() * 0.4); // Add some randomness
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    points.push([x, y]);
  }
  
  return points;
}

// Batch generators
export function generateUsers(count: number): User[] {
  return Array.from({ length: count }, () => generateUser());
}

export function generateProjects(count: number, userId?: string): Project[] {
  return Array.from({ length: count }, () => 
    generateProject(userId ? { userId } : undefined)
  );
}

export function generateImages(count: number, projectId?: string): Image[] {
  return Array.from({ length: count }, () => 
    generateImage(projectId ? { projectId } : undefined)
  );
}

export function generateSegmentations(count: number, imageId?: string): Segmentation[] {
  return Array.from({ length: count }, () => 
    generateSegmentation(imageId ? { imageId } : undefined)
  );
}

export function generateCells(count: number, segmentationId?: string): Cell[] {
  return Array.from({ length: count }, (_, index) => 
    generateCell(segmentationId ? { segmentationId, index } : { index })
  );
}

// Complex data structures
export function generateProjectWithImages(imageCount: number = 5): Project & { images: Image[] } {
  const project = generateProject();
  const images = generateImages(imageCount, project.id);
  
  return {
    ...project,
    images,
    imageCount,
  };
}

export function generateImageWithSegmentation(): Image & { segmentation: Segmentation } {
  const image = generateImage();
  const segmentation = generateSegmentation({ imageId: image.id });
  
  return {
    ...image,
    segmentation,
    segmentationStatus: 'completed',
  };
}

export function generateCompleteDataset() {
  const user = generateUser();
  const projects = generateProjects(3, user.id);
  const dataset = {
    user,
    projects: projects.map(project => {
      const images = generateImages(5, project.id);
      return {
        ...project,
        images: images.map(image => {
          const segmentation = generateSegmentation({ imageId: image.id });
          return {
            ...image,
            segmentation,
          };
        }),
      };
    }),
  };
  
  return dataset;
}

// API response generators
export function generateApiResponse<T>(data: T, success: boolean = true) {
  return {
    success,
    data,
    message: success ? 'Success' : faker.lorem.sentence(),
    timestamp: new Date().toISOString(),
  };
}

export function generatePaginatedResponse<T>(
  items: T[],
  page: number = 1,
  pageSize: number = 10,
  total?: number
) {
  const totalItems = total || items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    items: items.slice(start, end),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// Error generators
export function generateError(overrides?: Partial<Error>) {
  return {
    name: faker.helpers.arrayElement(['Error', 'ValidationError', 'NetworkError', 'AuthError']),
    message: faker.lorem.sentence(),
    stack: faker.lorem.paragraphs(3),
    ...overrides,
  };
}

export function generateApiError(status: number = 400) {
  return {
    status,
    error: faker.helpers.arrayElement(['Bad Request', 'Unauthorized', 'Not Found', 'Server Error']),
    message: faker.lorem.sentence(),
    details: faker.datatype.boolean() ? { field: faker.lorem.word(), reason: faker.lorem.sentence() } : undefined,
  };
}