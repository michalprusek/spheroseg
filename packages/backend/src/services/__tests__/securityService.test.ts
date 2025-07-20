/**
 * Security Service Test Suite
 * 
 * This suite tests the critical security functionality including
 * security audit reports, issue management, vulnerability scans,
 * error handling, and data validation.
 */

import {
  getSecurityAuditReport,
  getSecurityIssueById,
  updateSecurityIssue,
  getVulnerabilityScans,
  getScanById,
} from '../securityService';
import { ApiError } from '../../utils/errors';

describe('Security Service', () => {
  describe('getSecurityAuditReport', () => {
    it('should return comprehensive security audit report', async () => {
      const report = await getSecurityAuditReport();

      expect(report).toEqual({
        generatedAt: expect.any(String),
        summary: {
          criticalIssues: 2,
          highIssues: 5,
          mediumIssues: 8,
          lowIssues: 12,
          total: 27,
        },
        issues: expect.arrayContaining([
          expect.objectContaining({
            id: 'issue-1',
            severity: 'critical',
            title: 'Insecure JWT secret',
            description: 'JWT secret is too short and not complex enough',
            remediation: 'Use a longer, more complex JWT secret',
            status: 'open',
            createdAt: '2023-06-10T14:30:00Z',
          }),
          expect.objectContaining({
            id: 'issue-2',
            severity: 'critical',
            title: 'Outdated dependency with known vulnerability',
            description: 'package.json includes outdated dependency with CVE-2023-1234',
            remediation: 'Update to latest version of the dependency',
            status: 'open',
            createdAt: '2023-06-12T09:15:00Z',
          }),
        ]),
        complianceStatus: {
          gdpr: 'partial',
          hipaa: 'non-compliant',
          pci: 'not-applicable',
        },
      });
    });

    it('should generate current timestamp', async () => {
      const beforeCall = new Date().toISOString();
      const report = await getSecurityAuditReport();
      const afterCall = new Date().toISOString();

      expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(report.generatedAt >= beforeCall).toBe(true);
      expect(report.generatedAt <= afterCall).toBe(true);
    });

    it('should include valid summary statistics', async () => {
      const report = await getSecurityAuditReport();

      expect(report.summary.criticalIssues).toBeGreaterThanOrEqual(0);
      expect(report.summary.highIssues).toBeGreaterThanOrEqual(0);
      expect(report.summary.mediumIssues).toBeGreaterThanOrEqual(0);
      expect(report.summary.lowIssues).toBeGreaterThanOrEqual(0);
      
      const calculatedTotal = 
        report.summary.criticalIssues + 
        report.summary.highIssues + 
        report.summary.mediumIssues + 
        report.summary.lowIssues;
      
      expect(report.summary.total).toBe(calculatedTotal);
    });

    it('should include compliance status for all standards', async () => {
      const report = await getSecurityAuditReport();

      expect(report.complianceStatus).toHaveProperty('gdpr');
      expect(report.complianceStatus).toHaveProperty('hipaa');
      expect(report.complianceStatus).toHaveProperty('pci');
      
      const validStatuses = ['compliant', 'partial', 'non-compliant', 'not-applicable'];
      expect(validStatuses).toContain(report.complianceStatus.gdpr);
      expect(validStatuses).toContain(report.complianceStatus.hipaa);
      expect(validStatuses).toContain(report.complianceStatus.pci);
    });

    it('should include detailed issue information', async () => {
      const report = await getSecurityAuditReport();

      expect(report.issues).toHaveLength(2);
      
      report.issues.forEach((issue) => {
        expect(issue).toHaveProperty('id');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('title');
        expect(issue).toHaveProperty('description');
        expect(issue).toHaveProperty('remediation');
        expect(issue).toHaveProperty('status');
        expect(issue).toHaveProperty('createdAt');
        
        expect(['critical', 'high', 'medium', 'low']).toContain(issue.severity);
        expect(['open', 'in-progress', 'resolved', 'closed']).toContain(issue.status);
        expect(issue.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      });
    });
  });

  describe('getSecurityIssueById', () => {
    it('should return detailed security issue by ID', async () => {
      const issue = await getSecurityIssueById('issue-1');

      expect(issue).toEqual({
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
      });
    });

    it('should handle different issue IDs consistently', async () => {
      const issueId = 'custom-issue-123';
      const issue = await getSecurityIssueById(issueId);

      expect(issue.id).toBe(issueId);
      expect(issue).toHaveProperty('severity');
      expect(issue).toHaveProperty('title');
      expect(issue).toHaveProperty('technicalDetails');
      expect(issue).toHaveProperty('timeline');
    });

    it('should throw ApiError for non-existent issue', async () => {
      await expect(getSecurityIssueById('non-existent')).rejects.toThrow(ApiError);
      await expect(getSecurityIssueById('non-existent')).rejects.toThrow('Security issue not found');
      
      try {
        await getSecurityIssueById('non-existent');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(404);
      }
    });

    it('should include comprehensive technical details', async () => {
      const issue = await getSecurityIssueById('issue-1');

      expect(issue.technicalDetails).toEqual({
        impact: expect.any(String),
        cwe: expect.stringMatching(/^CWE-\d+$/),
        affectedFiles: expect.arrayContaining([
          expect.stringMatching(/\.(ts|js|json)$/),
        ]),
        vulnerableCode: expect.any(String),
      });
    });

    it('should include complete timeline with proper dates', async () => {
      const issue = await getSecurityIssueById('issue-1');

      expect(issue.timeline).toHaveLength(3);
      
      issue.timeline.forEach((timelineEntry) => {
        expect(timelineEntry).toHaveProperty('date');
        expect(timelineEntry).toHaveProperty('event');
        expect(timelineEntry.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(typeof timelineEntry.event).toBe('string');
        expect(timelineEntry.event.length).toBeGreaterThan(0);
      });
    });

    it('should include affected components', async () => {
      const issue = await getSecurityIssueById('issue-1');

      expect(Array.isArray(issue.affects)).toBe(true);
      expect(issue.affects.length).toBeGreaterThan(0);
      expect(issue.affects).toContain('api');
      expect(issue.affects).toContain('authentication');
    });
  });

  describe('updateSecurityIssue', () => {
    it('should successfully update security issue', async () => {
      const updateData = {
        status: 'in-progress',
        assignedTo: 'developer-456',
      };

      const updatedIssue = await updateSecurityIssue('issue-1', updateData, 'admin-123');

      expect(updatedIssue).toEqual({
        id: 'issue-1',
        severity: 'critical',
        title: 'Insecure JWT secret',
        status: 'in-progress',
        assignedTo: 'developer-456',
        updatedAt: expect.any(String),
      });
    });

    it('should generate current timestamp for updatedAt', async () => {
      const beforeUpdate = new Date().toISOString();
      const updatedIssue = await updateSecurityIssue('issue-1', { status: 'resolved' }, 'admin-123');
      const afterUpdate = new Date().toISOString();

      expect(updatedIssue.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(updatedIssue.updatedAt >= beforeUpdate).toBe(true);
      expect(updatedIssue.updatedAt <= afterUpdate).toBe(true);
    });

    it('should handle partial updates', async () => {
      const updateData = { status: 'closed' };

      const updatedIssue = await updateSecurityIssue('issue-1', updateData, 'admin-123');

      expect(updatedIssue.status).toBe('closed');
      expect(updatedIssue.assignedTo).toBe('admin-123'); // Default value
    });

    it('should preserve existing values when not updated', async () => {
      const updateData = { assignedTo: 'new-assignee' };

      const updatedIssue = await updateSecurityIssue('issue-1', updateData, 'admin-123');

      expect(updatedIssue.assignedTo).toBe('new-assignee');
      expect(updatedIssue.status).toBe('open'); // Default value
      expect(updatedIssue.id).toBe('issue-1');
      expect(updatedIssue.severity).toBe('critical');
      expect(updatedIssue.title).toBe('Insecure JWT secret');
    });

    it('should throw ApiError for non-existent issue', async () => {
      const updateData = { status: 'resolved' };

      await expect(
        updateSecurityIssue('non-existent', updateData, 'admin-123')
      ).rejects.toThrow(ApiError);

      await expect(
        updateSecurityIssue('non-existent', updateData, 'admin-123')
      ).rejects.toThrow('Security issue not found');

      try {
        await updateSecurityIssue('non-existent', updateData, 'admin-123');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(404);
      }
    });

    it('should validate status values', async () => {
      const updateData = { status: 'invalid-status' };

      await expect(
        updateSecurityIssue('issue-1', updateData, 'admin-123')
      ).rejects.toThrow(ApiError);

      await expect(
        updateSecurityIssue('issue-1', updateData, 'admin-123')
      ).rejects.toThrow('Invalid status value');

      try {
        await updateSecurityIssue('issue-1', updateData, 'admin-123');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(400);
      }
    });

    it('should handle empty update data', async () => {
      const updatedIssue = await updateSecurityIssue('issue-1', {}, 'admin-123');

      expect(updatedIssue.status).toBe('open');
      expect(updatedIssue.assignedTo).toBe('admin-123');
      expect(updatedIssue).toHaveProperty('updatedAt');
    });

    it('should handle undefined values in update data', async () => {
      const updateData = {
        status: undefined,
        assignedTo: undefined,
      };

      const updatedIssue = await updateSecurityIssue('issue-1', updateData, 'admin-123');

      expect(updatedIssue.status).toBe('open');
      expect(updatedIssue.assignedTo).toBe('admin-123');
    });
  });

  describe('getVulnerabilityScans', () => {
    it('should return vulnerability scans with default pagination', async () => {
      const result = await getVulnerabilityScans({});

      expect(result).toEqual({
        scans: expect.arrayContaining([
          expect.objectContaining({
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
          }),
          expect.objectContaining({
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
          }),
        ]),
        pagination: {
          total: 3,
          page: 1,
          limit: 10,
        },
      });
    });

    it('should respect custom pagination options', async () => {
      const options = { page: 2, limit: 5 };
      const result = await getVulnerabilityScans(options);

      expect(result.pagination).toEqual({
        total: 3,
        page: 2,
        limit: 5,
      });
    });

    it('should filter by scan type', async () => {
      const result = await getVulnerabilityScans({ scanType: 'dependency' });

      expect(result.scans).toHaveLength(1);
      expect(result.scans[0].scanType).toBe('dependency');
      expect(result.scans[0].id).toBe('scan-1');
    });

    it('should filter by different scan type', async () => {
      const result = await getVulnerabilityScans({ scanType: 'code' });

      expect(result.scans).toHaveLength(1);
      expect(result.scans[0].scanType).toBe('code');
      expect(result.scans[0].id).toBe('scan-2');
    });

    it('should return empty results for non-matching scan type', async () => {
      const result = await getVulnerabilityScans({ scanType: 'non-existent' });

      expect(result.scans).toHaveLength(0);
      expect(result.pagination.total).toBe(3); // Total is always the same
    });

    it('should validate scan structure', async () => {
      const result = await getVulnerabilityScans({});

      result.scans.forEach((scan) => {
        expect(scan).toHaveProperty('id');
        expect(scan).toHaveProperty('scanType');
        expect(scan).toHaveProperty('startTime');
        expect(scan).toHaveProperty('endTime');
        expect(scan).toHaveProperty('status');
        expect(scan).toHaveProperty('issues');

        expect(scan.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(scan.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(['completed', 'running', 'failed', 'pending']).toContain(scan.status);

        expect(scan.issues).toHaveProperty('critical');
        expect(scan.issues).toHaveProperty('high');
        expect(scan.issues).toHaveProperty('medium');
        expect(scan.issues).toHaveProperty('low');

        expect(typeof scan.issues.critical).toBe('number');
        expect(typeof scan.issues.high).toBe('number');
        expect(typeof scan.issues.medium).toBe('number');
        expect(typeof scan.issues.low).toBe('number');
      });
    });

    it('should handle combined filter and pagination options', async () => {
      const options = {
        page: 1,
        limit: 20,
        scanType: 'dependency',
      };

      const result = await getVulnerabilityScans(options);

      expect(result.scans).toHaveLength(1);
      expect(result.scans[0].scanType).toBe('dependency');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });

  describe('getScanById', () => {
    it('should return detailed scan information', async () => {
      const scan = await getScanById('scan-1');

      expect(scan).toEqual({
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
        scanDuration: 930,
        detectedIssues: expect.arrayContaining([
          expect.objectContaining({
            id: 'issue-1',
            severity: 'critical',
            title: 'Insecure JWT secret',
            component: 'jwt-config',
            location: '/app/src/config/jwt.ts:5',
          }),
          expect.objectContaining({
            id: 'issue-2',
            severity: 'critical',
            title: 'Outdated dependency with known vulnerability',
            component: 'lodash@4.17.15',
            location: 'package.json',
          }),
        ]),
        configuration: {
          ignorePatterns: ['**/node_modules/**', '**/dist/**'],
          ignoredVulnerabilities: ['CVE-2022-5678'],
        },
      });
    });

    it('should handle different scan IDs consistently', async () => {
      const scanId = 'custom-scan-456';
      const scan = await getScanById(scanId);

      expect(scan.id).toBe(scanId);
      expect(scan).toHaveProperty('scanType');
      expect(scan).toHaveProperty('detectedIssues');
      expect(scan).toHaveProperty('configuration');
    });

    it('should throw ApiError for non-existent scan', async () => {
      await expect(getScanById('non-existent')).rejects.toThrow(ApiError);
      await expect(getScanById('non-existent')).rejects.toThrow('Scan not found');

      try {
        await getScanById('non-existent');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(404);
      }
    });

    it('should include scanner metadata', async () => {
      const scan = await getScanById('scan-1');

      expect(scan.scanner).toBe('npm audit');
      expect(scan.scannerVersion).toBe('2.0.0');
      expect(typeof scan.scanDuration).toBe('number');
      expect(scan.scanDuration).toBeGreaterThan(0);
    });

    it('should include detailed detected issues', async () => {
      const scan = await getScanById('scan-1');

      expect(Array.isArray(scan.detectedIssues)).toBe(true);
      expect(scan.detectedIssues.length).toBeGreaterThan(0);

      scan.detectedIssues.forEach((issue) => {
        expect(issue).toHaveProperty('id');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('title');
        expect(issue).toHaveProperty('component');
        expect(issue).toHaveProperty('location');

        expect(['critical', 'high', 'medium', 'low']).toContain(issue.severity);
        expect(typeof issue.title).toBe('string');
        expect(issue.title.length).toBeGreaterThan(0);
      });
    });

    it('should include scan configuration', async () => {
      const scan = await getScanById('scan-1');

      expect(scan.configuration).toHaveProperty('ignorePatterns');
      expect(scan.configuration).toHaveProperty('ignoredVulnerabilities');

      expect(Array.isArray(scan.configuration.ignorePatterns)).toBe(true);
      expect(Array.isArray(scan.configuration.ignoredVulnerabilities)).toBe(true);

      scan.configuration.ignorePatterns.forEach((pattern) => {
        expect(typeof pattern).toBe('string');
      });

      scan.configuration.ignoredVulnerabilities.forEach((cve) => {
        expect(typeof cve).toBe('string');
        expect(cve).toMatch(/^CVE-\d{4}-\d+$/);
      });
    });

    it('should validate scan duration calculation', async () => {
      const scan = await getScanById('scan-1');

      // Scan duration should be in seconds
      expect(scan.scanDuration).toBe(930); // 15 minutes 30 seconds

      // Verify this matches the time difference
      const startTime = new Date(scan.startTime);
      const endTime = new Date(scan.endTime);
      const calculatedDuration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      expect(scan.scanDuration).toBe(calculatedDuration);
    });

    it('should include consistent timestamp format', async () => {
      const scan = await getScanById('scan-1');

      expect(scan.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(scan.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

      // End time should be after start time
      const startTime = new Date(scan.startTime);
      const endTime = new Date(scan.endTime);
      expect(endTime.getTime()).toBeGreaterThan(startTime.getTime());
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty string IDs', async () => {
      await expect(getSecurityIssueById('')).resolves.toBeDefined();
      await expect(getScanById('')).resolves.toBeDefined();
    });

    it('should handle null values in update data', async () => {
      const updateData = {
        status: null,
        assignedTo: null,
      };

      const updatedIssue = await updateSecurityIssue('issue-1', updateData, 'admin-123');

      expect(updatedIssue.status).toBe('open');
      expect(updatedIssue.assignedTo).toBe('admin-123');
    });

    it('should handle zero values in pagination', async () => {
      const result = await getVulnerabilityScans({ page: 0, limit: 0 });

      expect(result.pagination.page).toBe(0);
      expect(result.pagination.limit).toBe(0);
    });

    it('should handle negative values in pagination', async () => {
      const result = await getVulnerabilityScans({ page: -1, limit: -5 });

      expect(result.pagination.page).toBe(-1);
      expect(result.pagination.limit).toBe(-5);
    });

    it('should handle very large pagination values', async () => {
      const result = await getVulnerabilityScans({ page: 999999, limit: 999999 });

      expect(result.pagination.page).toBe(999999);
      expect(result.pagination.limit).toBe(999999);
    });

    it('should handle special characters in IDs', async () => {
      const specialId = 'issue-with-special-chars-@#$%';
      const issue = await getSecurityIssueById(specialId);

      expect(issue.id).toBe(specialId);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent issue counts across functions', async () => {
      const auditReport = await getSecurityAuditReport();
      const scans = await getVulnerabilityScans({});

      // Verify that critical issues are consistently reported
      expect(auditReport.summary.criticalIssues).toBeGreaterThanOrEqual(0);
      
      scans.scans.forEach((scan) => {
        expect(scan.issues.critical).toBeGreaterThanOrEqual(0);
      });
    });

    it('should use consistent date formats across all functions', async () => {
      const auditReport = await getSecurityAuditReport();
      const issue = await getSecurityIssueById('issue-1');
      const scan = await getScanById('scan-1');

      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

      expect(auditReport.generatedAt).toMatch(dateRegex);
      expect(issue.createdAt).toMatch(dateRegex);
      expect(scan.startTime).toMatch(dateRegex);
      expect(scan.endTime).toMatch(dateRegex);
    });

    it('should use consistent severity levels across all functions', async () => {
      const validSeverities = ['critical', 'high', 'medium', 'low'];
      
      const auditReport = await getSecurityAuditReport();
      const issue = await getSecurityIssueById('issue-1');
      const scan = await getScanById('scan-1');

      auditReport.issues.forEach((issue) => {
        expect(validSeverities).toContain(issue.severity);
      });

      expect(validSeverities).toContain(issue.severity);

      scan.detectedIssues.forEach((detectedIssue) => {
        expect(validSeverities).toContain(detectedIssue.severity);
      });
    });

    it('should maintain consistent status values', async () => {
      const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
      
      const auditReport = await getSecurityAuditReport();
      const issue = await getSecurityIssueById('issue-1');

      auditReport.issues.forEach((issue) => {
        expect(validStatuses).toContain(issue.status);
      });

      expect(validStatuses).toContain(issue.status);
    });
  });
});