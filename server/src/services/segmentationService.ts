import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import pool from '../db';
import { io } from '../server'; // Import Socket.IO instance

// --- Task Queue Implementation ---
interface SegmentationTask {
    imageId: string;
    imagePath: string;
    parameters: any;
    priority: number; // Higher number = higher priority
    addedAt: Date;
}

class SegmentationQueue {
    private queue: SegmentationTask[] = [];
    private running: Set<string> = new Set(); // Set of imageIds currently being processed
    private maxConcurrent: number = 2; // Maximum number of concurrent tasks

    constructor(maxConcurrent?: number) {
        if (maxConcurrent && maxConcurrent > 0) {
            this.maxConcurrent = maxConcurrent;
        }
        console.log(`Segmentation queue initialized with max ${this.maxConcurrent} concurrent tasks`);
    }

    // Add a task to the queue
    async addTask(task: SegmentationTask): Promise<void> {
        // Check if task is already in queue or running
        if (this.isTaskQueued(task.imageId) || this.isTaskRunning(task.imageId)) {
            console.log(`Task for image ${task.imageId} is already queued or running. Skipping.`);
            return;
        }

        // Add task to queue
        this.queue.push(task);
        console.log(`Added task for image ${task.imageId} to queue. Queue length: ${this.queue.length}`);

        // Sort queue by priority (descending) and then by addedAt (ascending)
        this.queue.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // Higher priority first
            }
            return a.addedAt.getTime() - b.addedAt.getTime(); // Older tasks first
        });

        // Emit queue status update
        await this.emitQueueStatusUpdate();

        // Process queue
        this.processQueue().catch(err => {
            console.error('Error processing queue after adding task:', err);
        });
    }

    // Check if a task for the given imageId is already in the queue
    isTaskQueued(imageId: string): boolean {
        return this.queue.some(task => task.imageId === imageId);
    }

    // Check if a task for the given imageId is currently running
    isTaskRunning(imageId: string): boolean {
        return this.running.has(imageId);
    }

    // Process the next task in the queue if possible
    async processQueue(): Promise<void> {
        // Check if we can process more tasks
        if (this.running.size >= this.maxConcurrent) {
            console.log(`Already running ${this.running.size} tasks. Max is ${this.maxConcurrent}. Waiting.`);
            return;
        }

        // Get the next task from the queue
        const task = this.queue.shift();
        if (!task) {
            console.log('No tasks in queue.');
            return;
        }

        // Mark task as running
        this.running.add(task.imageId);
        console.log(`Starting task for image ${task.imageId}. ${this.queue.length} tasks remaining in queue.`);

        // Emit queue status update via WebSocket
        await this.emitQueueStatusUpdate();

        // Execute the task
        executeSegmentationTask(task.imageId, task.imagePath, task.parameters)
            .then(async () => {
                console.log(`Task for image ${task.imageId} completed.`);
                // Remove task from running set
                this.running.delete(task.imageId);
                // Emit queue status update
                await this.emitQueueStatusUpdate();
                // Process next task
                this.processQueue().catch(err => {
                    console.error('Error processing next task in queue:', err);
                });
            })
            .catch(async error => {
                console.error(`Task for image ${task.imageId} failed:`, error);
                // Remove task from running set
                this.running.delete(task.imageId);
                // Emit queue status update
                await this.emitQueueStatusUpdate();
                // Process next task
                this.processQueue().catch(err => {
                    console.error('Error processing next task in queue after failure:', err);
                });
            });
    }

    // Get current queue status
    getStatus(): { queueLength: number, runningTasks: string[], queuedTasks: string[] } {
        return {
            queueLength: this.queue.length,
            runningTasks: Array.from(this.running),
            queuedTasks: this.queue.map(task => task.imageId)
        };
    }

    // Emit queue status update via WebSocket
    async emitQueueStatusUpdate(): Promise<void> {
        const status = this.getStatus();
        console.log(`Emitting queue status update: ${status.runningTasks.length} running, ${status.queueLength} queued`);

        try {
            // Get image details for running tasks
            if (status.runningTasks.length > 0) {
                const imagesQuery = await pool.query(
                    `SELECT id, name, project_id FROM images WHERE id = ANY($1::uuid[])`,
                    [status.runningTasks]
                );

                const processingImages = imagesQuery.rows.map(image => ({
                    id: image.id,
                    name: image.name,
                    projectId: image.project_id
                }));

                // Emit enhanced status with image details
                io.emit('segmentation_queue_update', {
                    ...status,
                    processingImages
                });
            } else {
                // No running tasks, just emit basic status
                io.emit('segmentation_queue_update', status);
            }
        } catch (error) {
            console.error('Error enhancing queue status with image details:', error);
            // Fall back to basic status if there's an error
            io.emit('segmentation_queue_update', status);
        }
    }
}

