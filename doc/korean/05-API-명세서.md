# EAR API 명세서

## 1. API 개요

EAR 시스템은 RESTful API를 제공하며, 모든 API는 `/api` 경로로 시작합니다.

### 1.1 기본 정보

- **Base URL**: `https://[domain]/api`
- **인증 방식**: JWT Bearer Token 또는 XSUAA Token
- **Content-Type**: `application/json`
- **응답 형식**: JSON

### 1.2 공통 응답 형식

#### 성공 응답
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

#### 에러 응답
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### 1.3 인증 헤더

```
Authorization: Bearer <token>
```

## 2. 인증 API

### 2.1 로그인

**엔드포인트**: `POST /api/auth/login`

**요청 본문**:
```json
{
  "userid": "string",
  "password": "string"
}
```

**응답**:
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

### 2.2 로그아웃

**엔드포인트**: `POST /api/auth/logout`

**인증**: 필요

**응답**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 2.3 토큰 검증

**엔드포인트**: `GET /api/auth/verify`

**인증**: 필요

**응답**:
```json
{
  "success": true,
  "data": {
    "user": {
      "userid": "string",
      "email": "string",
      "fullName": "string",
      "isAdmin": boolean
    }
  }
}
```

## 3. 채팅 API

### 3.1 채팅 메시지 전송

**엔드포인트**: `POST /api/chat`

**인증**: 필요

**요청 본문**:
```json
{
  "message": "string",
  "sessionId": "string",
  "chatModule": "string" // "skax" | "skn" | "skax-first" | "skn-first"
}
```

**응답**:
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

### 3.2 스트리밍 채팅

**엔드포인트**: `POST /api/chat/stream`

**인증**: 필요

**요청 본문**: 동일

**응답**: Server-Sent Events (SSE) 스트리밍

### 3.3 채팅 히스토리 조회

**엔드포인트**: `GET /api/chat/history/:sessionId`

**인증**: 필요

**쿼리 파라미터**:
- `limit` (optional): 조회 개수 (기본값: 50)

**응답**:
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

### 3.4 세션 목록 조회

**엔드포인트**: `GET /api/chat/sessions`

**인증**: 필요

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "string",
      "lastMessage": "string",
      "createdAt": "timestamp",
      "messageCount": number
    }
  ]
}
```

### 3.5 세션 삭제

**엔드포인트**: `DELETE /api/chat/session/:sessionId`

**인증**: 필요

**응답**:
```json
{
  "success": true,
  "message": "Session deleted"
}
```

## 4. EAR 요청 API

### 4.1 요청 등록

**엔드포인트**: `POST /api/ear/requests`

**인증**: 필요

**요청 본문**:
```json
{
  "requestTitle": "string",
  "requestContent": "string",
  "templateId": number,
  "formData": {},
  "attachments": []
}
```

**응답**:
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

### 4.2 요청 목록 조회

**엔드포인트**: `GET /api/ear/requests`

**인증**: 필요

**쿼리 파라미터**:
- `page` (optional): 페이지 번호 (기본값: 1)
- `limit` (optional): 페이지당 개수 (기본값: 20)
- `status` (optional): 상태 필터
- `search` (optional): 검색어

**응답**:
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

### 4.3 요청 상세 조회

**엔드포인트**: `GET /api/ear/requests/:id`

**인증**: 필요

**응답**:
```json
{
  "success": true,
  "data": {
    "id": number,
    "requestTitle": "string",
    "requestContent": "string",
    "templateId": number,
    "formData": {},
    "attachments": [],
    "status": "string",
    "createdBy": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

### 4.4 요청 수정

**엔드포인트**: `PUT /api/ear/requests/:id`

**인증**: 필요

**요청 본문**: 등록과 동일

**응답**: 상세 조회와 동일

### 4.5 요청 삭제

**엔드포인트**: `DELETE /api/ear/requests/:id`

**인증**: 필요 (관리자만)

**응답**:
```json
{
  "success": true,
  "message": "Request deleted"
}
```

## 5. RAG API

### 5.1 문서 업로드

**엔드포인트**: `POST /api/rag/documents`

**인증**: 필요

**요청 형식**: `multipart/form-data`

**파라미터**:
- `file`: 파일 (TXT, PDF, DOCX, Markdown)
- `name` (optional): 문서명

**응답**:
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

### 5.2 문서 목록 조회

**엔드포인트**: `GET /api/rag/documents`

**인증**: 필요

**쿼리 파라미터**:
- `page` (optional): 페이지 번호
- `limit` (optional): 페이지당 개수
- `search` (optional): 검색어

**응답**:
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

### 5.3 문서 삭제

**엔드포인트**: `DELETE /api/rag/documents/:id`

**인증**: 필요

**응답**:
```json
{
  "success": true,
  "message": "Document deleted"
}
```

### 5.4 문서 검색

**엔드포인트**: `POST /api/rag/search`

**인증**: 필요

**요청 본문**:
```json
{
  "query": "string",
  "limit": number
}
```

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "documentId": number,
      "chunkIndex": number,
      "content": "string",
      "score": number
    }
  ]
}
```

## 6. 사용자 관리 API

### 6.1 사용자 목록 조회

**엔드포인트**: `GET /api/users`

**인증**: 필요 (관리자만)

**쿼리 파라미터**:
- `page` (optional): 페이지 번호
- `limit` (optional): 페이지당 개수
- `search` (optional): 검색어

**응답**:
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

### 6.2 사용자 등록

**엔드포인트**: `POST /api/users`

**인증**: 필요 (관리자만)

**요청 본문**:
```json
{
  "userid": "string",
  "password": "string",
  "email": "string",
  "fullName": "string",
  "department": "string",
  "position": "string",
  "phone": "string",
  "employeeId": "string",
  "isAdmin": boolean
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": number,
    "userid": "string"
  }
}
```

### 6.3 사용자 수정

**엔드포인트**: `PUT /api/users/:id`

**인증**: 필요 (관리자만)

**요청 본문**: 등록과 동일 (password 제외)

**응답**: 사용자 상세 정보

### 6.4 사용자 삭제

**엔드포인트**: `DELETE /api/users/:id`

**인증**: 필요 (관리자만)

**응답**:
```json
{
  "success": true,
  "message": "User deleted"
}
```

## 7. 시스템 관리 API

### 7.1 메뉴 목록 조회

**엔드포인트**: `GET /api/menus`

**인증**: 필요

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": number,
      "parentId": number,
      "menuCode": "string",
      "menuLabel": "string",
      "menuPath": "string",
      "menuIcon": "string",
      "menuOrder": number,
      "children": []
    }
  ]
}
```

