# Permission Management Consolidation

## Overview

This document describes the consolidation of permission and authorization functionality into a unified permission service that provides comprehensive access control across the application.

## Problem Statement

The application had fragmented permission checking:
1. Basic role checks scattered across components
2. No centralized permission definitions
3. Inconsistent resource ownership validation
4. Missing fine-grained permissions
5. No permission caching strategy

## Solution: Unified Permission Service

Created a comprehensive permission system with:
- Role-Based Access Control (RBAC)
- Resource-level permissions
- Permission inheritance
- Caching for performance
- React hooks for easy integration
- Guard components for UI protection

## Architecture

### Permission Service (`unifiedPermissionService.ts`)

```typescript
class UnifiedPermissionService {
  // Permission checks
  public async hasPermission(check: PermissionCheck, user?: User): Promise<boolean>
  public async hasPermissions(checks: PermissionCheck[]): Promise<Record<string, boolean>>
  public async hasAnyPermission(permissions: Permission[]): Promise<boolean>
  public async hasAllPermissions(permissions: Permission[]): Promise<boolean>
  
  // Resource permissions
  public async isResourceOwner(resource: string, resourceId: string): Promise<boolean>
  public async getResourcePermissions(resource: string, resourceId: string): Promise<Permission[]>
  
  // Permission management
  public async grantPermission(userId: string, permission: Permission): Promise<void>
  public async revokePermission(userId: string, permission: Permission): Promise<void>
}
```

### Permission Definitions

```typescript
enum Permission {
  // System permissions
  SYSTEM_ADMIN = 'system:admin',
  SYSTEM_MANAGE_USERS = 'system:manage_users',
  
  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_VIEW_OWN = 'project:view_own',
  PROJECT_EDIT_OWN = 'project:edit_own',
  PROJECT_DELETE_OWN = 'project:delete_own',
  PROJECT_SHARE = 'project:share',
  
  // Image permissions
  IMAGE_UPLOAD = 'image:upload',
  IMAGE_VIEW = 'image:view',
  IMAGE_DELETE = 'image:delete',
  IMAGE_SEGMENT = 'image:segment',
  
  // Segmentation permissions
  SEGMENTATION_CREATE = 'segmentation:create',
  SEGMENTATION_EDIT = 'segmentation:edit',
  SEGMENTATION_APPROVE = 'segmentation:approve'
}
```

### React Integration (`usePermissions.tsx`)

```typescript
// Permission Provider
export function PermissionProvider({ children }: PermissionProviderProps)

// Main hook
export function usePermissions(): PermissionContextValue

// Specialized hooks
export function usePermission(permission: Permission): { hasPermission: boolean }
export function useResourceOwnership(resource: string, resourceId: string): { isOwner: boolean }
export function useConditionalRender(permission: Permission): { render: Function }

// Guard components
export function PermissionGuard({ permission, children }: PermissionGuardProps)
export function RoleGuard({ role, children }: RoleGuardProps)
export function ResourceOwnerGuard({ resource, resourceId, children }: ResourceOwnerGuardProps)
```

## Migration Guide

### 1. Update App Provider Setup

**Before:**
```typescript
<AuthProvider>
  <App />
</AuthProvider>
```

**After:**
```typescript
<AuthProvider>
  <PermissionProvider>
    <App />
  </PermissionProvider>
</AuthProvider>
```

### 2. Update Permission Checks

**Before:**
```typescript
// Scattered role checks
const isAdmin = user?.role === 'admin';
const canEdit = isOwner || permission === 'edit';

if (isAdmin) {
  // Admin functionality
}
```

**After:**
```typescript
// Centralized permission checks
const { hasPermission } = usePermissions();

const canEdit = await hasPermission({
  permission: Permission.PROJECT_EDIT_OWN,
  resource: 'project',
  resourceId: projectId
});

// Or use hook for reactive checks
const { hasPermission: isAdmin } = usePermission(Permission.SYSTEM_ADMIN);
```

### 3. Update Protected UI Elements

**Before:**
```typescript
// Manual permission checks in render
{isOwner && (
  <Button onClick={handleShare}>Share</Button>
)}

{user?.role === 'admin' && (
  <AdminPanel />
)}
```