// Create a singleton instance of the queue
const segmentationQueue = new SegmentationQueue(process.env.MAX_CONCURRENT_SEGMENTATIONS ?
    parseInt(process.env.MAX_CONCURRENT_SEGMENTATIONS) : undefined);

// --- Configuration ---
// Adjust these paths based on your project structure
// Python executable path - použijeme virtuální prostředí, pokud je k dispozici
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || (fs.existsSync('/venv/bin/python') ? '/venv/bin/python' : 'python3');
// Cesta k Python skriptu - bude použita, pokud není nastavena proměnná ML_SERVICE_URL
const SCRIPT_PATH = '/ML/resunet_segmentation.py';

// URL ML služby - pokud je nastavena, bude použita místo lokálního spuštění skriptu
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || '';

// Look for the checkpoint in multiple locations
let CHECKPOINT_PATH = '/ML/checkpoint_epoch_9.pth.tar';

// Check if the checkpoint exists in the user's ML directory
const userMLPath = '/Users/michalprusek/PycharmProjects/spheroseg_v4/ML/checkpoint_epoch_9.pth.tar';
if (fs.existsSync(userMLPath)) {
    CHECKPOINT_PATH = userMLPath;
    console.log(`Using checkpoint from user's ML directory: ${CHECKPOINT_PATH}`);
} else {
    console.log(`Using default checkpoint path: ${CHECKPOINT_PATH}`);
}
const BASE_UPLOADS_DIR = '/app/uploads'; // Base directory for input images

const SERVER_ROOT = path.resolve(__dirname, '..', '..'); // Assuming src/services is two levels down
const BASE_OUTPUT_DIR = path.join(SERVER_ROOT, 'uploads', 'segmentations');

// Ensure the directory exists when the module loads
try {
    if (!fs.existsSync(BASE_OUTPUT_DIR)) {
        fs.mkdirSync(BASE_OUTPUT_DIR, { recursive: true });
        console.log(`Created segmentation output directory: ${BASE_OUTPUT_DIR}`);
    }
} catch (err) {
    console.error(`Error creating segmentation output directory ${BASE_OUTPUT_DIR}:`, err);
    // Depending on the application's needs, you might want to throw the error
    // or handle it in a way that allows the server to start but logs the issue.
}

