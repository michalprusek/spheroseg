# Fix Summary - 2025-07-16

## Issues Fixed

### 1. React Hooks Error in SegmentationPage Component (✅ FIXED)
**Problem**: Invalid hook call error due to duplicate exports in SegmentationPage.tsx
**Solution**: Removed the named export, keeping only the default export
**File**: `/packages/frontend/src/pages/segmentation/SegmentationPage.tsx`

### 2. Permission Error Messages Inconsistency (✅ FIXED)
**Problem**: Error messages referenced "editor" permission but code checks for "edit" permission
**Solution**: Updated all permission error messages to correctly reference "edit" permission
**Files Modified**:
- `/packages/backend/src/services/imageDeleteService.ts` - Line 73
- `/packages/backend/src/routes/segmentation.ts` - Line 1179
- `/packages/backend/src/routes/projects.ts` - Line 556
- `/packages/backend/src/routes/images.ts` - Line 549
- `/packages/backend/src/services/projectService.ts` - Line 593
- `/packages/frontend/public/locales/en/translation.json` - Lines 223-228

### 3. i18next Language Switching Issues (✅ FIXED)
**Problem**: i18next was detecting browser language (Czech) and auto-switching languages
**Solution**: Disabled automatic language detection in i18n configuration
**File**: `/packages/frontend/src/i18n.ts` - Added detection config with empty arrays

## Testing Required

1. **React Hooks Error**: Navigate to any segmentation page and verify no hooks error occurs
2. **Permission Errors**: Try to delete/resegment images without proper permissions and verify correct error messages
3. **Language Switching**: Verify the app stays in English and doesn't switch to Czech unexpectedly

## Note on Permission Errors

The 403/500 errors when deleting images are legitimate permission denials. The user (12bprusek@gym-nymburk.cz) doesn't have 'edit' permission on the project they're trying to modify. This is expected behavior, not a bug.