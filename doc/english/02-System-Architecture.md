# EAR System Architecture

## 1. System Architecture Overview

The EAR system is based on a 3-Tier architecture and operates in the SAP BTP Cloud Foundry environment.

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Browser]
    end
    
    subgraph "SAP BTP Cloud Foundry"
        subgraph "Application Layer"
            B[React Frontend]
            C[Express Backend]
        end
        
        subgraph "Service Layer"
            D[XSUAA Service]
            E[Object Store]
            F[Destination Service]
            G[Connectivity Service]
        end
        
        subgraph "Data Layer"
            H[SAP HANA Database]
        end
    end
    
    subgraph "External Services"
        I[OpenAI API]
        J[SAP IAS]
        K[SK Networks RAG]
        L[C4C System]
    end
    
    A -->|HTTPS| B
    B -->|REST API| C
    C -->|Authentication| D
    C -->|File Storage| E
    C -->|Database| H
    C -->|External API| I
    C -->|External API| K
    C -->|External API| L
    D -->|OAuth2| J
    C -->|Service Binding| F
    C -->|Service Binding| G
```

## 2. Component Architecture

### 2.1 Frontend Architecture

```mermaid
graph LR
    subgraph "React Application"
        A[App.tsx<br/>Main Router]
        B[Pages<br/>Page Components]
        C[Components<br/>Reusable Components]
        D[Hooks<br/>Custom Hooks]
        E[Utils<br/>Utilities]
    end
    
    A --> B
    B --> C
    C --> D
    C --> E
    E -->|API Calls| F[Backend API]
```

#### Key Components

- **Pages**: Page components for each screen
  - LoginPage, EARRequestRegistration, RAGDocumentManagement, etc.
- **Components**: Reusable UI components
  - ChatPane, HistoryPane, MenuPane, etc.
- **Hooks**: Custom React Hooks
  - useAuth, useFirewallIntent, useMenus
- **Utils**: Utility functions
  - api.ts (API calls), htmlSanitizer.ts (XSS prevention)

### 2.2 Backend Architecture

```mermaid
graph TB
    subgraph "Express Server"
        A[index.ts<br/>Server Entry]
        B[Routes<br/>API Endpoints]
        C[Middleware<br/>Auth, IP Whitelist]
        D[Utils<br/>Helpers]
        E[RAG Engine]
    end
    
    subgraph "Database Layer"
        F[db.ts<br/>Database Abstraction]
        G[db-hana.ts]
        H[db-postgres.ts]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    F --> G
    F --> H
    G --> I[(HANA DB)]
    H --> J[(PostgreSQL)]
```

#### Key Modules

- **Routes**: API endpoint definitions
  - `/api/chat`, `/api/ear`, `/api/rag`, `/api/auth`, etc.
- **Middleware**: Request processing middleware
  - `auth.ts`: JWT/XSUAA authentication
  - `ipWhitelist.ts`: IP whitelist validation
- **RAG Engine**: RAG pipeline processing
  - Document embedding, vector search, LLM response generation

## 3. Data Flow

### 3.1 Chat Request Processing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant R as RAG Engine
    participant DB as Database
    participant O as OpenAI API
    
    U->>F: Enter chat message
    F->>B: POST /api/chat
    B->>B: Authentication verification
    B->>R: Intent detection
    R->>DB: Vector search
    DB-->>R: Return similar documents
    R->>O: LLM request (with context)
    O-->>R: Generate response
    R-->>B: Return response
    B->>DB: Save chat history
    B-->>F: Streaming response
    F-->>U: Display real-time answer
```

### 3.2 Request Registration Processing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant DB as Database
    participant C as C4C/ESM
    
    U->>F: Register EAR request
    F->>B: POST /api/ear/requests
    B->>B: Input validation and security filtering
    B->>DB: Save request
    DB-->>B: Save completed
    B->>C: External system integration (optional)
    C-->>B: Integration result
    B-->>F: Return request ID
    F-->>U: Display registration completed