// Function to update status in DB and notify client
async function updateSegmentationStatus(imageId: string, status: 'completed' | 'failed', resultPath?: string | null, errorLog?: string, polygons?: any[]) {
    console.log(`Updating status for image ${imageId} to ${status}. Result path: ${resultPath}, Error: ${errorLog}`);
    let clientResultPath: string | null = null;
    if (resultPath) {
        // Convert absolute server path to a relative URL path accessible by the client
        if (resultPath.startsWith('/uploads/')) {
            clientResultPath = resultPath; // Already in the correct format
        } else if (resultPath.startsWith('/app/uploads/')) {
            clientResultPath = resultPath.replace('/app/uploads/', '/uploads/');
        } else if (resultPath.startsWith(BASE_UPLOADS_DIR)) {
            clientResultPath = resultPath.replace(BASE_UPLOADS_DIR, '/uploads');
        } else {
            // Fallback to relative path
            clientResultPath = path.relative(BASE_UPLOADS_DIR, resultPath).replace(/\\/g, '/');
            if (!clientResultPath.startsWith('/')) {
                clientResultPath = '/' + clientResultPath;
            }
        }
        console.log(`Converted result path: ${resultPath} -> ${clientResultPath}`);
    }

    try {
        // Update segmentation_results table with structured data
        await pool.query(
            `UPDATE segmentation_results SET status = $1, result_data = $2, updated_at = NOW() WHERE image_id = $3`,
            [status, clientResultPath ? {
                path: clientResultPath,
                polygons: polygons || [], // Include polygons if available
                metadata: {
                    processedAt: new Date().toISOString(),
                    modelType: 'resunet',
                    hasNestedObjects: polygons ? polygons.some(p => p.type === 'internal') : false
                }
            } : null, imageId] // Store result path, polygons, and metadata in result_data
        );
        // Update images table
        await pool.query(
            `UPDATE images SET status = $1, updated_at = NOW() WHERE id = $2`,
            [status, imageId]
        );

        // Notify the client via Socket.IO
        const userRoom = imageId; // Use imageId or fetch userId if needed for room
        // Fetch user ID associated with the image to target the correct user room
        const userQuery = await pool.query('SELECT user_id FROM images WHERE id = $1', [imageId]);
        if (userQuery.rows.length > 0) {
            const userId = userQuery.rows[0].user_id;
            console.log(`Emitting segmentation update to user room: ${userId}, Image ID: ${imageId}, Status: ${status}`);
            io.to(userId).emit('segmentation_update', {
                imageId: imageId,
                status: status,
                resultPath: clientResultPath, // Send client-accessible path
                error: errorLog,
            });
        } else {
             console.error(`Could not find user ID for image ${imageId} to send socket notification.`);
        }

    } catch (dbError) {
        console.error(`Database error updating status for image ${imageId}:`, dbError);
    }
}

// Function to add a segmentation task to the queue
export const triggerSegmentationTask = async (imageId: string, imagePath: string, parameters: any, priority: number = 1) => {
    console.log(`Queueing segmentation for imageId: ${imageId}, path: ${imagePath}, priority: ${priority}`);

    try {
        // Add task to queue
        await segmentationQueue.addTask({
            imageId,
            imagePath,
            parameters,
            priority,
            addedAt: new Date()
        });
    } catch (error) {
        console.error(`Error adding segmentation task for image ${imageId} to queue:`, error);
        throw error; // Re-throw to allow caller to handle the error
    }
};

// Function to get the current queue status
export const getSegmentationQueueStatus = () => {
    return segmentationQueue.getStatus();
};

