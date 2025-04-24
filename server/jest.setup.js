// jest.setup.js
// This file can be used for global test setup

const { newDb } = require('pg-mem');
const { v4: uuidv4 } = require('uuid'); // Import uuid for generating IDs if needed

// --- Test Data IDs (Consider centralizing these) ---
// We need consistent IDs to check against in the mock query logic.
const MOCK_USER_ID = 'c1111111-1111-1111-1111-111111111111'; // Keeping this fixed for simplicity
const MOCK_VALID_PROJECT_ID = uuidv4(); // Use valid UUID
const MOCK_IMAGE_TO_DELETE_ID = uuidv4(); // Use valid UUID
const MOCK_NEW_IMAGE_ID = uuidv4(); // Use valid UUID
// ---

// Mock the 'pg' module BEFORE any code imports it
jest.mock('pg', () => {
  const db = newDb(); // pg-mem instance (can be used for more complex state if needed)
  
  const mockPool = {
    query: (query, params) => {
        const queryText = typeof query === 'string' ? query : query.text;
        const queryParams = typeof query === 'string' ? params : query.values;
        console.log('[pg Mock] Query:', queryText, queryParams);

        // Mock specific query responses needed by tests
        if (queryText.includes('SELECT id FROM projects WHERE id = $1 AND user_id = $2')) {
          if (queryParams && queryParams[0] === MOCK_VALID_PROJECT_ID && queryParams[1] === MOCK_USER_ID) {
            console.log('[pg Mock] Responding with valid project');
            return Promise.resolve({ rows: [{ id: MOCK_VALID_PROJECT_ID }], rowCount: 1 });
          } else {
             console.log('[pg Mock] Responding with project not found');
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
        }
        
        if (queryText.includes('SELECT * FROM images WHERE project_id = $1')) {
             if (queryParams && queryParams[0] === MOCK_VALID_PROJECT_ID) {
                 console.log('[pg Mock] Responding with images for project');
                 // Return some mock image data if needed for list tests
                 return Promise.resolve({ rows: [{id: uuidv4(), name: 'test.jpg', project_id: MOCK_VALID_PROJECT_ID }], rowCount: 1 });
             } else {
                 console.log('[pg Mock] Responding with no images for project');
                 return Promise.resolve({ rows: [], rowCount: 0 });
             }
         }

        if (queryText.includes('INSERT INTO images')) {
          console.log('[pg Mock] Responding with inserted image');
          const imageName = queryParams?.[2] || 'uploaded.jpg';
          const newImage = { 
            id: MOCK_NEW_IMAGE_ID, 
            project_id: queryParams?.[0], 
            user_id: queryParams?.[1], 
            name: imageName,
            storage_path: `/uploads/images/${queryParams?.[0]}/${MOCK_NEW_IMAGE_ID}.webp`,
            thumbnail_path: `/uploads/images/${queryParams?.[0]}/${MOCK_NEW_IMAGE_ID}_thumb.webp`,
            status: 'uploaded', 
            width: 100, height: 100, metadata: null, created_at: new Date(), updated_at: new Date() 
          };
          return Promise.resolve({ rows: [newImage], rowCount: 1 });
        }

        if (queryText.includes('SELECT i.id, i.storage_path, i.thumbnail_path FROM images i JOIN projects p')) { // DELETE check
          if(queryParams && queryParams[0] === MOCK_IMAGE_TO_DELETE_ID && queryParams[1] === MOCK_USER_ID) {
            console.log('[pg Mock] Responding with image to delete found');
            return Promise.resolve({ rows: [{id: MOCK_IMAGE_TO_DELETE_ID, storage_path: '/fake/storage/path', thumbnail_path: '/fake/thumb/path'}], rowCount: 1 });
          } else {
            console.log('[pg Mock] Responding with image to delete NOT found');
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
        }
        
        if (queryText.includes('DELETE FROM images WHERE id = $1')) { // Actual DELETE
             if (queryParams && queryParams[0] === MOCK_IMAGE_TO_DELETE_ID) {
                  console.log('[pg Mock] Responding to DELETE success');
                 return Promise.resolve({ rows: [], rowCount: 1 }); // Simulate successful delete
             } else {
                  console.log('[pg Mock] Responding to DELETE failure (wrong ID)');
                  return Promise.resolve({ rows: [], rowCount: 0 });
             }
         }

        // Default fallback for unhandled queries
        console.log('[pg Mock] Default fallback response (empty rows)');
        return Promise.resolve({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });
    },
    connect: jest.fn(() => console.log('[pg Mock] Connect called')),
    on: jest.fn(),
    end: jest.fn(() => console.log('[pg Mock] End called')),
  };
  return { Pool: jest.fn(() => mockPool) }; 
});

// --- Auth Mock User ID (Must match the ID used in the query mock above) ---
// const MOCK_AUTH_MIDDLEWARE_USER_ID = MOCK_USER_ID; // This line is redundant now
// ---

// Mock authMiddleware globally if needed by multiple test files
jest.mock('./src/middleware/authMiddleware', () => jest.fn((req, res, next) => {
  req.user = { userId: MOCK_USER_ID, email: 'test@example.com' }; // Use MOCK_USER_ID directly
  console.log(`[Auth Mock] Mocked user ${req.user.userId} for request.`);
  next();
}));

// Mock environment variables needed by the application during tests
process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:5432/testdb';
process.env.JWT_SECRET = 'test-secret';

// You can add other global setup here, e.g., global mocks

console.log('Jest setup: Environment variables and mocks configured.');

// Example: Mock environment variables if needed
// process.env.SOME_VARIABLE = 'test_value'; 

// --- Exports --- 
module.exports = {
    MOCK_USER_ID,
    MOCK_VALID_PROJECT_ID,
    MOCK_IMAGE_TO_DELETE_ID,
    MOCK_NEW_IMAGE_ID
}; 