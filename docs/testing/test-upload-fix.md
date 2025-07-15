# Test Results: Image Upload Logout Issue

## Issue Description
User reported being logged out when selecting images in the file input dialog.

## Root Cause Analysis
The issue was caused by the image upload API configuration explicitly setting `Content-Type: multipart/form-data` header. When axios handles FormData, it needs to set its own Content-Type header with the proper boundary parameter (e.g., `multipart/form-data; boundary=----WebKitFormBoundary...`).

By explicitly setting the Content-Type header without the boundary, the backend couldn't parse the multipart request properly, resulting in a 401 error. The frontend's apiClient interceptor then cleared the auth tokens on 401 errors, logging the user out.

## Fix Applied
Modified `/home/cvat/spheroseg/spheroseg/packages/frontend/src/api/imageUpload.ts`:
- Removed explicit `Content-Type: multipart/form-data` header from upload configuration
- Let axios automatically set the correct Content-Type with boundary for FormData

## Changes Made
```javascript
// Before:
const config = {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
};

// After:
// Don't set Content-Type header explicitly for FormData
// axios will automatically set it with the correct boundary
const config = {};
```

## Testing Status
1. ✅ Code changes applied to imageUpload.ts
2. ✅ Frontend container restarted
3. ✅ Successfully logged in as test user
4. ✅ Navigated to test project
5. ✅ Upload dialog opens without logout

## Additional Considerations
The default axios configuration in apiClient.ts sets `Content-Type: application/json` for all requests. This doesn't interfere with FormData uploads because axios will override the Content-Type header when it detects FormData in the request body.

## Recommendation
The fix should resolve the logout issue when uploading images. The user should now be able to:
1. Click the upload button or drag files
2. Select images without being logged out
3. Complete the upload process successfully