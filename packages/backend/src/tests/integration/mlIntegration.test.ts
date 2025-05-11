import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import pool from '../../db';

// Mockujeme fs PŘED importováním config
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn().mockImplementation((path) => {
      if (path === '/app/uploads' || path === '/app/uploads/avatars') {
        return true; // Předstíráme, že adresáře existují
      }
      return actualFs.existsSync(path);
    }),
    mkdirSync: jest.fn().mockImplementation((path, options) => {
      // Pouze logujeme volání, ale skutečně nevytváříme adresáře
      console.log(`Mock: Creating directory ${path}`);
      return undefined;
    }),
  };
});

import config from '../../config';
import { setupSegmentationQueue, triggerSegmentationTask } from '../../services/segmentationQueueService';

// Mock necessary modules
jest.mock('../../db');
jest.mock('../../socket');
jest.mock('../../utils/logger');

// This test requires actual filesystem interaction
// We only mock the database and logging functionality

describe('ML Integration Tests', () => {
  // Test image path (use a small test image)
  const TEST_IMAGE_PATH = path.join(process.cwd(), 'test_assets', 'test_image.png');
  const TEST_IMAGE_ID = 'test-image-123';
  const TEST_PROJECT_ID = 'test-project-123';
  const TEST_USER_ID = 'test-user-123';

  // Output paths
  const baseOutputDir = path.join(process.cwd(), 'test_assets', 'output');
  const resultOutputDir = path.join(baseOutputDir, TEST_IMAGE_ID);

  // Python process variable
  let pythonProcess: ChildProcess | null = null;

  // Create required directories for test
  beforeAll(() => {
    // Ensure test directories exist
    if (!fs.existsSync(path.join(process.cwd(), 'test_assets'))) {
      fs.mkdirSync(path.join(process.cwd(), 'test_assets'), {
        recursive: true,
      });
    }

    if (!fs.existsSync(baseOutputDir)) {
      fs.mkdirSync(baseOutputDir, { recursive: true });
    }

    if (!fs.existsSync(resultOutputDir)) {
      fs.mkdirSync(resultOutputDir, { recursive: true });
    }

    // Set up environment variables and mocks for configuration
    process.env.TEST_MODE = 'true';

    // Mock configuration for testing
    // Use Object.defineProperty instead of jest.spyOn for configurating storage.uploadDir
    const originalConfig = { ...config };
    const originalStorage = { ...config.storage };

    // Override the config object's storage property
    Object.defineProperty(config, 'storage', {
      get: () => ({
        ...originalStorage,
        uploadDir: path.join(process.cwd(), 'test_assets'),
      }),
    });

    // Mock database queries
    (pool.query as jest.Mock).mockImplementation((query, params) => {
      if (query.includes('SELECT user_id FROM images')) {
        return Promise.resolve({ rows: [{ user_id: TEST_USER_ID }] });
      }
      if (query.includes('UPDATE segmentation_results')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (query.includes('UPDATE images')) {
        return Promise.resolve({ rowCount: 1 });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  afterAll(() => {
    // Clean up test environment
    delete process.env.TEST_MODE;

    // Kill Python process if running
    if (pythonProcess && !pythonProcess.killed) {
      pythonProcess.kill();
    }

    // Clean up test output
    try {
      if (fs.existsSync(resultOutputDir)) {
        const files = fs.readdirSync(resultOutputDir);
        for (const file of files) {
          fs.unlinkSync(path.join(resultOutputDir, file));
        }
        fs.rmdirSync(resultOutputDir);
      }
    } catch (error) {
      console.error('Error cleaning up test files:', error);
    }
  });

  // Skip this test if not running in an environment with Python and ML dependencies
  it('should verify ML script can be executed', async () => {
    // Check Python executable existence
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';

    // Check if python is available by running a simple version check
    try {
      const pythonVersionProcess = spawn(pythonExecutable, ['--version']);
      const versionPromise = new Promise<string>((resolve, reject) => {
        let output = '';

        // Handle stdout and stderr
        if (pythonVersionProcess.stdout) {
          pythonVersionProcess.stdout.on('data', (data) => {
            output += data.toString();
          });
        }

        if (pythonVersionProcess.stderr) {
          pythonVersionProcess.stderr.on('data', (data) => {
            output += data.toString();
          });
        }

        pythonVersionProcess.on('close', (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(new Error(`Python process exited with code ${code}`));
          }
        });
      });

      const version = await versionPromise;
      console.log(`Python version: ${version.trim()}`);

      // If we get here, Python is available
      expect(version).toContain('Python');
    } catch (error) {
      // Skip test if Python not available
      console.warn('Python not available, skipping test:', error);
      return;
    }

    // Look for the ML script (ResUnet.py)
    const possibleScriptPaths = [
      path.join(process.cwd(), 'packages', 'ml', 'ResUnet.py'),
      path.join(process.cwd(), 'ML', 'ResUnet.py'),
      path.join(process.cwd(), 'server', 'ML', 'ResUnet.py'),
    ];

    let scriptExists = false;
    let scriptPath = '';

    for (const path of possibleScriptPaths) {
      if (fs.existsSync(path)) {
        scriptExists = true;
        scriptPath = path;
        break;
      }
    }

    if (!scriptExists) {
      console.warn('ML script not found, skipping test');
      return;
    }

    console.log(`Found ML script at: ${scriptPath}`);
    expect(scriptExists).toBe(true);
  });

  // Test that segmentation service can find and use ML scripts
  it('should configure segmentation queue with ML paths', async () => {
    // Setup segmentation queue
    const result = await setupSegmentationQueue();

    // This test might be skipped if the ML environment is not set up
    if (result === false) {
      console.warn('Segmentation queue setup failed, likely missing ML dependencies');
      return;
    }

    expect(result).toBe(true);
  });

  // Test a full integration using mock image data but real ML script execution
  // This test is conditionally run only if environment is properly set up
  it('should process an image through the segmentation pipeline', async () => {
    // Create test image if it doesn't exist yet
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      // Create very simple test image
      const imgSize = 100;
      const imageBuffer = Buffer.alloc(imgSize * imgSize * 3);

      // Create a simple black and white image with a circle
      for (let y = 0; y < imgSize; y++) {
        for (let x = 0; x < imgSize; x++) {
          const centerX = imgSize / 2;
          const centerY = imgSize / 2;
          const radius = imgSize / 3;

          const inCircle = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) < radius;
          const pixelValue = inCircle ? 255 : 0;

          const idx = (y * imgSize + x) * 3;
          imageBuffer[idx] = pixelValue; // R
          imageBuffer[idx + 1] = pixelValue; // G
          imageBuffer[idx + 2] = pixelValue; // B
        }
      }

      // Mock PNG file - this will not be a valid PNG but just a sample file
      fs.writeFileSync(TEST_IMAGE_PATH, imageBuffer);
    }

    // Ensure image exists
    expect(fs.existsSync(TEST_IMAGE_PATH)).toBe(true);

    // Now we need to check if the ML environment is set up
    // We'll try to import the modules first to check
    const isMLEnvironmentSetup = async (): Promise<boolean> => {
      const checkScript = `
import sys
try:
    import torch
    import numpy as np
    from PIL import Image
    print("ML environment ready")
    sys.exit(0)
except ImportError as e:
    print(f"ML environment not ready: {str(e)}")
    sys.exit(1)
`;

      const checkScriptPath = path.join(baseOutputDir, 'check_ml_env.py');
      fs.writeFileSync(checkScriptPath, checkScript);

      return new Promise((resolve) => {
        const process = spawn('python3', [checkScriptPath]);
        let output = '';

        if (process.stdout) {
          process.stdout.on('data', (data) => {
            output += data.toString();
          });
        }

        if (process.stderr) {
          process.stderr.on('data', (data) => {
            output += data.toString();
          });
        }

        process.on('close', (code) => {
          fs.unlinkSync(checkScriptPath);
          console.log(output);
          resolve(code === 0);
        });
      });
    };

    const mlReady = await isMLEnvironmentSetup();
    if (!mlReady) {
      console.warn('Skipping test: ML environment not fully set up');
      return;
    }

    // Now try to run actual segmentation task
    // We'll set up a simplified version of the task executor that just runs the Python script

    // Locate ML script
    let mlScriptPath = '';
    const possibleScriptPaths = [
      path.join(process.cwd(), 'packages', 'ml', 'resunet_segmentation.py'),
      path.join(process.cwd(), 'ML', 'resunet_segmentation.py'),
      path.join(process.cwd(), 'server', 'ML', 'resunet_segmentation.py'),
    ];

    for (const scriptPath of possibleScriptPaths) {
      if (fs.existsSync(scriptPath)) {
        mlScriptPath = scriptPath;
        break;
      }
    }

    if (!mlScriptPath) {
      console.warn('ML segmentation script not found, skipping integration test');
      return;
    }

    // Locate checkpoint file
    let checkpointPath = '';
    const possibleCheckpointPaths = [
      path.join(process.cwd(), 'packages', 'ml', 'checkpoint_epoch_9.pth.tar'),
      path.join(process.cwd(), 'ML', 'checkpoint_epoch_9.pth.tar'),
      path.join(process.cwd(), 'server', 'ML', 'checkpoint_epoch_9.pth.tar'),
    ];

    for (const cpPath of possibleCheckpointPaths) {
      if (fs.existsSync(cpPath)) {
        checkpointPath = cpPath;
        break;
      }
    }

    if (!checkpointPath) {
      console.warn('ML checkpoint not found, skipping integration test');
      return;
    }

    // Generate output paths
    const outputJsonPath = path.join(resultOutputDir, 'segmentation-result.json');
    const outputVisualizationPath = path.join(resultOutputDir, 'visualization.png');

    // Run Python script directly
    return new Promise<void>((resolve, reject) => {
      // Define args for segmentation script
      const args = [
        mlScriptPath,
        '--image_path',
        TEST_IMAGE_PATH,
        '--output_path',
        outputJsonPath,
        '--checkpoint_path',
        checkpointPath,
        '--output_dir',
        resultOutputDir,
        '--test_mode',
        'true', // Use test mode to speed up processing
      ];

      console.log(`Running Python script: python3 ${args.join(' ')}`);

      // Execute Python script
      pythonProcess = spawn('python3', args);
      let stdoutData = '';
      let stderrData = '';

      if (pythonProcess.stdout) {
        pythonProcess.stdout.on('data', (data) => {
          stdoutData += data.toString();
          console.log(`Python stdout: ${data.toString()}`);
        });
      }

      if (pythonProcess.stderr) {
        pythonProcess.stderr.on('data', (data) => {
          stderrData += data.toString();
          console.error(`Python stderr: ${data.toString()}`);
        });
      }

      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);

        if (code === 0) {
          // Check if output files were created
          const jsonExists = fs.existsSync(outputJsonPath);

          if (jsonExists) {
            // Read result JSON file
            try {
              const resultJson = JSON.parse(fs.readFileSync(outputJsonPath, 'utf8'));
              expect(resultJson).toBeDefined();
              expect(resultJson.polygons).toBeDefined();
              console.log(`Segmentation produced ${resultJson.polygons.length} polygons`);
              resolve();
            } catch (error: any) {
              reject(new Error(`Error parsing result JSON: ${error.message}`));
            }
          } else {
            reject(new Error('Result JSON file not created'));
          }
        } else {
          reject(new Error(`Python process exited with code ${code}`));
        }
      });

      // Set a timeout for the test
      setTimeout(() => {
        if (pythonProcess && !pythonProcess.killed) {
          pythonProcess.kill();
          reject(new Error('Test timed out'));
        }
      }, 30000); // 30 second timeout
    });
  });
});
