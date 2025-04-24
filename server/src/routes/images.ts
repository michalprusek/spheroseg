import express, { Request, Response, Router, NextFunction } from 'express';
import pool from '@/db';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp'; // Import sharp for image processing
import { validate } from '../middleware/validationMiddleware';
import { listImagesSchema, uploadImagesSchema, imageIdSchema } from '../validators/imageValidators';

const router: Router = express.Router();

// --- Multer Configuration for Local Storage ---
const UPLOAD_DIR = path.join(__dirname, '../../uploads'); // Store uploads relative to server root
console.log('UPLOAD_DIR:', UPLOAD_DIR);

try {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        console.log('Created upload directory:', UPLOAD_DIR);
    } else {
        console.log('Upload directory already exists:', UPLOAD_DIR);
    }
} catch (error) {
    console.error('Error creating upload directory:', error);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store files in a subdirectory based on project ID
        const projectId = (req as any).params.projectId; // Access projectId from params
        if (!projectId) {
             return cb(new Error('Project ID missing for upload destination'), '');
        }
        const projectUploadDir = path.join(UPLOAD_DIR, projectId);
        if (!fs.existsSync(projectUploadDir)) {
            fs.mkdirSync(projectUploadDir, { recursive: true });
        }
        cb(null, projectUploadDir);
    },
    filename: function (req, file, cb) {
        // Keep original filename + add timestamp to avoid conflicts
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Increased limit to 50MB
});
// --- End Multer Configuration ---


// GET /api/projects/:projectId/images - List images for a specific project
// @ts-ignore // TS2769: No overload matches this call.
router.get('/projects/:projectId/images', authMiddleware, validate(listImagesSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId } = req.params;

    console.log(`GET /api/projects/${projectId}/images called by user ${userId}`);

    try {
        const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
        if (projectCheck.rows.length === 0) {
            console.log(`Project ${projectId} not found or access denied for user ${userId}`);
            res.status(404).json({ message: 'Project not found or access denied' });
            return;
        }

        const imagesResult = await pool.query(
            'SELECT * FROM images WHERE project_id = $1 ORDER BY created_at DESC',
            [projectId]
        );

        // Get origin for absolute URLs
        const origin = req.get('origin') || '';

        // Ensure all paths are properly formatted
        const formattedImages = imagesResult.rows.map(image => {
            const formattedImage = { ...image };

            // Ensure storage_path starts with /
            if (formattedImage.storage_path && !formattedImage.storage_path.startsWith('/')) {
                formattedImage.storage_path = '/' + formattedImage.storage_path;
            }

            // Ensure thumbnail_path starts with /
            if (formattedImage.thumbnail_path && !formattedImage.thumbnail_path.startsWith('/')) {
                formattedImage.thumbnail_path = '/' + formattedImage.thumbnail_path;
            }

            // Add src property for convenience
            formattedImage.src = formattedImage.storage_path;

            // Add full URLs with origin
            if (formattedImage.storage_path && formattedImage.storage_path.startsWith('/')) {
                if (!formattedImage.storage_path.startsWith('http')) {
                    formattedImage.storage_path_full = `${origin}${formattedImage.storage_path}`;
                    formattedImage.src = formattedImage.storage_path_full;
                }
            }

            if (formattedImage.thumbnail_path && formattedImage.thumbnail_path.startsWith('/')) {
                if (!formattedImage.thumbnail_path.startsWith('http')) {
                    formattedImage.thumbnail_path_full = `${origin}${formattedImage.thumbnail_path}`;
                }
            }

            return formattedImage;
        });

        console.log(`Returning ${formattedImages.length} images for project ${projectId}`);
        res.status(200).json(formattedImages);

    } catch (error) {
        console.error('Error fetching images for project:', error);
        next(error);
    }
});

