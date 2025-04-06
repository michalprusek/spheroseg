import { getSignedUrl } from '../../storage/storageService';
import { addSegmentationJob } from '../queue';

interface SegmentationParams {
  [key: string]: any;
}

interface WorkerCallbackPayload {
  maskUrl?: string;
  error?: string;
  [key: string]: any;
}

export async function initiateSegmentationJob(
  db: any,
  projectId: string,
  fileId: string,
  params: SegmentationParams
): Promise<{ jobId: string; signedUrl: string }> {
  const signedUrl = await getSignedUrl(fileId);

  const result = await db.query(
    `INSERT INTO segmentation_jobs (project_id, file_id, status, metadata)
     VALUES ($1, $2, 'pending', $3)
     RETURNING id`,
    [projectId, fileId, JSON.stringify(params)]
  );
  const jobId = result[0].id;

  const callbackUrl = process.env.ML_CALLBACK_URL
    ? `${process.env.ML_CALLBACK_URL}/api/ml/jobs/${jobId}/callback`
    : null;
  const callbackToken = process.env.ML_CALLBACK_TOKEN || null;

  const payload = {
    jobId,
    fileId,
    signedUrl,
    params,
    callbackUrl,
    callbackToken,
  };

  try {
    await addSegmentationJob(payload);
  } catch (err) {
    if (err instanceof Error) {
      throw err;  // Preserve original error type
    } else {
      throw new Error('Failed to enqueue segmentation job');
    }
  }

  return { jobId, signedUrl };
}

export async function handleWorkerCallback(
  db: any,
  jobId: string,
  success: boolean,
  payload: WorkerCallbackPayload
): Promise<void> {
  if (success) {
    // Insert segmentation result
    const result = await db.query(
      `INSERT INTO segmentation_results (file_id, mask_path, metadata)
       VALUES (
         (SELECT file_id FROM segmentation_jobs WHERE id = $1),
         $2,
         $3
       )
       RETURNING id`,
      [jobId, payload.maskUrl, JSON.stringify(payload)]
    );
    const resultId = result[0].id;

    await db.query(
      `UPDATE segmentation_jobs
       SET status = 'completed', result_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [jobId, resultId]
    );
  } else {
    await db.query(
      `UPDATE segmentation_jobs
       SET status = 'failed', error_message = $2, updated_at = NOW()
       WHERE id = $1`,
      [jobId, payload.error || 'Unknown error']
    );
  }
}

export async function getSegmentationStatus(
  db: any,
  jobId: string
): Promise<string> {
  const result = await db.query(
    `SELECT status FROM segmentation_jobs WHERE id = $1`,
    [jobId]
  );
  if (!result || result.length === 0) {
    throw new Error('Job not found');
  }
  return result[0].status;
}

export async function getSegmentationResult(
  db: any,
  jobId: string
): Promise<{ resultUrl: string }> {
  const result = await db.query(
    `SELECT r.mask_path AS result_url
     FROM segmentation_jobs j
     LEFT JOIN segmentation_results r ON j.result_id = r.id
     WHERE j.id = $1`,
    [jobId]
  );
  if (!result || result.length === 0) {
    throw new Error('Job not found');
  }
  const url = result[0].result_url;
  if (!url) {
    throw new Error('Result not ready');
  }
  return { resultUrl: url };
}