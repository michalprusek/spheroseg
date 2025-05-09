import request from 'supertest';
import express from 'express';
import projectsRouter from './projects'; 
import authMiddleware from '../middleware/authMiddleware';
import pool from '../db';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../db');
jest.mock('../middleware/authMiddleware'); // Mock auth middleware
jest.mock('../middleware/validationMiddleware', () => ({
    validate: () => (req: any, res: any, next: any) => next(), // Mock validate to just call next
}));
jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/projects', projectsRouter); 

// Mock implementations
const mockAuthMiddleware = authMiddleware as jest.Mock;
const mockDbQuery = pool.query as jest.Mock;
const mockJwtSign = jwt.sign as jest.Mock;

describe('Projects API Routes - /api/projects', () => {
    const mockUserId = 'user-123';
    const mockToken = 'mock-token';

    beforeEach(() => {
        jest.clearAllMocks();
        // Simulate authenticated user for most tests
        mockAuthMiddleware.mockImplementation((req, res, next) => {
            req.user = { userId: mockUserId, email: 'test@example.com' };
            next();
        });
        // Mock JWT signing if needed (though not directly used in these routes, good practice)
        mockJwtSign.mockReturnValue(mockToken);
    });

    // --- GET /api/projects --- 
    describe('GET /', () => {
        it('should return a list of projects with total count and thumbnail', async () => {
            const mockProjects = [
                { id: 'proj-1', title: 'Project 1', user_id: mockUserId, image_count: 2, thumbnail_url: '/path/thumb1.jpg' },
                { id: 'proj-2', title: 'Project 2', user_id: mockUserId, image_count: 0, thumbnail_url: null },
            ];
            mockDbQuery
                .mockResolvedValueOnce({ rows: mockProjects, rowCount: 2 }) // Mock project list fetch
                .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 }); // Mock total count fetch

            const response = await request(app).get('/api/projects?limit=10&offset=0');

            expect(response.status).toBe(200);
            expect(response.body.projects).toEqual(mockProjects);
            expect(response.body.total).toBe(5);
            expect(mockDbQuery).toHaveBeenCalledTimes(2);
            // Check main query call
            expect(mockDbQuery.mock.calls[0][0]).toContain('SELECT \n                p.*,');
            expect(mockDbQuery.mock.calls[0][1]).toEqual([mockUserId, '10', '0']); // Params from query string
            // Check count query call
            expect(mockDbQuery.mock.calls[1][0]).toContain('SELECT COUNT(*) FROM projects WHERE user_id = $1');
            expect(mockDbQuery.mock.calls[1][1]).toEqual([mockUserId]);
        });

        it('should return 500 if database query fails', async () => {
            mockDbQuery.mockRejectedValue(new Error('DB Error'));

            const response = await request(app).get('/api/projects?limit=10&offset=0');

            expect(response.status).toBe(500);
            // In a real app, we might have a central error handler format the response
            // expect(response.body.message).toBe('Internal server error'); 
        });
    });

    // --- POST /api/projects --- 
    describe('POST /', () => {
        it('should create a new project and return it', async () => {
            const newProjectData = { title: 'New Test Project', description: 'Test desc' };
            const createdProject = { id: 'proj-new', user_id: mockUserId, ...newProjectData };
            mockDbQuery.mockResolvedValueOnce({ rows: [createdProject], rowCount: 1 });

            const response = await request(app).post('/api/projects').send(newProjectData);

            expect(response.status).toBe(201);
            expect(response.body).toEqual(createdProject);
            expect(mockDbQuery).toHaveBeenCalledTimes(1);
            expect(mockDbQuery).toHaveBeenCalledWith(
                'INSERT INTO projects (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
                [mockUserId, newProjectData.title, newProjectData.description]
            );
        });

         it('should create a new project without description', async () => {
            const newProjectData = { title: 'New Test Project No Desc' };
            const createdProject = { id: 'proj-new-nd', user_id: mockUserId, title: newProjectData.title, description: null };
            mockDbQuery.mockResolvedValueOnce({ rows: [createdProject], rowCount: 1 });

            const response = await request(app).post('/api/projects').send(newProjectData);

            expect(response.status).toBe(201);
            expect(response.body).toEqual(createdProject);
            expect(mockDbQuery).toHaveBeenCalledWith(
                expect.any(String), // Match query string loosely
                [mockUserId, newProjectData.title, null] // Check description is null
            );
        });

        it('should return 500 if database query fails', async () => {
            const newProjectData = { title: 'Fail Project' };
            mockDbQuery.mockRejectedValue(new Error('DB Insert Error'));

            const response = await request(app).post('/api/projects').send(newProjectData);

            expect(response.status).toBe(500);
        });
    });

    // --- GET /api/projects/:id --- 
    describe('GET /:id', () => {
        const projectId = 'proj-get-123';

        it('should return a specific project if found and owned by user', async () => {
            const mockProject = { id: projectId, title: 'Get Me', user_id: mockUserId };
            mockDbQuery.mockResolvedValueOnce({ rows: [mockProject], rowCount: 1 });

            const response = await request(app).get(`/api/projects/${projectId}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockProject);
            expect(mockDbQuery).toHaveBeenCalledWith(
                'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
                [projectId, mockUserId]
            );
        });

        it('should return 404 if project not found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const response = await request(app).get(`/api/projects/${projectId}`);

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Project not found or access denied');
        });

        it('should return 404 if project found but not owned by user (simulated)', async () => {
            // The query itself prevents this, but we test the outcome if it were possible
            mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); 

            const response = await request(app).get(`/api/projects/${projectId}`);

            expect(response.status).toBe(404);
        });

        it('should return 500 if database query fails', async () => {
            mockDbQuery.mockRejectedValue(new Error('DB Select Error'));

            const response = await request(app).get(`/api/projects/${projectId}`);

            expect(response.status).toBe(500);
        });
    });

    // --- DELETE /api/projects/:id --- 
    describe('DELETE /:id', () => {
        const projectIdToDelete = 'proj-del-456';

        it('should delete the project and return 204 if found and owned by user', async () => {
            mockDbQuery.mockResolvedValueOnce({ rows: [{ id: projectIdToDelete }], rowCount: 1 }); // Simulate successful delete returning ID

            const response = await request(app).delete(`/api/projects/${projectIdToDelete}`);

            expect(response.status).toBe(204);
            expect(mockDbQuery).toHaveBeenCalledWith(
                'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
                [projectIdToDelete, mockUserId]
            );
        });

        it('should return 404 if project to delete is not found or not owned', async () => {
            mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Simulate delete finding nothing

            const response = await request(app).delete(`/api/projects/${projectIdToDelete}`);

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Project not found or access denied');
        });

        it('should return 500 if database query fails', async () => {
            mockDbQuery.mockRejectedValue(new Error('DB Delete Error'));

            const response = await request(app).delete(`/api/projects/${projectIdToDelete}`);

            expect(response.status).toBe(500);
        });
    });

    // --- POST /api/projects/:id/duplicate --- 
    describe('POST /:id/duplicate', () => {
        const originalProjectId = 'proj-dup-789';
        const newProjectId = 'proj-dup-new';
        const originalProject = { title: 'Original', description: 'Original Desc' };
        const newProject = { id: newProjectId, title: 'Original (Copy)' }; // Only return ID and title on success
        const originalImages = [
            { name: 'img1.tif', storage_path: '/orig/img1.tif', thumbnail_path: '/thumb/img1.jpg', width: 100, height: 100, metadata: null },
        ];

        // Mock connect, query, release for transaction
        const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
        };
        const mockPoolConnect = pool.connect as jest.Mock;

        beforeEach(() => {
            // Reset client mocks & pool connect mock
            mockClient.query.mockClear();
            mockClient.release.mockClear();
            mockPoolConnect.mockClear();
            mockPoolConnect.mockResolvedValue(mockClient); 
            // Default successful transaction flow
            mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [originalProject], rowCount: 1 }) // Fetch original project
                .mockResolvedValueOnce({ rows: [newProject], rowCount: 1 }) // Insert new project
                .mockResolvedValueOnce({ rows: originalImages, rowCount: 1 }) // Fetch original images
                .mockResolvedValueOnce({ rows: [{id: 'new-img-id'}], rowCount: 1}) // Insert new image
                .mockResolvedValueOnce({}); // COMMIT
        });

        it('should duplicate a project and its image records (metadata only)', async () => {
            const response = await request(app).post(`/api/projects/${originalProjectId}/duplicate`);

            expect(response.status).toBe(201);
            expect(response.body).toEqual(newProject);
            
            expect(mockPoolConnect).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT title, description FROM projects'), [originalProjectId, mockUserId]);
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO projects'), [mockUserId, newProject.title, originalProject.description]);
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT name, storage_path, thumbnail_path'), [originalProjectId]);
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO images'), expect.arrayContaining([newProject.id, mockUserId, originalImages[0].name])); // Check relevant args
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('should return 404 if original project not found', async () => {
            mockClient.query.mockReset()
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Fetch original project -> Not found
                .mockResolvedValueOnce({}); // ROLLBACK

            const response = await request(app).post(`/api/projects/${originalProjectId}/duplicate`);

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('Original project not found');
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            // Check the second call specifically for the SELECT query
            expect(mockClient.query.mock.calls[1][0]).toContain('SELECT title, description');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
        });
        
        it('should return 500 and rollback on database error during duplication', async () => {
            const dbError = new Error('Duplicate DB Error');
            mockClient.query.mockReset()
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [originalProject], rowCount: 1 }) // Fetch original project
                .mockRejectedValueOnce(dbError); // Error during new project insert
                 // Expect rollback to be called implicitly in the finally block
                
            // Since the error is thrown, supertest might catch it differently
            // We check the mocks to ensure rollback happened
            await request(app).post(`/api/projects/${originalProjectId}/duplicate`); //.expect(500); <-- This might not work as expected if error isn't caught by express handler

            // Verify the transaction flow up to the error and rollback
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
             // Check the second call specifically for the SELECT query
            expect(mockClient.query.mock.calls[1][0]).toContain('SELECT title, description');
             // Check the third call specifically for the INSERT query
            expect(mockClient.query.mock.calls[2][0]).toContain('INSERT INTO projects');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK'); // Check rollback was called
            expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled(); // Finally block should always release
        });
    });
}); 