// POST /api/projects/:projectId/images - Upload one or more images to a project
// @ts-ignore // TS2769: No overload matches this call.
router.post(
    '/projects/:projectId/images',
    authMiddleware,
    validate(uploadImagesSchema),
    (req, res, next) => {
        console.log('Processing image upload request for project:', req.params.projectId);
        upload.array('images', 10)(req, res, (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({ message: err.message || 'Error uploading files' });
            }
            next();
        });
    },
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user?.userId;
        const { projectId } = req.params;
        const files = req.files as Express.Multer.File[];
        console.log('--- DEBUG: req.files in POST /projects/:projectId/images ---');
        console.log(files);
        console.log('--- END DEBUG ---');

        let insertedImages: any[] = [];
        let cleanupFiles: string[] = [];

        try {
            const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
            if (projectCheck.rows.length === 0) {
                if (files) files.forEach(file => cleanupFiles.push(file.path));
                const err = new Error('Project not found or access denied');
                (err as any).statusCode = 404;
                next(err);
                return;
            }

            if (!files || files.length === 0) {
                 res.status(400).json({ message: 'No image files provided' });
                 return;
            }

            for (const file of files) {
                cleanupFiles.push(file.path);
                let thumbnailPath: string | null = null;
                let width: number | null = null;
                let height: number | null = null;

                try {
                    console.log(`Processing file: ${file.originalname}, path: ${file.path}`);

                    // Check if file exists
                    if (!fs.existsSync(file.path)) {
                        console.error(`File does not exist at path: ${file.path}`);
                        continue; // Skip this file
                    }

                    const thumbnailFilename = `thumb-${path.basename(file.filename)}`;
                    thumbnailPath = path.join(path.dirname(file.path), thumbnailFilename);
                    console.log(`Thumbnail path: ${thumbnailPath}`);

                    // Get image metadata
                    const metadata = await sharp(file.path).metadata();
                    width = metadata.width ?? null;
                    height = metadata.height ?? null;
                    console.log(`Image dimensions: ${width}x${height}`);

                    // Generate thumbnail
                    await sharp(file.path)
                        .resize(200)
                        .toFile(thumbnailPath);

                    console.log(`Thumbnail generated successfully: ${thumbnailPath}`);
                    cleanupFiles.push(thumbnailPath);

                } catch (sharpError) {
                    console.error(`Failed to process image or generate thumbnail for ${file.originalname}:`, sharpError);
                    continue; // Skip this file
                }

                // Convert absolute paths to relative paths for storage in the database
                let relativePath = file.path.replace(UPLOAD_DIR, '/uploads');
                let relativeThumbnailPath = thumbnailPath ? thumbnailPath.replace(UPLOAD_DIR, '/uploads') : null;

                // Ensure paths start with /
                if (relativePath && !relativePath.startsWith('/')) {
                    relativePath = '/' + relativePath;
                }

                if (relativeThumbnailPath && !relativeThumbnailPath.startsWith('/')) {
                    relativeThumbnailPath = '/' + relativeThumbnailPath;
                }

                console.log('Storing paths in database:', {
                    originalPath: file.path,
                    relativePath,
                    originalThumbnailPath: thumbnailPath,
                    relativeThumbnailPath
                });

                const imageResult = await pool.query(
                    'INSERT INTO images (project_id, user_id, name, storage_path, thumbnail_path, width, height, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                    [
                        projectId,
                        userId,
                        file.originalname,
                        relativePath,
                        relativeThumbnailPath,
                        width,
                        height,
                        null
                    ]
                );
                insertedImages.push(imageResult.rows[0]);
            }

            res.status(201).json(insertedImages);

        } catch (error: any) {
            console.error('Error uploading images:', error);
            // Clean up files
            cleanupFiles.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (unlinkErr) {
                        console.error(`Failed to cleanup file ${filePath}:`, unlinkErr);
                    }
                }
            });
            next(error);
        }
    }
);

// DELETE /api/images/:id - Delete a specific image
// @ts-ignore // TS2769: No overload matches this call.
router.delete('/images/:id', authMiddleware, validate(imageIdSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id: imageId } = req.params;

    try {
        const imageRes = await pool.query(
            'SELECT i.id, i.storage_path, i.thumbnail_path FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.user_id = $2',
            [imageId, userId]
        );

        if (imageRes.rows.length === 0) {
             res.status(404).json({ message: 'Image not found or access denied' });
             return;
        }

        const imageData = imageRes.rows[0];

        await pool.query('DELETE FROM images WHERE id = $1', [imageId]);

        if (imageData.storage_path && fs.existsSync(imageData.storage_path)) {
            fs.unlinkSync(imageData.storage_path);
        }
        if (imageData.thumbnail_path && fs.existsSync(imageData.thumbnail_path)) {
            fs.unlinkSync(imageData.thumbnail_path);
        }

        res.status(204).send();

    } catch (error) {
        console.error('Error deleting image:', error);
        next(error);
    }
});