### 7.2 IP 화이트리스트 조회

**엔드포인트**: `GET /api/ip-whitelist`

**인증**: 필요 (관리자만)

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": number,
      "ipAddress": "string",
      "description": "string",
      "isActive": boolean
    }
  ]
}
```

### 7.3 IP 화이트리스트 등록

**엔드포인트**: `POST /api/ip-whitelist`

**인증**: 필요 (관리자만)

**요청 본문**:
```json
{
  "ipAddress": "string",
  "description": "string"
}
```

**응답**: 등록된 IP 정보

## 8. RAG Agent 관리 API

### 8.1 RAG Agent 목록 조회

**엔드포인트**: `GET /api/rag-agents`

**인증**: 필요 (관리자만)

**쿼리 파라미터**:
- `companyCode` (optional): 회사 코드 필터

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": number,
      "companyCode": "string",
      "agentDescription": "string",
      "agentUrl": "string",
      "isActive": "string"
    }
  ]
}
```

### 8.2 RAG Agent 등록

**엔드포인트**: `POST /api/rag-agents`

**인증**: 필요 (관리자만)

**요청 본문**:
```json
{
  "companyCode": "string",
  "agentDescription": "string",
  "agentUrl": "string",
  "agentToken": "string",
  "isActive": "Y"
}
```

**응답**: 등록된 Agent 정보

## 9. 에러 코드

### 9.1 인증 에러

- `AUTH_REQUIRED`: 인증이 필요합니다
- `AUTH_INVALID`: 인증 토큰이 유효하지 않습니다
- `AUTH_EXPIRED`: 인증 토큰이 만료되었습니다
- `AUTH_FORBIDDEN`: 접근 권한이 없습니다

### 9.2 입력 검증 에러

- `VALIDATION_ERROR`: 입력 데이터 검증 실패
- `REQUIRED_FIELD`: 필수 필드가 누락되었습니다
- `INVALID_FORMAT`: 잘못된 형식입니다

### 9.3 비즈니스 로직 에러

- `NOT_FOUND`: 리소스를 찾을 수 없습니다
- `ALREADY_EXISTS`: 이미 존재하는 리소스입니다
- `OPERATION_FAILED`: 작업이 실패했습니다

### 9.4 시스템 에러

- `INTERNAL_ERROR`: 내부 서버 오류
- `DATABASE_ERROR`: 데이터베이스 오류
- `EXTERNAL_API_ERROR`: 외부 API 호출 오류

## 10. API 사용 예시

### 10.1 채팅 요청 예시

```javascript
// 채팅 메시지 전송
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: '방화벽 오픈 요청하고 싶어요',
    sessionId: 'session-123',
    chatModule: 'skax'
  })
});

const data = await response.json();
console.log(data.data.response);
```

### 10.2 EAR 요청 등록 예시

```javascript
// EAR 요청 등록
const response = await fetch('/api/ear/requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    requestTitle: '방화벽 오픈 요청',
    requestContent: '192.168.1.100 포트 8080 오픈 요청',
    templateId: 1,
    formData: {
      sourceIp: '192.168.1.100',
      targetPort: '8080'
    }
  })
});
```

### 10.3 문서 업로드 예시

```javascript
// 문서 업로드
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', '문서명');

const response = await fetch('/api/rag/documents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```