// Actual execution function that processes a segmentation task
async function executeSegmentationTask(imageId: string, imagePath: string, parameters: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
        console.log(`Executing segmentation for imageId: ${imageId}, path: ${imagePath}`);

        // Construct absolute paths
        let absoluteImagePath;
        if (imagePath.startsWith('/app/')) {
            absoluteImagePath = imagePath;
        } else if (imagePath.startsWith('/uploads/')) {
            absoluteImagePath = path.join(BASE_UPLOADS_DIR, imagePath.substring('/uploads/'.length));
        } else {
            absoluteImagePath = path.join(BASE_UPLOADS_DIR, imagePath);
        }
        console.log(`Resolved image path: ${imagePath} -> ${absoluteImagePath}`);
        const outputFileName = `${path.parse(imagePath).name}_pred.png`;
        const absoluteOutputPath = path.join(BASE_OUTPUT_DIR, imageId, outputFileName); // Store under imageId subdir
        const logOutputDir = path.join(BASE_OUTPUT_DIR, imageId); // For logs

        // Ensure output directories exist
        try {
            await fs.promises.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
        } catch (mkdirError) {
            console.error(`Failed to create directory for segmentation output: ${path.dirname(absoluteOutputPath)}`, mkdirError);
            await updateSegmentationStatus(imageId, 'failed', null, 'Failed to create output directory');
            reject(mkdirError);
            return;
        }

        // Command arguments for segmentation script
        const args = [
            SCRIPT_PATH,
            '--image_path', absoluteImagePath,
            '--output_path', absoluteOutputPath,
            '--checkpoint_path', CHECKPOINT_PATH,
            '--output_dir', logOutputDir, // Specify separate dir for logs
        ];

        // Add any additional parameters from the request
        if (parameters) {
            // Explicitně přidáme model_type, pokud je k dispozici
            if (parameters.model_type) {
                console.log(`Using specified model type: ${parameters.model_type}`);
                args.push('--model_type', String(parameters.model_type));
            } else {
                // Pokud model_type není specifikován, použijeme výchozí hodnotu 'resunet'
                console.log('No model_type specified, using default: resunet');
                args.push('--model_type', 'resunet');
            }

            // Přidáme ostatní parametry
            Object.entries(parameters).forEach(([key, value]) => {
                // Ignorujeme parametr priority a model_type, které jsou zpracovány zvlášť
                if (key !== 'priority' && key !== 'model_type' && value !== undefined && value !== null) {
                    // Převedeme camelCase na snake_case pro Python argumenty
                    const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                    args.push(`--${snakeCaseKey}`, String(value));
                }
            });
        } else {
            // Pokud nejsou žádné parametry, použijeme výchozí hodnotu 'resunet'
            console.log('No parameters specified, using default model_type: resunet');
            args.push('--model_type', 'resunet');
        }

        console.log(`Executing command: ${PYTHON_EXECUTABLE} ${args.join(' ')}`);

        const pythonProcess = spawn(PYTHON_EXECUTABLE, args);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            stdoutData += output;
            console.log(`[Python Stdout - ${imageId}]: ${output.trim()}`);

            // Try to parse JSON output from the segmentation script
            try {
                // Look for valid JSON in the output - bez použití příznaků ES2018
                const jsonMatch = output.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonData = JSON.parse(jsonMatch[0]);
                    if (jsonData.polygons) {
                        console.log(`Found ${jsonData.polygons.length} polygons in segmentation output`);
                    }
                }
            } catch (jsonError) {
                // Not valid JSON or not complete yet, just continue collecting output
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            const errorOutput = data.toString();
            stderrData += errorOutput;
            console.error(`[Python Stderr - ${imageId}]: ${errorOutput.trim()}`);
        });

        pythonProcess.on('close', async (code) => {
            console.log(`Python script for image ${imageId} exited with code ${code}`);
            if (code === 0) {
                // Check if output file was actually created (optional but good practice)
                try {
                    await fs.promises.access(absoluteOutputPath);
                    console.log(`Segmentation successful for ${imageId}. Output: ${absoluteOutputPath}`);

                    // Try to parse polygons from stdout
                    let polygons = [];
                    try {
                        // Look for valid JSON in the output - bez použití příznaků ES2018
                        const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const jsonData = JSON.parse(jsonMatch[0]);
                            if (jsonData.polygons) {
                                console.log(`Found ${jsonData.polygons.length} polygons in segmentation output`);
                                polygons = jsonData.polygons;
                            }
                        }
                    } catch (jsonError) {
                        console.error(`Error parsing polygons from output: ${jsonError}`);
                    }

                    // Pass the absolute path and polygons to updateSegmentationStatus
                    await updateSegmentationStatus(imageId, 'completed', absoluteOutputPath, undefined, polygons);
                    resolve(); // Resolve the promise to indicate success
                } catch (fileError) {
                    console.error(`Segmentation script finished (code 0) but output file not found: ${absoluteOutputPath}`);
                    console.error(`Stderr: ${stderrData}`);
                    await updateSegmentationStatus(imageId, 'failed', null, `Script finished but output missing. Details: ${stderrData}`);
                    reject(fileError); // Reject the promise to indicate failure
                }
            } else {
                console.error(`Segmentation failed for ${imageId}. Exit code: ${code}. Stderr: ${stderrData}`);
                await updateSegmentationStatus(imageId, 'failed', null, `Script failed with code ${code}. Details: ${stderrData}`);
                reject(new Error(`Script failed with code ${code}`)); // Reject the promise to indicate failure
            }
        });

        pythonProcess.on('error', async (err) => {
            console.error(`Failed to start Python script for image ${imageId}:`, err);
            await updateSegmentationStatus(imageId, 'failed', null, `Failed to start script: ${err.message}`);
            reject(err); // Reject the promise to indicate failure
        });
    });
};

// Optional: Add functions to get or update results if needed directly by service
// export const getSegmentationResult = async (imageId: string) => { ... };
// export const updateSegmentationResult = async (imageId: string, result: any) => { ... };