// GET /api/images/:projectId - Get all images for a project
// @ts-ignore // TS2769: No overload matches this call.
router.get('/:projectId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Placeholder: Implement actual logic here following the same pattern
    console.log(`GET /api/images/${req.params.projectId} called`);
    res.status(501).json({ message: 'Not Implemented' });
});

// GET /api/images/details/:imageId - Get details for a specific image
// @ts-ignore // TS2769: No overload matches this call.
router.get('/details/:imageId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Placeholder: Implement actual logic here following the same pattern
    console.log(`GET /api/images/details/${req.params.imageId} called`);
    res.status(501).json({ message: 'Not Implemented' });
});

// GET /api/projects/:projectId/images/:imageId - Get a specific image in a project
// @ts-ignore // TS2769: No overload matches this call.
router.get('/projects/:projectId/images/:imageId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log(`GET /api/projects/${req.params.projectId}/images/${req.params.imageId} called`);
    const userId = req.user?.userId;
    const { projectId, imageId } = req.params;

    console.log(`User ID: ${userId}, Project ID: ${projectId}, Image ID: ${imageId}`);

    try {
        // Verify user has access to the project
        console.log(`Verifying project access for project ${projectId} and user ${userId}`);
        const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
        console.log(`Project check result: ${JSON.stringify(projectCheck.rows)}`);

        if (projectCheck.rows.length === 0) {
            console.log(`Project not found or access denied for project ${projectId} and user ${userId}`);
            res.status(404).json({ message: 'Project not found or access denied' });
            return;
        }

        // Get the image
        console.log(`Fetching image ${imageId} from project ${projectId}`);
        let imageResult;

        // First try to find by UUID
        if (imageId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            console.log(`Trying to find image by UUID: ${imageId}`);
            imageResult = await pool.query(
                'SELECT * FROM images WHERE id = $1 AND project_id = $2',
                [imageId, projectId]
            );
        } else {
            // If not a UUID, try by name directly
            console.log(`Trying to find image by name: ${imageId}`);
            imageResult = await pool.query(
                'SELECT * FROM images WHERE name = $1 AND project_id = $2',
                [imageId, projectId]
            );
        }

        console.log(`Image result rows: ${imageResult.rows.length}`);

        if (imageResult.rows.length === 0) {
            // If not found by either method, try to find by name using the name query parameter
            console.log(`Image ${imageId} not found directly, trying to find by name query parameter`);

            // Check if there's a name query parameter
            const nameParam = req.query.name;
            if (nameParam) {
                console.log(`Trying to find image by name query parameter: ${nameParam}`);
                imageResult = await pool.query(
                    'SELECT * FROM images WHERE name = $1 AND project_id = $2',
                    [nameParam, projectId]
                );

                if (imageResult.rows.length === 0) {
                    console.log(`Image with name ${nameParam} not found in project ${projectId}`);
                    res.status(404).json({ message: 'Image not found in this project' });
                    return;
                }
            } else {
                // If not found by either method and no name parameter, return 404
                console.log(`Image ${imageId} not found in project ${projectId}`);
                res.status(404).json({ message: 'Image not found in this project' });
                return;
            }
        }

        // Add src property to the image data for easier access in the frontend
        const imageData = {
            ...imageResult.rows[0],
            src: imageResult.rows[0].storage_path
        };

        // Ensure the storage_path is properly formatted
        if (imageData.storage_path && !imageData.storage_path.startsWith('/')) {
            imageData.storage_path = '/' + imageData.storage_path;
            imageData.src = imageData.storage_path;
        }

        // Ensure the thumbnail_path is properly formatted
        if (imageData.thumbnail_path && !imageData.thumbnail_path.startsWith('/')) {
            imageData.thumbnail_path = '/' + imageData.thumbnail_path;
        }

        // Add origin to paths if they're relative
        const origin = req.get('origin') || '';

        // Only add origin for relative paths that start with /
        if (imageData.storage_path && imageData.storage_path.startsWith('/')) {
            // Don't add origin if it's already an absolute URL
            if (!imageData.storage_path.startsWith('http')) {
                imageData.storage_path_full = `${origin}${imageData.storage_path}`;
                imageData.src = imageData.storage_path_full;
            }
        }

        if (imageData.thumbnail_path && imageData.thumbnail_path.startsWith('/')) {
            // Don't add origin if it's already an absolute URL
            if (!imageData.thumbnail_path.startsWith('http')) {
                imageData.thumbnail_path_full = `${origin}${imageData.thumbnail_path}`;
            }
        }

        console.log(`Returning image ${imageId} from project ${projectId} with data:`, {
            id: imageData.id,
            name: imageData.name,
            storage_path: imageData.storage_path,
            thumbnail_path: imageData.thumbnail_path,
            src: imageData.src
        });
        res.status(200).json(imageData);
    } catch (error) {
        console.error('Error fetching image:', error);
        next(error);
    }
});

