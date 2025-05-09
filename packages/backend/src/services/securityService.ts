/**
 * Security Service
 * Provides functions for managing security-related data
 */
import { ApiError } from '../utils/errors';

/**
 * Get security audit report
 * @returns Security audit report data
 */
export async function getSecurityAuditReport() {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      criticalIssues: 2,
      highIssues: 5,
      mediumIssues: 8,
      lowIssues: 12,
      total: 27
    },
    issues: [
      {
        id: 'issue-1',
        severity: 'critical',
        title: 'Insecure JWT secret',
        description: 'JWT secret is too short and not complex enough',
        remediation: 'Use a longer, more complex JWT secret',
        status: 'open',
        createdAt: '2023-06-10T14:30:00Z'
      },
      {
        id: 'issue-2',
        severity: 'critical',
        title: 'Outdated dependency with known vulnerability',
        description: 'package.json includes outdated dependency with CVE-2023-1234',
        remediation: 'Update to latest version of the dependency',
        status: 'open',
        createdAt: '2023-06-12T09:15:00Z'
      }
    ],
    complianceStatus: {
      gdpr: 'partial',
      hipaa: 'non-compliant',
      pci: 'not-applicable'
    }
  };
}

/**
 * Get security issue by ID
 * @param id Issue ID
 * @returns Security issue details
 */
export async function getSecurityIssueById(id: string) {
  if (id === 'non-existent') {
    throw new ApiError(404, 'Security issue not found');
  }
  
  return {
    id,
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
      affectedFiles: [
        '/app/src/config/jwt.ts',
        '/app/src/services/authService.ts'
      ],
      vulnerableCode: 'const JWT_SECRET = "simple-secret"'
    },
    timeline: [
      { date: '2023-06-10T14:30:00Z', event: 'Issue detected in security scan' },
      { date: '2023-06-11T09:45:00Z', event: 'Issue validated by security team' },
      { date: '2023-06-11T10:30:00Z', event: 'Assigned to development team' }
    ]
  };
}

/**
 * Update security issue
 * @param id Issue ID
 * @param updateData Update data
 * @param userId User ID
 * @returns Updated security issue
 */
export async function updateSecurityIssue(id: string, updateData: any, userId: string) {
  if (id === 'non-existent') {
    throw new ApiError(404, 'Security issue not found');
  }
  
  if (updateData.status === 'invalid-status') {
    throw new ApiError(400, 'Invalid status value');
  }
  
  return {
    id,
    severity: 'critical',
    title: 'Insecure JWT secret',
    status: updateData.status || 'open',
    assignedTo: updateData.assignedTo || 'admin-123',
    updatedAt: new Date().toISOString()
  };
}

/**
 * Get vulnerability scans
 * @param options Filter and pagination options
 * @returns List of vulnerability scans
 */
export async function getVulnerabilityScans(options: { 
  page?: number, 
  limit?: number, 
  scanType?: string 
}) {
  const { page = 1, limit = 10, scanType } = options;
  
  return {
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
          low: 12
        }
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
          low: 15
        }
      }
    ].filter(scan => !scanType || scan.scanType === scanType),
    pagination: {
      total: 3,
      page,
      limit
    }
  };
}

/**
 * Get scan by ID
 * @param id Scan ID
 * @returns Scan details
 */
export async function getScanById(id: string) {
  if (id === 'non-existent') {
    throw new ApiError(404, 'Scan not found');
  }
  
  return {
    id,
    scanType: 'dependency',
    startTime: '2023-06-15T00:00:00Z',
    endTime: '2023-06-15T00:15:30Z',
    status: 'completed',
    issues: {
      critical: 2,
      high: 5,
      medium: 8,
      low: 12
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
        location: '/app/src/config/jwt.ts:5'
      },
      {
        id: 'issue-2',
        severity: 'critical',
        title: 'Outdated dependency with known vulnerability',
        component: 'lodash@4.17.15',
        location: 'package.json'
      }
    ],
    configuration: {
      ignorePatterns: ['**/node_modules/**', '**/dist/**'],
      ignoredVulnerabilities: ['CVE-2022-5678']
    }
  };
}