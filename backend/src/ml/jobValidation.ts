import { z } from 'zod';

export const SegmentationJobDataSchema = z.object({
  jobId: z.string().optional(),
  fileId: z.string(),
  signedUrl: z.string().optional(),
  filePath: z.string().optional(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  params: z.record(z.any())
});

export type SegmentationJobData = z.infer<typeof SegmentationJobDataSchema>;

export function safeParseJobData(data: unknown): SegmentationJobData {
  const result = SegmentationJobDataSchema.safeParse(data);
  if (!result.success) {
    const formatted = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    const error = new Error(`Zod validation error: ${formatted}`);
    (error as any).zodError = result.error;
    throw error;
  }
  return result.data;
}