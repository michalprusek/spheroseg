# SpherosegV4 Dependency Analysis

## Summary of Findings

This analysis examines all package.json files in the monorepo to identify unused, redundant, and mismatched dependencies.

## 1. Root package.json Analysis

### Dependencies that should be removed from root:
- **@emotion/react** & **@emotion/styled**: Not used in the codebase (MUI is listed but barely used)
- **@mui/icons-material** & **@mui/material**: Only 2 files import from MUI (vite.config.ts and ProjectImageGrid.tsx)
- **i18next** & **react-i18next**: These are already in frontend, no need in root
- **jwt-decode**: Already in frontend, no need in root
- **pg**: Already in backend, no need in root
- **socket.io**: Already in backend (socket.io) and frontend (socket.io-client)
- **usehooks-ts**: Not used anywhere in the codebase

### DevDependencies that should be removed from root:
- **@types/bcryptjs**: Backend specific, not needed in root
- **@types/jest**: Should be in individual packages
- **@types/supertest**: Backend specific
- **bcryptjs**: Listed as devDep but is runtime dep in backend
- **cors**: Already in backend
- **express**: Already in backend
- **happy-dom**: Not used (frontend uses jsdom)
- **jest-html-reporters** & **jest-junit**: Not referenced in configs
- **jsdom**: Frontend specific

## 2. Frontend Package Analysis

### Overlapping/Redundant UI Libraries:
1. **Toast Libraries (DUPLICATE FUNCTIONALITY)**:
   - `react-hot-toast`: Used in 5 files
   - `sonner`: Used in 20+ files
   - **Recommendation**: Remove `react-hot-toast` and standardize on `sonner`

2. **UI Component Libraries**:
   - Uses Radix UI extensively (33+ files)
   - Material UI is in root but barely used
   - Has shadcn/ui components built on Radix
   - **Recommendation**: Remove MUI dependencies from root

### Verified Unused Dependencies:
- **@types/lodash**: lodash is not in dependencies
- **simplify-js**: Not imported anywhere (polygon simplification likely done differently)

### Dependencies Actually in Use:
- **embla-carousel-react**: Used in carousel.tsx component
- **framer-motion**: Used extensively (10+ files) for animations
- **recharts**: Used in chart components (5 files)
- **xlsx**: Used for Excel export functionality (6+ files)

### More Dependencies Actually in Use:
- **react-dropzone**: Used in file upload components (6 files)
- **web-vitals**: Used for performance monitoring (2 files)

### Still Need Verification:
- **cmdk**: May be used in command palette
- **input-otp**: Check if OTP input is used
- **next-themes**: Theme provider (verify if used with Radix)
- **react-day-picker**: Date picker (verify usage)
- **react-image-crop**: Image cropping (verify usage)
- **react-resizable-panels**: Resizable panels (verify usage)
- **vaul**: Drawer component (verify usage)

### DevDependencies Issues:
- **@babel/preset-\***: Not needed with Vite + SWC
- **@vitejs/plugin-react-swc**: Duplicate of @vitejs/plugin-react
- **identity-obj-proxy**: CSS modules mock (check if used in tests)
- **resize-observer-polyfill**: May not be needed for modern browsers

### Version Mismatches:
- **vite**: Frontend has ^5.4.1, root has ^6.3.4
- **typescript**: Multiple versions (^5.8.3, ^5.5.3, ^5.0.0)
- **uuid**: Different versions (^11.1.0, ^9.0.1)

## 3. Backend Package Analysis

### Backend Dependencies in Active Use:
- **sharp**: Used extensively for image processing (6 files)
- **winston**: Used for logging (3 files)
- **amqplib**: Used in segmentationQueueService.ts for message queuing

### Potentially Unused/Replaceable Dependencies:
- **compression**: Middleware (verify usage)
- **cookie-parser**: Cookie parsing (verify if cookies are used)
- **node-fetch**: Can use native fetch in Node 18+
- **nodemailer**: Only in emailService.ts (verify if email is implemented)

### Missing from Dependencies but in DevDependencies:
- **@spheroseg/types**: Should be in dependencies, not devDependencies

## 4. Shared & Types Packages

### Issues:
- **uuid version mismatch**: shared has ^9.0.1, others have ^11.1.0
- **Minimal dependencies**: These packages are clean

## 5. ML Service (Python)

The Python requirements.txt looks reasonable for a PyTorch-based ML service.

## Recommendations

### Immediate Actions:

1. **Remove from root package.json**:
   ```json
   // Remove these dependencies
   "@emotion/react"
   "@emotion/styled"
   "@mui/icons-material"
   "@mui/material"
   "i18next"
   "jwt-decode"
   "pg"
   "socket.io"
   "usehooks-ts"
   "react-i18next"
   
   // Remove these devDependencies
   "@types/bcryptjs"
   "@types/jest"
   "@types/supertest"
   "bcryptjs"
   "cors"
   "express"
   "happy-dom"
   "jest-html-reporters"
   "jest-junit"
   "jsdom"
   ```

2. **Frontend cleanup**:
   - Remove `react-hot-toast` and use only `sonner`
   - Remove `@babel/*` presets (using SWC)
   - Remove `@vitejs/plugin-react-swc` (duplicate)
   - Remove `@types/lodash` (no lodash in use)
   - Remove `simplify-js` (not imported anywhere)

3. **Standardize versions**:
   - TypeScript: Use ^5.8.3 everywhere
   - UUID: Use ^11.1.0 everywhere
   - Vite: Decide on v5 or v6

4. **Move dependencies**:
   - Backend: Move `@spheroseg/types` to dependencies

### Investigation Needed:

1. Check actual usage of:
   - Frontend: cmdk, embla-carousel, framer-motion, recharts, xlsx, web-vitals
   - Backend: amqplib, nodemailer, winston, sharp

2. Consider removing if not used:
   - Frontend animation/UI libraries if not providing value
   - Backend libraries that duplicate native functionality

### Best Practices:

1. Use workspace:* for internal package dependencies
2. Keep shared dependencies in root only if truly shared
3. Use exact versions for production dependencies
4. Regular dependency audits to prevent accumulation

## Script to Check Unused Dependencies

You can use `depcheck` to verify:

```bash
# Install globally
npm install -g depcheck

# Run in each package
cd packages/frontend && depcheck
cd packages/backend && depcheck
```

This will help identify dependencies that are declared but never imported.