**After:**
```typescript
// Using guard components
<PermissionGuard permission={Permission.PROJECT_SHARE}>
  <Button onClick={handleShare}>Share</Button>
</PermissionGuard>

<RoleGuard role={Role.ADMIN}>
  <AdminPanel />
</RoleGuard>

<ResourceOwnerGuard resource="project" resourceId={projectId}>
  <DeleteButton />
</ResourceOwnerGuard>
```

### 4. Update Action Handlers

**Before:**
```typescript
const handleDelete = async () => {
  // No permission check
  await deleteProject(projectId);
};

const handleShare = async () => {
  if (!isOwner) {
    toast.error('Only owners can share');
    return;
  }
  await shareProject(projectId);
};
```

**After:**
```typescript
// Create permissioned actions
const handleDelete = createPermissionedAction(
  async () => {
    await deleteProject(projectId);
  },
  {
    permission: Permission.PROJECT_DELETE_OWN,
    resource: 'project',
    resourceId: projectId
  },
  () => toast.error('You do not have permission to delete this project')
);

// Or check manually
const handleShare = async () => {
  const canShare = await hasPermission(Permission.PROJECT_SHARE);
  if (!canShare) {
    toast.error('You do not have permission to share this project');
    return;
  }
  await shareProject(projectId);
};
```

### 5. Update Resource-Based Permissions

**Before:**
```typescript
// Checking ownership manually
const project = await fetchProject(projectId);
const isOwner = project.owner_id === user.id;
const canEdit = isOwner || project.shared_users?.includes(user.id);
```

**After:**
```typescript
// Using resource permission checks
const { isOwner } = useResourceOwnership('project', projectId);
const permissions = await getResourcePermissions('project', projectId);
const canEdit = permissions.includes(Permission.PROJECT_EDIT_OWN);
```

## Usage Examples

### 1. Basic Permission Check

```typescript
function ProjectActions({ projectId }: { projectId: string }) {
  const { hasPermission } = usePermissions();
  const [canShare, setCanShare] = useState(false);
  
  useEffect(() => {
    hasPermission({
      permission: Permission.PROJECT_SHARE,
      resource: 'project',
      resourceId: projectId
    }).then(setCanShare);
  }, [projectId, hasPermission]);
  
  if (!canShare) return null;
  
  return <ShareButton projectId={projectId} />;
}
```

### 2. Multiple Permission Checks

```typescript
function ImageActions({ imageId }: { imageId: string }) {
  const { hasPermissions } = usePermissions();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    hasPermissions([
      { permission: Permission.IMAGE_EDIT },
      { permission: Permission.IMAGE_DELETE },
      { permission: Permission.IMAGE_SEGMENT }
    ]).then(setPermissions);
  }, [imageId, hasPermissions]);
  
  return (
    <>
      {permissions[Permission.IMAGE_EDIT] && <EditButton />}
      {permissions[Permission.IMAGE_DELETE] && <DeleteButton />}
      {permissions[Permission.IMAGE_SEGMENT] && <SegmentButton />}
    </>
  );
}
```

### 3. Role-Based Rendering

```typescript
function Navigation() {
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/projects">Projects</Link>
      
      <RoleGuard role={Role.ADMIN}>
        <Link to="/admin">Admin Panel</Link>
      </RoleGuard>
      
      <RoleGuard role={[Role.ADMIN, Role.USER]}>
        <Link to="/settings">Settings</Link>
      </RoleGuard>
    </nav>
  );
}
```

### 4. Resource Owner Actions

```typescript
function ProjectCard({ project }: { project: Project }) {
  return (
    <Card>
      <h3>{project.name}</h3>
      
      <ResourceOwnerGuard resource="project" resourceId={project.id}>
        <div className="owner-actions">
          <ShareButton />
          <DeleteButton />
        </div>
      </ResourceOwnerGuard>
      
      <PermissionGuard permission={Permission.PROJECT_VIEW_SHARED}>
        <ViewButton />
      </PermissionGuard>
    </Card>
  );
}
```

### 5. Complex Permission Logic