```

### 3.3 Authentication and Authorization Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant X as XSUAA
    participant I as SAP IAS
    
    U->>F: Login request
    F->>B: POST /api/auth/login
    B->>X: Token verification request
    X->>I: User authentication check
    I-->>X: Authentication result
    X-->>B: Issue JWT token
    B->>B: Permission check
    B-->>F: Token and user information
    F->>F: Store token in localStorage
    F-->>U: Login completed
```

## 4. Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        A[Network Security<br/>IP Whitelist]
        B[Authentication<br/>XSUAA/IAS]
        C[Authorization<br/>Role-based]
        D[Input Security<br/>XSS/SQL Injection]
        E[Output Security<br/>Data Filtering]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
```

### Security Layers

1. **Network Security**: Access control through IP whitelist
2. **Authentication**: User authentication through SAP IAS
3. **Authorization**: Role-based access control through XSUAA
4. **Input Security**: Prevention of XSS, SQL Injection, etc.
5. **Output Security**: Filtering and masking of sensitive information

## 5. Deployment Architecture

```mermaid
graph TB
    subgraph "SAP BTP Cloud Foundry"
        A[EAR Application<br/>2 Instances]
        B[EAR-PRD Service<br/>HANA Database]
        C[ear-xsuaa Service]
        D[Object Store Service]
        E[Destination Service]
        F[Connectivity Service]
        G[Private Link Service]
    end
    
    subgraph "External"
        H[OpenAI API]
        I[SAP IAS]
        J[SK Networks RAG]
    end
    
    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G
    C --> I
    A --> H
    A --> J
```

### Deployment Configuration

- **Application**: 2 instances (high availability)
- **Memory**: 2GB per instance
- **Disk**: 2GB per instance
- **Health Check**: HTTP endpoint (`/health`)

## 6. Database Architecture

```mermaid
erDiagram
    USERS ||--o{ CHAT_HISTORY : has
    USERS ||--o{ EAR_REQUESTS : creates
    USERS ||--o{ LOGIN_HISTORY : has
    RAG_DOCUMENTS ||--o{ RAG_CHUNKS : contains
    EAR_KEYWORDS ||--o{ EAR_REQUEST_TEMPLATES : has
    EAR_REQUEST_TEMPLATES ||--o{ EAR_REQUESTS : uses
    CHAT_HISTORY ||--o{ IMPROVEMENT_REQUESTS : references
    COMPANY_INTERFACES ||--o{ INTERFACE_HISTORY : has
```

### Key Table Groups

1. **User Management**: users, login_history
2. **Chat System**: chat_history, chat_intent_patterns
3. **RAG System**: rag_documents, rag_chunks, rag_agents_info
4. **Request Management**: ear_requests, ear_keywords, ear_request_templates
5. **System Management**: menus, group_menu_mappings, ip_whitelist

## 7. Integration Architecture

### 7.1 External System Integration

```mermaid
graph LR
    A[EAR System] -->|REST API| B[C4C System]
    A -->|REST API| C[SK Networks RAG]
    A -->|REST API| D[OpenAI API]
    A -->|OAuth2| E[SAP IAS]
    A -->|Service Binding| F[SAP HANA]
    A -->|S3 API| G[Object Store]
```

### 7.2 Interface Automation

- **Company-specific API Integration**: External API integration through dynamic field mapping
- **Authentication Method Support**: Bearer Token, Basic Auth, etc.
- **Change History Management**: Tracking all interface changes

## 8. Scalability Considerations

### 8.1 Horizontal Scaling

- Utilizing Cloud Foundry's auto-scaling feature
- Traffic distribution through load balancing
- Stateless architecture design

### 8.2 Performance Optimization

- Database index optimization
- Vector search performance tuning
- Caching strategy (Redis can be introduced in the future)

### 8.3 Monitoring

- Health Check endpoint provided
- Log collection and analysis
- Error tracking and alerts


