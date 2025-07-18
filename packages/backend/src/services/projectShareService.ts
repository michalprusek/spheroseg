import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { sendProjectInvitation } from './emailService';
import { ApiError } from '../utils/errors';
import type { default as DbType } from '../db';

const logger = createLogger('projectShareService');

// Doba platnosti pozvánky (48 hodin)
const INVITATION_EXPIRY_HOURS = 48;

export interface ShareProjectParams {
  projectId: string;
  ownerId: string;
  email: string;
  permission: 'view' | 'edit';
}

export interface GenerateInvitationParams {
  projectId: string;
  ownerId: string;
  permission: 'view' | 'edit';
}

export interface ProjectShareDetails {
  id: string;
  projectId: string;
  ownerId: string;
  userId: string | null;
  email: string;
  permission: string;
  invitationToken: string | null;
  invitationExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedProject {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  permission: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service pro práci se sdílenými projekty
 */
export class ProjectShareService {
  private pool: Pool | typeof DbType;

  constructor(pool: Pool | typeof DbType) {
    this.pool = pool;
  }

  private async query<T = any>(text: string, params?: any[]): Promise<import('pg').QueryResult<T>> {
    if ('query' in this.pool && typeof this.pool.query === 'function') {
      return (this.pool as Pool).query(text, params);
    }
    throw new Error('Invalid database connection');
  }

  /**
   * Generuje a vrátí unikátní token pro pozvánku
   */
  private generateInvitationToken(): string {
    return uuidv4();
  }

  /**
   * Vytvoří datum expirace pozvánky
   */
  private getInvitationExpiryDate(): Date {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + INVITATION_EXPIRY_HOURS);
    return expiryDate;
  }

  /**
   * Zjistí, zda je projekt již sdílen s daným emailem
   */
  async isProjectSharedWithEmail(projectId: string, email: string): Promise<boolean> {
    const query = `
      SELECT id FROM project_shares 
      WHERE project_id = $1 AND (email = $2 OR user_id IN (SELECT id FROM users WHERE email = $2))
    `;

    const result = await this.query(query, [projectId, email]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Zjistí, zda má uživatel právo sdílet projekt
   */
  async canUserShareProject(projectId: string, userId: string): Promise<boolean> {
    // Kontrola, zda je uživatel vlastníkem projektu
    const ownerQuery = `
      SELECT id FROM projects 
      WHERE id = $1 AND user_id = $2
    `;

    const ownerResult = await this.query(ownerQuery, [projectId, userId]);
    return (ownerResult.rowCount ?? 0) > 0;
  }

  /**
   * Sdílí projekt s uživatelem pomocí emailu
   */
  async shareProject(params: ShareProjectParams): Promise<ProjectShareDetails> {
    const { projectId, ownerId, email, permission } = params;

    // Kontrola, zda je uživatel vlastníkem projektu
    const canShare = await this.canUserShareProject(projectId, ownerId);
    if (!canShare) {
      throw new ApiError('You are not allowed to share this project', 403);
    }

    // Kontrola, zda už projekt není sdílen s tímto emailem
    const isAlreadyShared = await this.isProjectSharedWithEmail(projectId, email);
    if (isAlreadyShared) {
      throw new ApiError('Project is already shared with this email', 409);
    }

    // Generování tokenu a data expirace pro pozvánku
    const invitationToken = this.generateInvitationToken();
    const invitationExpiresAt = this.getInvitationExpiryDate();

    // Zjištění, zda email patří existujícímu uživateli
    const userQuery = `SELECT id FROM users WHERE email = $1`;
    const userResult = await this.query(userQuery, [email]);
    const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;

    // Získání informací o projektu pro pozvánku
    const projectQuery = `
      SELECT p.title, u.name as owner_name 
      FROM projects p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `;
    const projectResult = await this.query(projectQuery, [projectId]);

    if (projectResult.rows.length === 0) {
      throw new ApiError('Project not found', 404);
    }

    const { title: projectTitle, owner_name: ownerName } = projectResult.rows[0];

    // Vytvoření záznamu v databázi
    const insertQuery = `
      INSERT INTO project_shares 
        (project_id, owner_id, user_id, email, permission, invitation_token, invitation_expires_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.query(insertQuery, [
      projectId,
      ownerId,
      userId,
      email,
      permission,
      invitationToken,
      invitationExpiresAt,
    ]);

    const shareDetails = result.rows[0];

    // Odeslání pozvánky
    try {
      await sendProjectInvitation({
        to: email,
        projectTitle,
        ownerName,
        invitationToken,
        permission,
      });

      logger.info(`Invitation sent for project ${projectId} to ${email}`);
    } catch (error) {
      logger.error('Failed to send project invitation email', {
        error,
        projectId,
        email,
      });
      // I když selže odeslání emailu, sdílení je vytvořeno
    }

    return shareDetails;
  }

  /**
   * Zruší sdílení projektu
   */
  async removeProjectShare(projectId: string, shareId: string, userId: string): Promise<boolean> {
    // Kontrola, zda je uživatel vlastníkem projektu
    const canShare = await this.canUserShareProject(projectId, userId);
    if (!canShare) {
      throw new ApiError('You are not allowed to manage shares for this project', 403);
    }

    const query = `
      DELETE FROM project_shares 
      WHERE id = $1 AND project_id = $2
      RETURNING id
    `;

    const result = await this.query(query, [shareId, projectId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Přijme pozvánku ke sdílení projektu
   */
  async acceptProjectInvitation(token: string, userId: string): Promise<SharedProject> {
    // Kontrola platnosti tokenu
    const tokenQuery = `
      SELECT ps.*, p.title, p.description, u.name as owner_name, u.email as owner_email
      FROM project_shares ps
      JOIN projects p ON ps.project_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE ps.invitation_token = $1
        AND ps.invitation_expires_at > NOW()
    `;

    const tokenResult = await this.query(tokenQuery, [token]);

    if (tokenResult.rows.length === 0) {
      throw new ApiError('Invalid or expired invitation token', 404);
    }

    const invitation = tokenResult.rows[0];

    // Kontrola, zda email pozvánky souhlasí s emailem přihlášeného uživatele
    const userQuery = `SELECT email FROM users WHERE id = $1`;
    const userResult = await this.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      throw new ApiError('User not found', 404);
    }

    const userEmail = userResult.rows[0].email;

    // For link-based invitations, the email might be a placeholder
    if (
      invitation.email !== 'pending@invitation.link' &&
      invitation.email.toLowerCase() !== userEmail.toLowerCase()
    ) {
      throw new ApiError('This invitation is not intended for this user', 403);
    }

    // Aktualizace záznamu o sdílení - nastavení user_id, email a zrušení tokenu
    const updateQuery = `
      UPDATE project_shares
      SET user_id = $1, email = $2, invitation_token = NULL, invitation_expires_at = NULL, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    await this.query(updateQuery, [userId, userEmail, invitation.id]);

    // Vrátíme informace o sdíleném projektu
    return {
      id: invitation.project_id,
      title: invitation.title,
      description: invitation.description,
      ownerId: invitation.owner_id,
      ownerName: invitation.owner_name,
      ownerEmail: invitation.owner_email,
      permission: invitation.permission,
      createdAt: invitation.created_at,
      updatedAt: invitation.updated_at,
    };
  }

  /**
   * Získá seznam projektů sdílených s uživatelem
   */
  async getProjectsSharedWithUser(userId: string): Promise<SharedProject[]> {
    const query = `
      SELECT p.id, p.title, p.description, p.user_id as owner_id, 
             u.name as owner_name, u.email as owner_email, 
             ps.permission, p.created_at, p.updated_at
      FROM project_shares ps
      JOIN projects p ON ps.project_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE ps.user_id = $1 AND ps.invitation_token IS NULL
      ORDER BY p.updated_at DESC
    `;

    const result = await this.query(query, [userId]);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      permission: row.permission,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Získá seznam sdílení pro konkrétní projekt
   */
  async getProjectShares(projectId: string, ownerId: string): Promise<any[]> {
    // Kontrola, zda je uživatel vlastníkem projektu
    const canShare = await this.canUserShareProject(projectId, ownerId);
    if (!canShare) {
      throw new ApiError('You are not allowed to view shares for this project', 403);
    }

    const query = `
      SELECT ps.id, 
             ps.email, 
             ps.permission, 
             ps.created_at, 
             u.name as user_name, 
             ps.invitation_token IS NOT NULL as is_pending
      FROM project_shares ps
      LEFT JOIN users u ON ps.user_id = u.id
      WHERE ps.project_id = $1
      ORDER BY ps.created_at DESC
    `;

    const result = await this.query(query, [projectId]);
    return result.rows;
  }

  /**
   * Kontroluje, zda má uživatel přístup k projektu
   */
  async hasUserAccessToProject(projectId: string, userId: string): Promise<boolean> {
    // Nejdřív zkontrolujeme, zda je uživatel vlastníkem
    const ownerQuery = `
      SELECT id FROM projects 
      WHERE id = $1 AND user_id = $2
    `;

    const ownerResult = await this.query(ownerQuery, [projectId, userId]);

    // Pokud je vlastníkem, má přístup
    if ((ownerResult.rowCount ?? 0) > 0) {
      return true;
    }

    // Pokud ne, zkontrolujeme sdílení
    const shareQuery = `
      SELECT id FROM project_shares 
      WHERE project_id = $1 AND user_id = $2 AND invitation_token IS NULL
    `;

    const shareResult = await this.query(shareQuery, [projectId, userId]);
    return (shareResult.rowCount ?? 0) > 0;
  }

  /**
   * Generuje invitation link pro sdílení projektu
   * Na rozdíl od shareProject(), tato metoda nevyžaduje email a neposílá pozvánku
   */
  async generateInvitationLink(params: GenerateInvitationParams): Promise<{
    token: string;
    expiresAt: Date;
    permission: string;
  }> {
    const { projectId, ownerId, permission } = params;

    // Kontrola, zda je uživatel vlastníkem projektu
    const canShare = await this.canUserShareProject(projectId, ownerId);
    if (!canShare) {
      throw new ApiError('You are not allowed to share this project', 403);
    }

    // Kontrola existence projektu
    const projectQuery = `
      SELECT id FROM projects WHERE id = $1
    `;
    const projectResult = await this.query(projectQuery, [projectId]);

    if (projectResult.rows.length === 0) {
      throw new ApiError('Project not found', 404);
    }

    // Generování tokenu a data expirace
    const invitationToken = this.generateInvitationToken();
    const invitationExpiresAt = this.getInvitationExpiryDate();

    // Vytvoření záznamu v databázi bez emailu
    const insertQuery = `
      INSERT INTO project_shares 
        (project_id, owner_id, email, permission, invitation_token, invitation_expires_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    // For invitation links, we use a placeholder email that will be updated when accepted
    await this.query(insertQuery, [
      projectId,
      ownerId,
      'pending@invitation.link', // Placeholder email
      permission,
      invitationToken,
      invitationExpiresAt,
    ]);

    logger.info(`Invitation link generated for project ${projectId}`);

    return {
      token: invitationToken,
      expiresAt: invitationExpiresAt,
      permission,
    };
  }
}

export default ProjectShareService;
