/**
 * Tests for Integration Test Utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  IntegrationTestEnvironment,
  ApiWorkflowTester,
  DatabaseIntegrationTester,
  PerformanceIntegrationTester,
} from '../integrationTestUtils';

describe('Integration Test Utilities', () => {
  describe('IntegrationTestEnvironment', () => {
    it('should initialize and teardown correctly', async () => {
      // Mock Express app
      const mockApp = {} as any;
      
      expect(() => IntegrationTestEnvironment.getApp()).toThrow('Integration test environment not initialized');
      
      await IntegrationTestEnvironment.setup(mockApp);
      expect(IntegrationTestEnvironment.getApp()).toBe(mockApp);
      
      await IntegrationTestEnvironment.teardown();
    });
  });

  describe('ApiWorkflowTester', () => {
    it('should create instance with mock app', () => {
      const mockApp = {} as any;
      const tester = new ApiWorkflowTester(mockApp);
      expect(tester).toBeInstanceOf(ApiWorkflowTester);
    });

    it('should handle test data management', () => {
      const mockApp = {} as any;
      const tester = new ApiWorkflowTester(mockApp);
      
      const testData = tester.getTestData();
      expect(testData).toBeInstanceOf(Map);
      
      tester.clearTestData();
      expect(tester.getTestData().size).toBe(0);
    });
  });

  describe('DatabaseIntegrationTester', () => {
    it('should create instance with mock database', () => {
      const mockDb = { query: jest.fn() };
      const tester = new DatabaseIntegrationTester(mockDb);
      expect(tester).toBeInstanceOf(DatabaseIntegrationTester);
    });
  });

  describe('PerformanceIntegrationTester', () => {
    it('should create instance with mock app', () => {
      const mockApp = {} as any;
      const tester = new PerformanceIntegrationTester(mockApp);
      expect(tester).toBeInstanceOf(PerformanceIntegrationTester);
    });

    it('should collect and report performance metrics', () => {
      const mockApp = {} as any;
      const tester = new PerformanceIntegrationTester(mockApp);
      
      const report = tester.getPerformanceReport();
      expect(typeof report).toBe('object');
    });
  });
});