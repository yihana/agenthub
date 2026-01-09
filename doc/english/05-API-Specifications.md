# EAR API Specifications

## 1. API Overview

The EAR system provides RESTful APIs, and all APIs start with the `/api` path.

### 1.1 Basic Information

- **Base URL**: `https://[domain]/api`
- **Authentication**: JWT Bearer Token or XSUAA Token
- **Content-Type**: `application/json`
- **Response Format**: JSON

### 1.2 Common Response Format

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### 1.3 Authentication Header

```
Authorization: Bearer <token>
```

## 2. Authentication API

### 2.1 Login

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "userid": "string",
  "password": "string"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": {
      "userid": "string",
      "email": "string",
      "fullName": "string",
      "isAdmin": boolean
    }
  }
}
```

### 2.2 Logout

**Endpoint**: `POST /api/auth/logout`

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## 3. Chat API

### 3.1 Send Chat Message

**Endpoint**: `POST /api/chat`

**Authentication**: Required

**Request Body**:
```json
{
  "message": "string",
  "sessionId": "string",
  "chatModule": "string" // "skax" | "skn" | "skax-first" | "skn-first"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "response": "string",
    "sources": ["string"],
    "sessionId": "string"
  }
}
```

### 3.2 Streaming Chat

**Endpoint**: `POST /api/chat/stream`

**Authentication**: Required

**Request Body**: Same as above

**Response**: Server-Sent Events (SSE) streaming

### 3.3 Get Chat History

**Endpoint**: `GET /api/chat/history/:sessionId`

**Authentication**: Required

**Query Parameters**:
- `limit` (optional): Number of records (default: 50)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": number,
      "userMessage": "string",
      "assistantResponse": "string",
      "sources": "string",
      "createdAt": "timestamp"
    }
  ]
}
```

## 4. EAR Request API

### 4.1 Register Request

**Endpoint**: `POST /api/ear/requests`

**Authentication**: Required

**Request Body**:
```json
{
  "requestTitle": "string",
  "requestContent": "string",
  "templateId": number,
  "formData": {},
  "attachments": []
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": number,
    "requestTitle": "string",
    "status": "string",
    "createdAt": "timestamp"
  }
}
```

### 4.2 Get Request List

**Endpoint**: `GET /api/ear/requests`

**Authentication**: Required

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Status filter
- `search` (optional): Search term

**Response**:
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": number,
        "requestTitle": "string",
        "status": "string",
        "createdBy": "string",
        "createdAt": "timestamp"
      }
    ],
    "total": number,
    "page": number,
    "limit": number
  }
}
```

## 5. RAG API

### 5.1 Upload Document

**Endpoint**: `POST /api/rag/documents`

**Authentication**: Required

**Request Format**: `multipart/form-data`

**Parameters**:
- `file`: File (TXT, PDF, DOCX, Markdown)
- `name` (optional): Document name

**Response**:
```json
{
  "success": true,
  "data": {
    "documentId": number,
    "name": "string",
    "status": "processing"
  }
}
```

### 5.2 Get Document List

**Endpoint**: `GET /api/rag/documents`

**Authentication**: Required

**Query Parameters**:
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search term

**Response**:
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": number,
        "name": "string",
        "fileType": "string",
        "fileSize": number,
        "createdAt": "timestamp"
      }
    ],
    "total": number
  }
}
```

## 6. User Management API

### 6.1 Get User List

**Endpoint**: `GET /api/users`

**Authentication**: Required (Admin only)

**Query Parameters**:
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search term

**Response**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": number,
        "userid": "string",
        "email": "string",
        "fullName": "string",
        "department": "string",
        "isActive": boolean,
        "isAdmin": boolean
      }
    ],
    "total": number
  }
}
```

## 7. Error Codes

### 7.1 Authentication Errors

- `AUTH_REQUIRED`: Authentication required
- `AUTH_INVALID`: Authentication token is invalid
- `AUTH_EXPIRED`: Authentication token has expired
- `AUTH_FORBIDDEN`: Access denied

### 7.2 Validation Errors

- `VALIDATION_ERROR`: Input data validation failed
- `REQUIRED_FIELD`: Required field is missing
- `INVALID_FORMAT`: Invalid format

### 7.3 Business Logic Errors

- `NOT_FOUND`: Resource not found
- `ALREADY_EXISTS`: Resource already exists
- `OPERATION_FAILED`: Operation failed

### 7.4 System Errors

- `INTERNAL_ERROR`: Internal server error
- `DATABASE_ERROR`: Database error
- `EXTERNAL_API_ERROR`: External API call error

## 8. API Usage Examples

### 8.1 Chat Request Example

```javascript
// Send chat message
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: 'I want to request a firewall opening',
    sessionId: 'session-123',
    chatModule: 'skax'
  })
});

const data = await response.json();
console.log(data.data.response);
```

### 8.2 EAR Request Registration Example

```javascript
// Register EAR request
const response = await fetch('/api/ear/requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    requestTitle: 'Firewall Opening Request',
    requestContent: 'Request to open port 8080 for 192.168.1.100',
    templateId: 1,
    formData: {
      sourceIp: '192.168.1.100',
      targetPort: '8080'
    }
  })
});
```


