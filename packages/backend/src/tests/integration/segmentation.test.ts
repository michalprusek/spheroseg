/**
 * Integrační testy pro segmentaci
 *
 * Tyto testy ověřují celý proces segmentace:
 * - Nahrání obrázku
 * - Spuštění segmentace
 * - Získání výsledku segmentace
 * - Úprava segmentace
 * - Export segmentace
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import app from '../../app';
import pool from '../../db';
import { createTestUser, createTestProject, cleanupTestData } from '../helpers/testSetup';

// Testovací data
const TEST_IMAGE_PATH = path.join(__dirname, '../fixtures/test-image.png');
let testUserId: string;
let testProjectId: string;
let testImageId: string;
let authToken: string;

// Nastavení před testy
beforeAll(async () => {
  // Vytvoření testovacího uživatele
  const userData = await createTestUser();
  testUserId = userData.userId;
  authToken = userData.token;

  // Vytvoření testovacího projektu
  testProjectId = await createTestProject(testUserId, {
    title: 'Test Project',
    description: 'Test project description',
    public: false
  });
});

// Úklid po testech
afterAll(async () => {
  await cleanupTestData([testUserId], [testProjectId]);
  await pool.closePool();
});

describe('Segmentation Integration Tests', () => {
  // Test nahrání obrázku
  test('should upload an image to a project', async () => {
    // Kontrola existence testovacího obrázku
    expect(fs.existsSync(TEST_IMAGE_PATH)).toBe(true);

    // Nahrání obrázku
    const response = await request(app)
      .post(`/api/v1/projects/${testProjectId}/images`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('images', TEST_IMAGE_PATH);

    // Kontrola odpovědi
    expect(response.status).toBe(201);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(1);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('name');
    expect(response.body[0]).toHaveProperty('storage_path');

    // Uložení ID obrázku pro další testy
    testImageId = response.body[0].id;
  });

  // Test spuštění segmentace
  test('should trigger segmentation for an image', async () => {
    // Kontrola existence testovacího obrázku
    expect(testImageId).toBeDefined();

    // Spuštění segmentace
    const response = await request(app)
      .post(`/api/v1/segmentation/trigger`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        imageIds: [testImageId],
        priority: 5,
        model_type: 'resunet',
      });

    // Kontrola odpovědi
    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('triggered');
    expect(response.body).toHaveProperty('queueStatus');
    expect(response.body.triggered).toContain(testImageId);
  });

  // Test získání stavu fronty
  test('should get segmentation queue status', async () => {
    // Získání stavu fronty
    const response = await request(app)
      .get(`/api/v1/segmentation/queue`)
      .set('Authorization', `Bearer ${authToken}`);

    // Kontrola odpovědi
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('pendingTasks');
    expect(response.body).toHaveProperty('runningTasks');
    expect(response.body).toHaveProperty('queueLength');
    expect(response.body).toHaveProperty('activeTasksCount');
    expect(response.body).toHaveProperty('timestamp');
  });

  // Test získání výsledku segmentace
  test('should get segmentation result for an image', async () => {
    // Kontrola existence testovacího obrázku
    expect(testImageId).toBeDefined();

    // Čekání na dokončení segmentace (max 30 sekund)
    let segmentationCompleted = false;
    let attempts = 0;
    let segmentationResult = null;

    while (!segmentationCompleted && attempts < 30) {
      // Získání výsledku segmentace
      const response = await request(app)
        .get(`/api/v1/images/${testImageId}/segmentation`)
        .set('Authorization', `Bearer ${authToken}`);

      // Kontrola stavu segmentace
      if (response.status === 200 && response.body && response.body.status === 'completed') {
        segmentationCompleted = true;
        segmentationResult = response.body;
      } else {
        // Čekání 1 sekundu před dalším pokusem
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    // Kontrola výsledku segmentace
    expect(segmentationCompleted).toBe(true);
    expect(segmentationResult).not.toBeNull();
    expect(segmentationResult).toHaveProperty('image_id', testImageId);
    expect(segmentationResult).toHaveProperty('status', 'completed');
    expect(segmentationResult).toHaveProperty('result_data');
    expect(segmentationResult.result_data).toHaveProperty('polygons');
    expect(segmentationResult.result_data.polygons).toBeInstanceOf(Array);
  });

  // Test úpravy segmentace
  test('should update segmentation result for an image', async () => {
    // Kontrola existence testovacího obrázku
    expect(testImageId).toBeDefined();

    // Získání aktuálního výsledku segmentace
    const getResponse = await request(app)
      .get(`/api/v1/images/${testImageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`);

    // Kontrola odpovědi
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty('result_data');
    expect(getResponse.body.result_data).toHaveProperty('polygons');

    // Vytvoření upraveného výsledku segmentace
    const originalPolygons = getResponse.body.result_data.polygons;
    const updatedPolygons = [...originalPolygons];

    // Přidání nového polygonu
    updatedPolygons.push({
      id: uuidv4(),
      points: [
        [100, 100],
        [200, 100],
        [200, 200],
        [100, 200],
      ],
      type: 'external',
      class: 'spheroid',
    });

    // Aktualizace výsledku segmentace
    const updateResponse = await request(app)
      .put(`/api/v1/images/${testImageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        result_data: {
          polygons: updatedPolygons,
        },
        status: 'completed',
      });

    // Kontrola odpovědi
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty('message', 'Segmentation updated successfully');

    // Ověření aktualizace
    const verifyResponse = await request(app)
      .get(`/api/v1/images/${testImageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`);

    // Kontrola odpovědi
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body).toHaveProperty('result_data');
    expect(verifyResponse.body.result_data).toHaveProperty('polygons');
    expect(verifyResponse.body.result_data.polygons.length).toBe(updatedPolygons.length);
  });

  // Test exportu segmentace
  test('should export segmentation result in COCO format', async () => {
    // Kontrola existence testovacího obrázku
    expect(testImageId).toBeDefined();

    // Export segmentace
    const response = await request(app)
      .post(`/api/v1/projects/${testProjectId}/export`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        format: 'COCO',
        imageIds: [testImageId],
      });

    // Kontrola odpovědi
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('info');
    expect(response.body).toHaveProperty('images');
    expect(response.body).toHaveProperty('annotations');
    expect(response.body).toHaveProperty('categories');
    expect(response.body.images.length).toBe(1);
    expect(response.body.images[0]).toHaveProperty('id');
    expect(response.body.images[0]).toHaveProperty('file_name');
    expect(response.body.annotations.length).toBeGreaterThan(0);
  });

  // Test zrušení segmentace
  test('should cancel segmentation for an image', async () => {
    // Vytvoření nového testovacího obrázku
    const uploadResponse = await request(app)
      .post(`/api/v1/projects/${testProjectId}/images`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('images', TEST_IMAGE_PATH);

    // Kontrola odpovědi
    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body).toBeInstanceOf(Array);
    expect(uploadResponse.body.length).toBe(1);

    const newImageId = uploadResponse.body[0].id;

    // Spuštění segmentace
    const triggerResponse = await request(app)
      .post(`/api/v1/segmentation/trigger`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        imageIds: [newImageId],
        priority: 1,
        model_type: 'resunet',
      });

    // Kontrola odpovědi
    expect(triggerResponse.status).toBe(202);
    expect(triggerResponse.body.triggered).toContain(newImageId);

    // Zrušení segmentace
    const cancelResponse = await request(app)
      .delete(`/api/v1/segmentation/cancel/${newImageId}`)
      .set('Authorization', `Bearer ${authToken}`);

    // Kontrola odpovědi
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body).toHaveProperty('message', 'Segmentation cancelled successfully');

    // Ověření zrušení
    const verifyResponse = await request(app)
      .get(`/api/v1/images/${newImageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`);

    // Kontrola odpovědi
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body).toHaveProperty('status', 'cancelled');
  });
});
