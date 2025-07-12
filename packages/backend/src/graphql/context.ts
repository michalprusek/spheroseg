import { Request, Response } from 'express';
import { Pool } from 'pg';
import DataLoader from 'dataloader';
import { createUserLoader } from './dataloaders/userLoader';
import { createProjectLoader } from './dataloaders/projectLoader';
import { createImageLoader } from './dataloaders/imageLoader';
import { createSegmentationLoader } from './dataloaders/segmentationLoader';

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isApproved: boolean;
  storage_used_bytes: number;
  storage_limit_bytes: number;
}

export interface Context {
  req: Request;
  res: Response;
  db: Pool;
  user?: User | null;
  refreshToken?: string;
  loaders: {
    user: DataLoader<string, any>;
    project: DataLoader<string, any>;
    image: DataLoader<string, any>;
    segmentation: DataLoader<string, any>;
  };
}

export function createContext(req: Request, res: Response, db: Pool): Context {
  // User will be populated by auth middleware
  const user = (req as any).user || null;
  const refreshToken = req.headers['x-refresh-token'] as string;

  // Create DataLoaders for this request
  const loaders = {
    user: createUserLoader(db),
    project: createProjectLoader(db),
    image: createImageLoader(db),
    segmentation: createSegmentationLoader(db),
  };

  return {
    req,
    res,
    db,
    user,
    refreshToken,
    loaders,
  };
}