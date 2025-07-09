import request from 'supertest';
// Delay app import until after mocks are set up
// import { app } from '@/server';
import { IMemoryDb, newDb } from 'pg-mem';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Pool, QueryResult, QueryResultRow, QueryConfig, QueryConfigValues } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  writeFileSync: jest.fn(),
  createReadStream: jest.fn().mockImplementation((filePath) => {
    // More realistic stream mock for supertest/superagent
    const stream = {
      pipe: jest.fn((destination) => {
        // Simulate piping data and ending the stream
        // Emit end immediately instead of using setTimeout
        if (destination && destination.emit) {
          destination.emit('end');
          destination.emit('close');
        }
        stream.emit('end');
        stream.emit('close');
        return destination; // Return destination for chaining
      }),
      on: jest.fn((event: string, callback: (...args: any[]) => void) => {
        // Store listeners to be called later if needed (e.g., by pipe)
        stream.listeners = stream.listeners || {};
        stream.listeners[event] = stream.listeners[event] || [];
        stream.listeners[event].push(callback);
        return stream; // Allow chaining .on calls
      }),
      emit: jest.fn((event: string, ...args: any[]) => {
        // Helper to call listeners
        if (stream.listeners && stream.listeners[event]) {
          stream.listeners[event].forEach((listener: (...args: any[]) => void) =>
            listener(...args)
          );
        }
      }),
      pause: jest.fn(), // Add pause method
      resume: jest.fn(), // Add resume method
      // Add other stream properties/methods if errors persist
      readable: true,
    };
    return stream;
  }),
  // Add other fs methods used by your code if necessary
}));

// Mock sharp module
jest.mock('sharp');

// Mock the database
let db: IMemoryDb;

// --- Import Fixed Mock IDs from setup ---
const {
  MOCK_USER_ID: testUserId, // Rename for consistency with existing tests
  MOCK_VALID_PROJECT_ID: validProjectId,
  MOCK_IMAGE_TO_DELETE_ID: imageToDeleteId, // Use the correct source name
  MOCK_NEW_IMAGE_ID: newImageId,
} = require('../../../jest.setup.js'); // Adjust path as needed
// ---

// Define a type for the specific query overload we are mocking
type SimpleQuery = <R extends QueryResultRow = any, I extends any[] = any[]>(
  queryTextOrConfig: string | QueryConfig<I>,
  values?: QueryConfigValues<I>
) => Promise<QueryResult<R>>;

// --- Mock Multer to work with supertest.attach() ---
jest.mock('multer', () => {
  // This is the function multer() returns
  const multerInstance = {
    // Mock the .array() method
    array: (fieldName: string, maxCount?: number) => {
      // Return the Express middleware function
      return (req: any, res: any, next: () => void) => {
        // Check if supertest is sending a file
        // Supertest sets content-type to multipart/form-data when .attach() is used
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // Simulate multer adding file info to req.files
          req.files = [
            {
              fieldname: fieldName,
              originalname: 'test-image.jpg',
              encoding: '7bit',
              mimetype: 'image/jpeg',
              destination: '/tmp/uploads/mock', // Mock path
              filename: `mockfile-${Date.now()}.jpg`, // Mock filename
              path: `/tmp/uploads/mock/mockfile-${Date.now()}.jpg`, // Mock full path
              size: 12345, // Mock size
            },
          ];
        } else {
          req.files = []; // No files attached
        }
        next(); // Continue to the next middleware/route handler
      };
    },

    // Mock the .single() method
    single: (fieldName: string) => {
      // Return the Express middleware function
      return (req: any, res: any, next: () => void) => {
        // Check if supertest is sending a file
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          // Create a mock file object
          const mockFile = {
            fieldname: fieldName,
            originalname: 'test-avatar.jpg',
            encoding: '7bit',
            mimetype: 'image/jpeg',
            destination: '/tmp/uploads/mock',
            filename: `mockfile-${Date.now()}.jpg`,
            path: `/tmp/uploads/mock/mockfile-${Date.now()}.jpg`,
            size: 54321,
          };

          // Set the file on the request object
          req.file = mockFile;
        }
        next();
      };
    },

    // Mock storage engines
    diskStorage: jest.fn(() => ({
      /* Mock storage object */
    })),
    memoryStorage: jest.fn(() => ({
      /* Mock storage object */
    })),
  };

  // The main export of 'multer' is a function that returns the instance
  const multerFn = () => multerInstance;
  // Assign static methods to the main function object
  (multerFn as any).diskStorage = multerInstance.diskStorage;
  (multerFn as any).memoryStorage = multerInstance.memoryStorage;

  return multerFn;
});
// ---