```typescript
function SegmentationEditor({ imageId, projectId }: Props) {
  const { hasAllPermissions, isResourceOwner } = usePermissions();
  const [canEdit, setCanEdit] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      // User must have segment permission AND either own the project OR have edit permission
      const hasSegmentPerm = await hasPermission(Permission.IMAGE_SEGMENT);
      const isOwner = await isResourceOwner('project', projectId);
      const hasEditPerm = await hasPermission({
        permission: Permission.PROJECT_EDIT_SHARED,
        resource: 'project',
        resourceId: projectId
      });
      
      setCanEdit(hasSegmentPerm && (isOwner || hasEditPerm));
    };
    
    checkPermissions();
  }, [imageId, projectId]);
  
  if (!canEdit) {
    return <div>You don't have permission to edit segmentations</div>;
  }
  
  return <Editor />;
}
```

## Best Practices

### 1. Use Guard Components for UI

```typescript
// Good - Declarative and clean
<PermissionGuard permission={Permission.PROJECT_DELETE_OWN}>
  <DeleteButton />
</PermissionGuard>

// Avoid - Imperative and verbose
{hasPermission && <DeleteButton />}
```

### 2. Cache Permission Checks

```typescript
// Permissions are automatically cached
const { hasPermission } = usePermissions();

// Multiple calls to same permission use cache
await hasPermission(Permission.PROJECT_CREATE); // API call
await hasPermission(Permission.PROJECT_CREATE); // From cache
```

### 3. Define Granular Permissions

```typescript
// Good - Specific permissions
Permission.PROJECT_EDIT_OWN
Permission.PROJECT_EDIT_SHARED
Permission.PROJECT_EDIT_ALL

// Avoid - Too broad
Permission.PROJECT_EDIT
```

### 4. Handle Loading States

```typescript
function ProtectedFeature() {
  const { hasPermission, isLoading } = usePermission(Permission.FEATURE_ACCESS);
  
  if (isLoading) {
    return <Skeleton />;
  }
  
  if (!hasPermission) {
    return <AccessDenied />;
  }
  
  return <Feature />;
}
```

## Security Considerations

### 1. Frontend vs Backend

- Frontend permissions are for UX only
- Always validate permissions on backend
- Never trust client-side permission checks for security

### 2. Permission Caching

- Cache has TTL to prevent stale permissions
- Clear cache on user changes
- Cache is user-specific

### 3. Resource Permissions

- Always check both role and resource permissions
- Validate resource ownership on backend
- Use consistent resource identifiers

## Performance

### 1. Caching Strategy

- Memory cache for instant access
- 5-minute default TTL
- Tag-based cache invalidation
- Automatic cleanup

### 2. Batch Checks

```typescript
// Good - Single request for multiple permissions
const permissions = await hasPermissions([
  { permission: Permission.IMAGE_VIEW },
  { permission: Permission.IMAGE_EDIT },
  { permission: Permission.IMAGE_DELETE }
]);

// Avoid - Multiple requests
const canView = await hasPermission(Permission.IMAGE_VIEW);
const canEdit = await hasPermission(Permission.IMAGE_EDIT);
const canDelete = await hasPermission(Permission.IMAGE_DELETE);
```

## Testing

### Unit Tests

```typescript
describe('Permission Service', () => {
  it('should check role permissions', async () => {
    const hasPermission = await permissionService.hasPermission(
      { permission: Permission.PROJECT_CREATE },
      { role: Role.USER }
    );
    expect(hasPermission).toBe(true);
  });
  
  it('should check resource ownership', async () => {
    const isOwner = await permissionService.isResourceOwner(
      'project',
      'project-123',
      'user-456'
    );
    expect(isOwner).toBe(true);
  });
});
```

### Component Tests

```typescript
describe('PermissionGuard', () => {
  it('should render children when permission granted', () => {
    const { getByText } = render(
      <PermissionGuard permission={Permission.PROJECT_VIEW_OWN}>
        <div>Protected Content</div>
      </PermissionGuard>
    );
    
    expect(getByText('Protected Content')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

1. **Permissions not updating**
   - Clear permission cache: `await permissionService.clearCache()`
   - Check user authentication state
   - Verify backend returns correct permissions

2. **Guard components not working**
   - Ensure PermissionProvider wraps app
   - Check permission names match enums
   - Verify user is authenticated

3. **Resource permissions failing**
   - Confirm resource ID format
   - Check backend ownership data
   - Validate resource type naming