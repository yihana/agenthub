# EAR (ERP AI Powered Request System) Project Overview

## 1. Project Information

| Item | Description |
|------|-------------|
| Project Name | EAR (ERP AI Powered Request System) |
| Development Company | SKAX |
| Development Team | AI ERP Team |
| Project Type | SI (System Integration) Project |
| Development Environment | SAP BTP (Business Technology Platform) |

## 2. Project Background

This project was initiated to build an AI-based system for automatically processing ITSM (IT Service Management) requests. The goal is to improve the existing manual request processing workflow and provide efficient request management through a user-friendly interface.

### 2.1 Project Objectives

- **AI-Based Request Processing**: Automatic generation and processing of ITSM requests through natural language processing
- **User Experience Improvement**: Providing intuitive and convenient request registration and inquiry interfaces
- **Knowledge-Based System**: Knowledge management and search using RAG (Retrieval-Augmented Generation) technology
- **Process Automation**: External system integration through interface automation

### 2.2 Key Features

- **Multiple Chat Module Support**: Support for various AI modules including SKAX Chat Module, SK Networks RAG Module, etc.
- **RAG-Based Knowledge Management**: Accurate answers through document upload and vector search
- **Request Template System**: Templates for various request types such as firewall, ESM, etc.
- **Enhanced Security**: XSUAA/IAS authentication, IP whitelist, input/output security filtering

## 3. System Scope

### 3.1 Included Features

1. **Request Management**
   - EAR request registration and inquiry
   - ESM request registration
   - System improvement request management

2. **RAG Management**
   - Document upload and management
   - Vector search-based answer generation
   - Answer quality improvement requests

3. **Chat System**
   - Real-time AI chat
   - Chat history management
   - Intent detection and template recommendation

4. **System Management**
   - User management
   - Menu management
   - Permission management
   - IP whitelist management
   - Security settings management

5. **Process Management**
   - Process visualization
   - Interface automation

### 3.2 Excluded Features

- Actual integration with external ITSM systems (interface automation feature is included)
- Batch job scheduling
- Real-time notification system

## 4. Technology Stack

### 4.1 Frontend

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **UI Components**: Lucide React (Icons)
- **Charts/Visualization**: ReactFlow (@xyflow/react)

### 4.2 Backend

- **Runtime**: Node.js 18.x / 20.x / 22.x
- **Framework**: Express.js
- **Language**: TypeScript
- **Authentication**: JWT, XSUAA, SAP IAS
- **HTTP Client**: Axios

### 4.3 Database

- **Production Environment**: SAP HANA Database
- **Development Environment**: PostgreSQL (optional)
- **Vector Search**: pgvector (PostgreSQL) / HANA Vector Engine (HANA)

### 4.4 AI/ML

- **LLM**: OpenAI GPT-4o-mini
- **Embedding Model**: OpenAI text-embedding-3-large
- **RAG Framework**: LangChain

### 4.5 Infrastructure

- **Platform**: SAP BTP (Cloud Foundry)
- **Storage**: SAP BTP Object Store (S3 compatible)
- **Authentication Service**: SAP Identity Authentication Service (IAS)
- **Authorization Service**: XSUAA (XS User Account and Authentication)

## 5. Project Schedule and Phases

### 5.1 Development Phases

1. **Phase 1**: Basic RAG system construction
2. **Phase 2**: Request management feature development
3. **Phase 3**: Chat system and intent detection features
4. **Phase 4**: System management features
5. **Phase 5**: Security enhancement and optimization

### 5.2 Current Status

- ✅ Basic RAG system completed
- ✅ Request management features completed
- ✅ Chat system completed
- ✅ User authentication and authorization management completed
- ✅ Security features implemented
- ✅ SAP BTP deployment completed

## 6. Participating Organizations

- **Development Company**: SKAX
- **Development Team**: AI ERP Team
- **Partner Company**: FPT (Vietnam) - Planned

## 7. Document Overview

This deliverable consists of the following documents:

1. Project Overview (this document)
2. System Architecture
3. Functional Specifications
4. Database Design Document
5. API Specifications
6. Deployment Guide
7. Security Guide
8. Operations Manual


