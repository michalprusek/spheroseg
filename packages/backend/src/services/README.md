# Service Components Documentation

## File Cleanup Service

The `fileCleanupService` handles the deletion of file resources associated with database entities when those entities are deleted. This ensures proper cleanup of all related file resources and prevents orphaned files from accumulating on the file system.

### Key Features

- **Safe File Deletion**: Validates file ownership and existence before deletion
- **Transactional Operations**: Integrates with database transactions to ensure consistency
- **Comprehensive Cleanup**: Handles all file types associated with projects:
  - Original image files
  - Thumbnail images
  - Segmentation mask files
  - Segmentation visualization files
  - Project directories
- **Error Handling**: Gracefully handles missing files and permission issues
- **Dry Run Support**: Can preview files that would be deleted without performing actual deletion

### Usage

```typescript
import { cleanupProjectFiles } from '../services/fileCleanupService';

// Delete all files associated with a project
const result = await cleanupProjectFiles(pool, projectId, {
  transactionClient: transactionClient, // Optional transaction client
  dryRun: false // Set to true to preview deletions without performing them
});

// The result includes information about the operation
console.log(`Deleted ${result.deletedFiles.length} files`);
if (result.failedFiles.length > 0) {
  console.error(`Failed to delete ${result.failedFiles.length} files`);
}
```

### Implementation Details

1. **Project Deletion Process**:
   - Begin database transaction
   - Verify project ownership
   - Identify all files associated with the project
   - Delete each file from the filesystem
   - Delete the project directory
   - Delete database records
   - Commit or rollback transaction based on success

2. **File Identification**:
   - Queries `images` table for image and thumbnail paths
   - Queries `segmentation_results` table for mask and visualization paths
   - Collects all paths into a list for deletion

3. **Safety Measures**:
   - Transaction ensures DB consistency
   - Project ownership verification prevents unauthorized deletion
   - File path validation prevents deleting unrelated files
   - Error tracking for each file deletion operation

### Error Handling

- If file deletion fails, the transaction is rolled back to prevent inconsistent state
- Each file deletion error is logged and tracked
- The API response includes details about any failed file deletions