# SpheroSeg API Documentation

## Project Management API

### Create Project
Creates a new project in the system.

**URL**: `/api/projects`

**Method**: `POST`

**Authentication required**: Yes (JWT token)

**Permissions required**: Authenticated user

**Request Body**:
```json
{
  "title": "My Project",
  "description": "Project description (optional)",
  "tags": ["tag1", "tag2"],
  "public": false
}
```

**Required Fields**:
- `title` - String, 3-100 characters, unique per user

**Optional Fields**:
- `description` - String, max 1000 characters
- `tags` - Array of strings, max 10 tags, each max 50 characters
- `public` - Boolean, defaults to false

**Success Response**:
- **Code**: 201 Created
- **Content**:
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "My Project",
    "description": "Project description",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2023-01-01T12:00:00Z",
    "updated_at": "2023-01-01T12:00:00Z",
    "is_owner": true,
    "tags": ["tag1", "tag2"],
    "public": false
  }
  ```

**Error Responses**:
- **Code**: 400 Bad Request
  - **Content**: `{ "message": "Title must be at least 3 characters long" }`
- **Code**: 401 Unauthorized
  - **Content**: `{ "message": "Authentication error" }`
- **Code**: 409 Conflict
  - **Content**: `{ "message": "A project with the title 'My Project' already exists" }`
- **Code**: 500 Internal Server Error
  - **Content**: `{ "message": "Failed to create project" }`

### Get All Projects
Retrieves a list of projects accessible to the current user.

**URL**: `/api/projects`

**Method**: `GET`

**Authentication required**: Yes (JWT token)

**Permissions required**: Authenticated user

**URL Parameters**:
- `limit` (optional) - Number of projects to return, default 10
- `offset` (optional) - Pagination offset, default 0
- `includeShared` (optional) - Boolean, whether to include shared projects, default true

**Success Response**:
- **Code**: 200 OK
- **Content**:
  ```json
  {
    "projects": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "My Project",
        "description": "Project description",
        "user_id": "123e4567-e89b-12d3-a456-426614174000",
        "created_at": "2023-01-01T12:00:00Z",
        "updated_at": "2023-01-01T12:00:00Z",
        "is_owner": true,
        "image_count": 5,
        "thumbnail_url": "/uploads/thumbnails/image123.jpg",
        "tags": ["tag1", "tag2"],
        "public": false
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440111",
        "title": "Shared Project",
        "description": "A project shared with me",
        "user_id": "223e4567-e89b-12d3-a456-426614174111",
        "created_at": "2023-01-02T12:00:00Z",
        "updated_at": "2023-01-02T12:00:00Z",
        "is_owner": false,
        "permission": "view",
        "image_count": 3,
        "thumbnail_url": "/uploads/thumbnails/image456.jpg"
      }
    ],
    "total": 2
  }
  ```

**Error Responses**:
- **Code**: 401 Unauthorized
  - **Content**: `{ "message": "Authentication error" }`
- **Code**: 500 Internal Server Error
  - **Content**: `{ "message": "Error fetching projects" }`

### Get Single Project
Retrieves a specific project by ID.

**URL**: `/api/projects/:id`

**Method**: `GET`

**Authentication required**: Yes (JWT token)

**Permissions required**: Project owner or has explicit access via sharing

**Success Response**:
- **Code**: 200 OK
- **Content**:
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "My Project",
    "description": "Project description",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2023-01-01T12:00:00Z",
    "updated_at": "2023-01-01T12:00:00Z",
    "is_owner": true,
    "image_count": 5,
    "thumbnail_url": "/uploads/thumbnails/image123.jpg",
    "tags": ["tag1", "tag2"],
    "public": false
  }
  ```

**Special Cases**:
- If the ID is "new", returns a template for a new project

**Error Responses**:
- **Code**: 401 Unauthorized
  - **Content**: `{ "message": "Authentication error" }`
- **Code**: 404 Not Found
  - **Content**: `{ "message": "Project not found or access denied" }`
- **Code**: 500 Internal Server Error
  - **Content**: `{ "message": "Error fetching project" }`

### Delete Project
Deletes a project and all associated resources.

**URL**: `/api/projects/:id`

**Method**: `DELETE`

**Authentication required**: Yes (JWT token)

**Permissions required**: Project owner only

**Success Response**:
- **Code**: 204 No Content

**Error Responses**:
- **Code**: 401 Unauthorized
  - **Content**: `{ "message": "Authentication error" }`
- **Code**: 404 Not Found
  - **Content**: `{ "message": "Project not found or access denied" }`
- **Code**: 500 Internal Server Error
  - **Content**: `{ "message": "Error deleting project" }`

### Duplicate Project
Creates a copy of an existing project.

**URL**: `/api/projects/:id/duplicate`

**Method**: `POST`

**Authentication required**: Yes (JWT token)

**Permissions required**: Project owner only

**Request Body**:
```json
{
  "newTitle": "Copy of My Project",
  "copyFiles": true,
  "copySegmentations": false,
  "resetStatus": true,
  "async": false
}
```

**Optional Fields**:
- `newTitle` - String, 3-100 characters
- `copyFiles` - Boolean, default true
- `copySegmentations` - Boolean, default false
- `resetStatus` - Boolean, default true
- `async` - Boolean, default false (if true, returns a task instead of waiting for completion)

**Success Response**:
- **Code**: 201 Created (for synchronous duplication)
- **Content**:
  ```json
  {
    "id": "660e8400-e29b-41d4-a716-446655440111",
    "title": "Copy of My Project",
    "description": "Project description",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2023-01-02T12:00:00Z",
    "updated_at": "2023-01-02T12:00:00Z"
  }
  ```

- **Code**: 202 Accepted (for asynchronous duplication)
- **Content**:
  ```json
  {
    "taskId": "task-123",
    "status": "pending",
    "originalProjectId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Project duplication started. Monitor progress using the duplication task API."
  }
  ```

**Error Responses**:
- **Code**: 401 Unauthorized
  - **Content**: `{ "message": "Authentication error" }`
- **Code**: 404 Not Found
  - **Content**: `{ "message": "Source project not found or access denied" }`
- **Code**: 500 Internal Server Error
  - **Content**: `{ "message": "Error duplicating project" }`