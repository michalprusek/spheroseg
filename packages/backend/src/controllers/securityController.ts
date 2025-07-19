/**
 * Security Controller
 * Handles security-related API endpoints
 */
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../security/middleware/auth';
import * as securityService from '../services/securityService';
import { ApiError } from '../utils/errors';

/**
 * Get security audit report
 * @route GET /api/security/audit
 * @access Admin only
 */
export const getSecurityAuditReport = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      throw new ApiError('Only admin users can access security audit reports', 403);
    }

    const report = await securityService.getSecurityAuditReport();
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
};

/**
 * Get security issue by ID
 * @route GET /api/security/issues/:id
 * @access Admin only
 */
export const getSecurityIssueById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      throw new ApiError('Only admin users can access security issue details', 403);
    }

    const issue = await securityService.getSecurityIssueById(req.params['id'] as string);
    res.status(200).json(issue);
  } catch (error) {
    next(error);
  }
};

/**
 * Update security issue
 * @route PATCH /api/security/issues/:id
 * @access Admin only
 */
export const updateSecurityIssue = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      throw new ApiError('Only admin users can update security issues', 403);
    }

    const updatedIssue = await securityService.updateSecurityIssue(
      req.params['id'] as string,
      req.body,
      req.user.userId
    );

    res.status(200).json(updatedIssue);
  } catch (error) {
    next(error);
  }
};

/**
 * Get vulnerability scans
 * @route GET /api/security/scans
 * @access Admin only
 */
export const getVulnerabilityScans = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      throw new ApiError('Only admin users can access vulnerability scans', 403);
    }

    const options: { page?: number; limit?: number; scanType?: string } = {
      page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1,
      limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10,
    };
    if (req.query['scanType']) {
      options.scanType = req.query['scanType'] as string;
    }

    const scans = await securityService.getVulnerabilityScans(options);
    res.status(200).json(scans);
  } catch (error) {
    next(error);
  }
};

/**
 * Get scan details
 * @route GET /api/security/scans/:id
 * @access Admin only
 */
export const getScanDetails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      throw new ApiError('Only admin users can access scan details', 403);
    }

    const scan = await securityService.getScanById(req.params['id'] as string);
    res.status(200).json(scan);
  } catch (error) {
    next(error);
  }
};