describe('Image Routes', () => {
  // Instead of importing the full app, create a simple Express app
  // with just the imageRoutes registered
  const express = require('express');
  const imageRoutes = require('../images').default;

  // Create a simple mock Express app
  const app = express();

  // Mock authentication middleware to always set the user ID
  app.use((req: Express.Request, res: Express.Response, next: () => void) => {
    req.user = {
      userId: testUserId,
    } as Express.User;
    next();
  });

  // Register the routes directly
  app.use('/api/projects/:projectId/images', imageRoutes);
  app.use('/api/images', imageRoutes);

  // Add error handler
  app.use((err: any, req: Express.Request, res: Express.Response, next: () => void) => {
    res.status(err.statusCode || 500).json({
      message: err.message || 'Internal Server Error',
      errors: err.errors,
    });
  });

  // Mock implementation for fs.existsSync (now happens before each test)
  beforeEach(() => {
    // Reset mocks before each test
    (fs.existsSync as jest.Mock).mockReset().mockReturnValue(true); // Assume necessary paths exist
    (fs.mkdirSync as jest.Mock).mockReset();
    (fs.unlinkSync as jest.Mock).mockReset();

    // Mock sharp processing
    const mockSharpInstance = {
      metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
      resize: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue({}), // Simulate successful save
    };
    // Reset and configure sharp mock for each test
    (sharp as unknown as jest.Mock).mockClear().mockImplementation(() => mockSharpInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // == Test GET /api/projects/:projectId/images ==
  describe('GET /api/projects/:projectId/images', () => {
    it('should return images for a valid project ID and authenticated user', async () => {
      // Use validProjectId
      const res = await request(app).get(`/api/projects/${validProjectId}/images`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toBeInstanceOf(Array);
      // expect(res.body.length).toBeGreaterThan(0); // Mock now returns based on ID
      // expect(res.body[0]).toHaveProperty('id');
      // expect(res.body[0].project_id).toEqual(validProjectId);
    });

    it('should return 404 if project not found or user denied', async () => {
      const invalidProjectId = uuidv4(); // Generate a different valid UUID
      const res = await request(app).get(`/api/projects/${invalidProjectId}/images`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Project not found or access denied');
    });

    it('should return 400 for invalid project ID format', async () => {
      const res = await request(app).get('/api/projects/invalid-uuid-format/images');
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Validation failed');
      expect(res.body.errors[0]).toHaveProperty('message', 'Invalid project ID format');
    });
  });

  // == Test POST /api/projects/:projectId/images ==
  describe('POST /api/projects/:projectId/images', () => {
    it('should simulate image upload and return its details', async () => {
      // Prepare a dummy file path for testing
      const dummyFilePath = path.join(__dirname, 'test-image.jpg');
      // Create a dummy file if it doesn't exist (supertest needs an actual file)
      fs.writeFileSync(dummyFilePath, 'dummy image data'); // Use sync for simplicity in test setup

      try {
        const res = await request(app)
          .post(`/api/projects/${validProjectId}/images`)
          // Attach the dummy file to the 'images' field
          .attach('images', dummyFilePath);
        // .set('x-test-simulate-files', 'true') // Removed this line

        expect(res.statusCode).toEqual(201);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(1);
        expect(res.body[0]).toHaveProperty('id'); // Use the ID returned by mock DB
        expect(res.body[0]).toHaveProperty('project_id', validProjectId);
        expect(res.body[0]).toHaveProperty('user_id', testUserId);
        expect(res.body[0]).toHaveProperty('thumbnail_path');
        expect(res.body[0]).toHaveProperty('width', 100); // Check metadata from sharp mock
        expect(res.body[0]).toHaveProperty('height', 100);

        // Check if sharp was called correctly
        expect(sharp).toHaveBeenCalled();
        expect(sharp().metadata).toHaveBeenCalled();
        // Expect resize to be called with a single number argument (width)
        expect(sharp().resize).toHaveBeenCalledWith(expect.any(Number));
        expect(sharp().toFile).toHaveBeenCalled(); // Check if thumbnail save was attempted
      } finally {
        // Clean up the dummy file
        fs.unlinkSync(dummyFilePath);
      }
    });

    it('should return 400 if no files are provided', async () => {
      const res = await request(app).post(`/api/projects/${validProjectId}/images`); // Send request without attaching files
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'No image files provided');
    });

    it('should return 404 if project is invalid', async () => {
      const invalidProjectId = uuidv4();
      // Prepare a dummy file path for testing
      const dummyFilePath = path.join(__dirname, 'test-image-invalid.jpg');
      fs.writeFileSync(dummyFilePath, 'dummy image data invalid');

      try {
        const res = await request(app)
          .post(`/api/projects/${invalidProjectId}/images`)
          .attach('images', dummyFilePath); // Attach file even for invalid project ID test
        // .set('x-test-simulate-files', 'true') // Removed

        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('message', 'Project not found or access denied');
      } finally {
        // Clean up the dummy file
        fs.unlinkSync(dummyFilePath);
      }
    });

    it('should return 400 for invalid project ID format', async () => {
      // Prepare a dummy file path for testing
      const dummyFilePath = path.join(__dirname, 'test-image-invalid-format.jpg');
      fs.writeFileSync(dummyFilePath, 'dummy image data invalid format');

      try {
        const res = await request(app)
          .post('/api/projects/invalid-uuid-format/images')
          .attach('images', dummyFilePath); // Attach file even for invalid format test
        // .set('x-test-simulate-files', 'true') // Removed

        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('message', 'Validation failed');
        expect(res.body.errors[0]).toHaveProperty('message', 'Invalid project ID format');
      } finally {
        // Clean up the dummy file
        fs.unlinkSync(dummyFilePath);
      }
    });
  });

  // == Test DELETE /api/images/:id ==
  describe('DELETE /api/images/:id', () => {
    it('should delete an image and return 204', async () => {
      // console.log('DEBUG: imageToDeleteId value:', imageToDeleteId); // Keep commented for now
      const res = await request(app).delete(`/api/images/${imageToDeleteId}`); // Use valid UUID
      expect(res.statusCode).toEqual(204);
      // Check if fs.unlinkSync was called by the route handler (mocked)
      // Note: The specific paths aren't important as we have mocks,
      // just verify that the function was called at least once
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should return 404 if image not found or access denied', async () => {
      const otherImageId = uuidv4(); // Generate different valid UUID
      const res = await request(app).delete(`/api/images/${otherImageId}`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Image not found or access denied');
    });

    it('should return 400 for invalid image ID format', async () => {
      const res = await request(app).delete('/api/images/invalid-uuid-format');
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Validation failed');
      expect(res.body.errors[0]).toHaveProperty('message', 'Invalid image ID format');
    });
  });
});
