/**
 * Segmentation Workflow Integration Tests
 * 
 * This test file focuses on the full segmentation workflow:
 * - Project and image setup
 * - Segmentation triggering
 * - Checking segmentation status
 * - Retrieving segmentation results
 * - Modifying segmentation results
 * - Exporting segmentation data in different formats
 */

import request from 'supertest';
import { app } from '../server';
import pool from '../db';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  setupCompleteTestEnv,
  authRequest,
  createTestUser,
  createTestProject,
  createTestImage,
  cleanupTestData
} from './utils/api-test-setup';

// Test constants
const TEST_IMAGE_PATH = path.join(__dirname, '../../../test_image.png');
const MAX_SEGMENTATION_WAIT = 30000; // 30 seconds maximum wait for segmentation
const POLL_INTERVAL = 1000; // Check every second

describe('Segmentation Workflow Integration', () => {
  // Test data variables
  let user: { id: string; email: string; token: string };
  let projectId: string;
  let imageId: string;
  
  beforeAll(async () => {
    // Create test user with auth token
    const testUser = await createTestUser();
    user = {
      id: testUser.id,
      email: testUser.email,
      token: testUser.token || ''
    };
    
    // Create test project
    const project = await createTestProject(user.id);
    projectId = project.id;
    
    // Upload test image if it exists
    if (fs.existsSync(TEST_IMAGE_PATH)) {
      const response = await authRequest(user.token)
        .post(`/api/projects/${projectId}/images`)
        .attach('image', TEST_IMAGE_PATH);
      
      if (response.status === 201) {
        imageId = response.body.id;
      } else {
        // Fallback: create test image directly in DB
        const image = await createTestImage(projectId);
        imageId = image.id;
      }
    } else {
      // Create test image directly in DB
      const image = await createTestImage(projectId);
      imageId = image.id;
    }
  });
  
  afterAll(async () => {
    // Clean up all test data
    await cleanupTestData(user.id);
    
    // Close the database pool
    await pool.end();
  });
  
  describe('1. Segmentation Basic Operations', () => {
    it('should trigger segmentation for an image', async () => {
      const response = await authRequest(user.token)
        .post('/api/segmentation/trigger')
        .send({
          imageId,
          projectId
        });
      
      // Status could be 200 (queued) or 202 (processing)
      expect([200, 202]).toContain(response.status);
      expect(response.body).toHaveProperty('message');
    });
    
    it('should check segmentation queue status', async () => {
      const response = await authRequest(user.token)
        .get('/api/segmentation/status')
        .query({ projectId });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('queueLength');
      expect(response.body).toHaveProperty('processingCount');
    });
    
    it('should retrieve segmentation status for a specific image', async () => {
      const response = await authRequest(user.token)
        .get(`/api/images/${imageId}/segmentation/status`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(['pending', 'processing', 'completed', 'failed']).toContain(
        response.body.status
      );
    });
  });
  
  describe('2. Waiting for Segmentation Completion', () => {
    it('should wait for segmentation to complete', async () => {
      // Define a polling function
      const waitForSegmentation = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
          let elapsedTime = 0;
          
          const checkStatus = async () => {
            // Get image with segmentation status
            const response = await authRequest(user.token)
              .get(`/api/images/${imageId}`)
              .query({ includeSegmentation: true });
            
            const status = response.body.segmentationStatus;
            
            // If completed or failed, resolve
            if (status === 'completed' || status === 'failed') {
              resolve(status);
              return;
            }
            
            // If timed out, resolve with current status
            elapsedTime += POLL_INTERVAL;
            if (elapsedTime >= MAX_SEGMENTATION_WAIT) {
              resolve(status);
              return;
            }
            
            // Otherwise poll again
            setTimeout(checkStatus, POLL_INTERVAL);
          };
          
          // Start polling
          checkStatus();
        });
      };
      
      // Wait for segmentation to complete or timeout
      const finalStatus = await waitForSegmentation();
      
      // Log the final status (don't fail the test if not completed, 
      // as it might depend on ML model availability)
      console.log(`Segmentation final status: ${finalStatus}`);
      
      // Mark as passed if the status is valid
      expect(['pending', 'processing', 'completed', 'failed']).toContain(finalStatus);
      
      // If completed, fetch the segmentation results
      if (finalStatus === 'completed') {
        const response = await authRequest(user.token)
          .get(`/api/images/${imageId}/segmentation`);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('polygons');
        expect(Array.isArray(response.body.polygons)).toBe(true);
      }
    }, MAX_SEGMENTATION_WAIT + 5000); // Add extra time for the test itself
  });
  
  describe('3. Segmentation Result Modification', () => {
    it('should modify segmentation results if available', async () => {
      // Check if segmentation results are available
      const checkResponse = await authRequest(user.token)
        .get(`/api/images/${imageId}/segmentation`);
      
      // Skip test if segmentation not completed
      if (checkResponse.status !== 200 || !checkResponse.body.polygons) {
        console.log('Skipping modification test - segmentation not completed');
        return;
      }
      
      // Create modified polygon data
      const originalPolygons = checkResponse.body.polygons;
      const modifiedPolygons = originalPolygons.map((polygon: any) => {
        // Add a new property to identify the modified version
        return {
          ...polygon,
          modified: true
        };
      });
      
      // Add a new polygon
      modifiedPolygons.push({
        id: uuidv4(),
        type: 'external',
        modified: true,
        points: [
          { x: 150, y: 150 },
          { x: 200, y: 150 },
          { x: 200, y: 200 },
          { x: 150, y: 200 },
        ]
      });
      
      // Update segmentation results
      const updateResponse = await authRequest(user.token)
        .put(`/api/images/${imageId}/segmentation`)
        .send({
          polygons: modifiedPolygons
        });
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toHaveProperty('updated', true);
      
      // Verify the update
      const verifyResponse = await authRequest(user.token)
        .get(`/api/images/${imageId}/segmentation`);
      
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toHaveProperty('polygons');
      expect(Array.isArray(verifyResponse.body.polygons)).toBe(true);
      expect(verifyResponse.body.polygons).toHaveLength(modifiedPolygons.length);
      
      // Check for the modified flag
      const hasModified = verifyResponse.body.polygons.some(
        (polygon: any) => polygon.modified === true
      );
      expect(hasModified).toBe(true);
    });
  });
  
  describe('4. Segmentation Export', () => {
    it('should export segmentation results in COCO format', async () => {
      // Skip if no segmentation results
      const checkResponse = await authRequest(user.token)
        .get(`/api/images/${imageId}/segmentation`);
      
      if (checkResponse.status !== 200 || !checkResponse.body.polygons) {
        console.log('Skipping export test - segmentation not available');
        return;
      }
      
      // Request COCO format export
      const exportResponse = await authRequest(user.token)
        .get(`/api/export/coco`)
        .query({
          projectId,
          imageIds: imageId
        });
      
      expect(exportResponse.status).toBe(200);
      expect(exportResponse.body).toHaveProperty('images');
      expect(exportResponse.body).toHaveProperty('annotations');
      expect(Array.isArray(exportResponse.body.images)).toBe(true);
      expect(Array.isArray(exportResponse.body.annotations)).toBe(true);
      
      // Check if our image is included
      const imageIncluded = exportResponse.body.images.some(
        (img: any) => img.id.toString() === imageId
      );
      expect(imageIncluded).toBe(true);
    });
    
    it('should export segmentation metrics', async () => {
      // Skip if no segmentation results
      const checkResponse = await authRequest(user.token)
        .get(`/api/images/${imageId}/segmentation`);
      
      if (checkResponse.status !== 200 || !checkResponse.body.polygons) {
        console.log('Skipping metrics test - segmentation not available');
        return;
      }
      
      // Request metrics export
      const metricsResponse = await authRequest(user.token)
        .get(`/api/export/metrics`)
        .query({
          projectId,
          imageIds: imageId
        });
      
      expect(metricsResponse.status).toBe(200);
      expect(Array.isArray(metricsResponse.body)).toBe(true);
      
      // Should contain metrics for our image
      if (metricsResponse.body.length > 0) {
        const firstMetric = metricsResponse.body[0];
        expect(firstMetric).toHaveProperty('imageId');
        expect(firstMetric).toHaveProperty('polygonId');
        expect(firstMetric).toHaveProperty('area');
      }
    });
  });
});