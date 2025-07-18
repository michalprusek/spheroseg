import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import * as securityController from '../../controllers/securityController';
import * as securityService from '../../services/securityService';
import { ApiError } from '../../utils/errors';

// Mock services
jest.mock('../../services/securityService');

describe('Security Report API Controller', () => {
  // Common mocks
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.resetAllMocks();

    // Common mock response with jest spies for methods
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('getSecurityAuditReport', () => {
    it('successfully retrieves security audit report', async () => {
      // Mock security audit data
      const mockAuditReport = {
        generatedAt: '2023-06-15T10:00:00Z',
        summary: {
          criticalIssues: 2,
          highIssues: 5,
          mediumIssues: 8,
          lowIssues: 12,
          total: 27,
        },
        issues: [
          {
            id: 'issue-1',
            severity: 'critical',
            title: 'Insecure JWT secret',
            description: 'JWT secret is too short and not complex enough',
            remediation: 'Use a longer, more complex JWT secret',
            status: 'open',
            createdAt: '2023-06-10T14:30:00Z',
          },
          {
            id: 'issue-2',
            severity: 'critical',
            title: 'Outdated dependency with known vulnerability',
            description: 'package.json includes outdated dependency with CVE-2023-1234',
            remediation: 'Update to latest version of the dependency',
            status: 'open',
            createdAt: '2023-06-12T09:15:00Z',
          },
        ],
        complianceStatus: {
          gdpr: 'partial',
          hipaa: 'non-compliant',
          pci: 'not-applicable',
        },
      };

      // Set up mock to return the audit report
      (securityService.getSecurityAuditReport as jest.Mock).mockResolvedValue(mockAuditReport);

      // Mock request with admin user
      mockRequest = {
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.getSecurityAuditReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service was called
      expect(securityService.getSecurityAuditReport).toHaveBeenCalled();

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockAuditReport);
    });

    it('rejects non-admin users from accessing security audit report', async () => {
      // Mock request with regular user
      mockRequest = {
        user: { id: 'user-123', role: 'user' } as Express.User,
      };

      // Call the controller
      await securityController.getSecurityAuditReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
      expect(mockNext.mock.calls[0][0].message).toContain('admin');
    });
  });

  describe('getSecurityIssueById', () => {
    it('successfully retrieves security issue details', async () => {
      // Mock issue details
      const mockIssueDetails = {
        id: 'issue-1',
        severity: 'critical',
        title: 'Insecure JWT secret',
        description: 'JWT secret is too short and not complex enough',
        remediation: 'Use a longer, more complex JWT secret',
        status: 'open',
        createdAt: '2023-06-10T14:30:00Z',
        assignedTo: 'admin-123',
        affects: ['api', 'authentication'],
        technicalDetails: {
          impact: 'Potential token forgery and unauthorized access',
          cwe: 'CWE-321',
          affectedFiles: ['/app/src/config/jwt.ts', '/app/src/services/authService.ts'],
          vulnerableCode: 'const JWT_SECRET = "simple-secret"',
        },
        timeline: [
          {
            date: '2023-06-10T14:30:00Z',
            event: 'Issue detected in security scan',
          },
          {
            date: '2023-06-11T09:45:00Z',
            event: 'Issue validated by security team',
          },
          {
            date: '2023-06-11T10:30:00Z',
            event: 'Assigned to development team',
          },
        ],
      };

      // Set up mock to return the issue details
      (securityService.getSecurityIssueById as jest.Mock).mockResolvedValue(mockIssueDetails);

      // Mock request
      mockRequest = {
        params: { id: 'issue-1' },
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.getSecurityIssueById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service was called with correct id
      expect(securityService.getSecurityIssueById).toHaveBeenCalledWith('issue-1');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockIssueDetails);
    });

    it('handles issue not found errors', async () => {
      // Set up mock to throw not found error
      (securityService.getSecurityIssueById as jest.Mock).mockRejectedValue(
        new ApiError(404, 'Security issue not found')
      );

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.getSecurityIssueById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('rejects non-admin users from accessing security issue details', async () => {
      // Mock request with regular user
      mockRequest = {
        params: { id: 'issue-1' },
        user: { id: 'user-123', role: 'user' } as Express.User,
      };

      // Call the controller
      await securityController.getSecurityIssueById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('updateSecurityIssue', () => {
    it('successfully updates a security issue', async () => {
      // Mock update data
      const mockUpdateData = {
        status: 'in-progress',
        assignedTo: 'dev-123',
        comment: 'Working on implementing a more secure JWT secret',
      };

      // Mock updated issue
      const mockUpdatedIssue = {
        id: 'issue-1',
        severity: 'critical',
        title: 'Insecure JWT secret',
        status: 'in-progress',
        assignedTo: 'dev-123',
        updatedAt: '2023-06-15T11:30:00Z',
      };

      // Set up mock to return the updated issue
      (securityService.updateSecurityIssue as jest.Mock).mockResolvedValue(mockUpdatedIssue);

      // Mock request
      mockRequest = {
        params: { id: 'issue-1' },
        body: mockUpdateData,
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.updateSecurityIssue(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service was called with correct params
      expect(securityService.updateSecurityIssue).toHaveBeenCalledWith(
        'issue-1',
        mockUpdateData,
        'admin-123'
      );

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedIssue);
    });

    it('handles issue not found errors when updating', async () => {
      // Set up mock to throw not found error
      (securityService.updateSecurityIssue as jest.Mock).mockRejectedValue(
        new ApiError(404, 'Security issue not found')
      );

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        body: { status: 'resolved' },
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.updateSecurityIssue(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('handles validation errors when updating', async () => {
      // Set up mock to throw validation error
      (securityService.updateSecurityIssue as jest.Mock).mockRejectedValue(
        new ApiError(400, 'Invalid status value')
      );

      // Mock request with invalid status
      mockRequest = {
        params: { id: 'issue-1' },
        body: { status: 'invalid-status' },
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.updateSecurityIssue(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
    });

    it('rejects non-admin users from updating security issues', async () => {
      // Mock request with regular user
      mockRequest = {
        params: { id: 'issue-1' },
        body: { status: 'resolved' },
        user: { id: 'user-123', role: 'user' } as Express.User,
      };

      // Call the controller
      await securityController.updateSecurityIssue(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('getVulnerabilityScans', () => {
    it('successfully retrieves vulnerability scan history', async () => {
      // Mock scan history
      const mockScanHistory = {
        scans: [
          {
            id: 'scan-1',
            scanType: 'dependency',
            startTime: '2023-06-15T00:00:00Z',
            endTime: '2023-06-15T00:15:30Z',
            status: 'completed',
            issues: {
              critical: 2,
              high: 5,
              medium: 8,
              low: 12,
            },
          },
          {
            id: 'scan-2',
            scanType: 'code',
            startTime: '2023-06-14T00:00:00Z',
            endTime: '2023-06-14T00:22:15Z',
            status: 'completed',
            issues: {
              critical: 1,
              high: 3,
              medium: 10,
              low: 15,
            },
          },
          {
            id: 'scan-3',
            scanType: 'infrastructure',
            startTime: '2023-06-13T00:00:00Z',
            endTime: '2023-06-13T00:35:10Z',
            status: 'completed',
            issues: {
              critical: 0,
              high: 2,
              medium: 5,
              low: 8,
            },
          },
        ],
        pagination: {
          total: 3,
          page: 1,
          limit: 10,
        },
      };

      // Set up mock to return the scan history
      (securityService.getVulnerabilityScans as jest.Mock).mockResolvedValue(mockScanHistory);

      // Mock request with admin user
      mockRequest = {
        query: {},
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.getVulnerabilityScans(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service was called with default params
      expect(securityService.getVulnerabilityScans).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        scanType: undefined,
      });

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockScanHistory);
    });

    it('handles filtering and pagination parameters', async () => {
      // Set up mock return value (not important for this test)
      (securityService.getVulnerabilityScans as jest.Mock).mockResolvedValue({
        scans: [],
        pagination: { total: 0, page: 2, limit: 5 },
      });

      // Mock request with filters
      mockRequest = {
        query: {
          page: '2',
          limit: '5',
          scanType: 'code',
        },
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.getVulnerabilityScans(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service was called with filter params
      expect(securityService.getVulnerabilityScans).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        scanType: 'code',
      });
    });

    it('rejects non-admin users from accessing vulnerability scans', async () => {
      // Mock request with regular user
      mockRequest = {
        query: {},
        user: { id: 'user-123', role: 'user' } as Express.User,
      };

      // Call the controller
      await securityController.getVulnerabilityScans(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('getScanDetails', () => {
    it('successfully retrieves scan details', async () => {
      // Mock scan details
      const mockScanDetails = {
        id: 'scan-1',
        scanType: 'dependency',
        startTime: '2023-06-15T00:00:00Z',
        endTime: '2023-06-15T00:15:30Z',
        status: 'completed',
        issues: {
          critical: 2,
          high: 5,
          medium: 8,
          low: 12,
        },
        scanner: 'npm audit',
        scannerVersion: '2.0.0',
        scanDuration: 930, // 15m 30s in seconds
        detectedIssues: [
          {
            id: 'issue-1',
            severity: 'critical',
            title: 'Insecure JWT secret',
            component: 'jwt-config',
            location: '/app/src/config/jwt.ts:5',
          },
          {
            id: 'issue-2',
            severity: 'critical',
            title: 'Outdated dependency with known vulnerability',
            component: 'lodash@4.17.15',
            location: 'package.json',
          },
        ],
        configuration: {
          ignorePatterns: ['**/node_modules/**', '**/dist/**'],
          ignoredVulnerabilities: ['CVE-2022-5678'],
        },
      };

      // Set up mock to return the scan details
      (securityService.getScanById as jest.Mock).mockResolvedValue(mockScanDetails);

      // Mock request
      mockRequest = {
        params: { id: 'scan-1' },
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.getScanDetails(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service was called with correct id
      expect(securityService.getScanById).toHaveBeenCalledWith('scan-1');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockScanDetails);
    });

    it('handles scan not found errors', async () => {
      // Set up mock to throw not found error
      (securityService.getScanById as jest.Mock).mockRejectedValue(
        new ApiError(404, 'Scan not found')
      );

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        user: { id: 'admin-123', role: 'admin' } as Express.User,
      };

      // Call the controller
      await securityController.getScanDetails(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('rejects non-admin users from accessing scan details', async () => {
      // Mock request with regular user
      mockRequest = {
        params: { id: 'scan-1' },
        user: { id: 'user-123', role: 'user' } as Express.User,
      };

      // Call the controller
      await securityController.getScanDetails(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify permission error
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});