// GET /api/projects/:projectId/images - Get images in a project with optional name filter
// @ts-ignore // TS2769: No overload matches this call.
router.get('/projects/:projectId/images', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log(`GET /api/projects/${req.params.projectId}/images called`);
    const userId = req.user?.userId;
    const { projectId } = req.params;
    const { name } = req.query; // Optional name filter

    console.log(`User ID: ${userId}, Project ID: ${projectId}, Name filter: ${name || 'none'}`);

    try {
        // Verify user has access to the project
        console.log(`Verifying project access for project ${projectId} and user ${userId}`);
        const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
        console.log(`Project check result: ${JSON.stringify(projectCheck.rows)}`);

        if (projectCheck.rows.length === 0) {
            console.log(`Project not found or access denied for project ${projectId} and user ${userId}`);
            res.status(404).json({ message: 'Project not found or access denied' });
            return;
        }

        // Get images, optionally filtered by name
        let imageResult;
        if (name) {
            console.log(`Fetching images with name ${name} from project ${projectId}`);
            imageResult = await pool.query(
                'SELECT * FROM images WHERE project_id = $1 AND name = $2 ORDER BY created_at DESC',
                [projectId, name]
            );
        } else {
            console.log(`Fetching all images from project ${projectId}`);
            imageResult = await pool.query(
                'SELECT * FROM images WHERE project_id = $1 ORDER BY created_at DESC',
                [projectId]
            );
        }
        console.log(`Found ${imageResult.rows.length} images`);

        // Process each image to ensure paths are properly formatted
        const origin = req.get('origin') || '';
        const processedImages = imageResult.rows.map(image => {
            const processedImage = {
                ...image,
                src: image.storage_path
            };

            // Ensure the storage_path is properly formatted
            if (processedImage.storage_path && !processedImage.storage_path.startsWith('/')) {
                processedImage.storage_path = '/' + processedImage.storage_path;
                processedImage.src = processedImage.storage_path;
            }

            // Ensure the thumbnail_path is properly formatted
            if (processedImage.thumbnail_path && !processedImage.thumbnail_path.startsWith('/')) {
                processedImage.thumbnail_path = '/' + processedImage.thumbnail_path;
            }

            // Add origin to paths if they're relative
            if (processedImage.storage_path && processedImage.storage_path.startsWith('/')) {
                // Don't add origin if it's already an absolute URL
                if (!processedImage.storage_path.startsWith('http')) {
                    processedImage.storage_path_full = `${origin}${processedImage.storage_path}`;
                    processedImage.src = processedImage.storage_path_full;
                }
            }

            if (processedImage.thumbnail_path && processedImage.thumbnail_path.startsWith('/')) {
                // Don't add origin if it's already an absolute URL
                if (!processedImage.thumbnail_path.startsWith('http')) {
                    processedImage.thumbnail_path_full = `${origin}${processedImage.thumbnail_path}`;
                }
            }

            return processedImage;
        });

        res.status(200).json(processedImages);
    } catch (error) {
        console.error('Error fetching images:', error);
        next(error);
    }
});

// POST /api/images/:projectId/upload - Upload new images to a project
// @ts-ignore // TS2769: No overload matches this call.
router.post('/:projectId/upload', authMiddleware, upload.array('images', 10), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Placeholder: Implement actual logic here following the same pattern
    console.log(`POST /api/images/${req.params.projectId}/upload called`);
    res.status(501).json({ message: 'Not Implemented' });
});

export default router;