# EAR Development Standards Document

## 1. Document Overview

### 1.1 Purpose

This document defines coding standards, development guidelines, and development processes that developers must follow when developing the EAR system. The purpose is to maintain consistent code quality and improve maintainability.

### 1.2 Scope

- **Project**: EAR (ERP AI Powered Request System)
- **Applicable To**: All developers and partner company developers
- **Applicable Technologies**: TypeScript, React, Node.js, Express, SAP HANA

### 1.3 Document Structure

1. Coding Conventions
2. File and Directory Structure
3. Naming Rules
4. Git Usage Rules
5. Code Review Process
6. API Development Standards
7. Database Development Standards
8. Testing Standards
9. Security Development Standards
10. Documentation Standards

## 2. Coding Conventions

### 2.1 TypeScript Coding Standards

#### 2.1.1 Basic Settings

- **TypeScript Version**: 5.3.3 or higher
- **Strict Mode**: Always enabled
- **Type Declaration**: All function parameters and return values must have explicit types

```typescript
// ✅ Good Example
async function getUserById(userId: string): Promise<User | null> {
  // ...
}

// ❌ Bad Example
async function getUserById(userId) {
  // ...
}
```

#### 2.1.2 Indentation and Whitespace

- **Indentation**: 2 spaces (tabs prohibited)
- **Trailing Whitespace**: Remove
- **End of File**: One empty line

#### 2.1.3 Semicolons

- **Usage**: Use semicolons at the end of all statements

```typescript
// ✅ Good Example
const name = 'EAR';
const version = '1.0.0';

// ❌ Bad Example
const name = 'EAR'
const version = '1.0.0'
```

#### 2.1.4 Strings

- **Default**: Use single quotes (`'`)
- **Template Literals**: Use backticks (`` ` ``) for dynamic strings

```typescript
// ✅ Good Example
const message = 'Hello, World!';
const greeting = `Hello, ${name}!`;

// ❌ Bad Example
const message = "Hello, World!";
```

#### 2.1.5 Function Declaration

- **Arrow Functions**: For callbacks and simple functions
- **Regular Functions**: For complex logic and recursive functions

```typescript
// ✅ Good Example
const handleClick = () => {
  console.log('clicked');
};

async function processData(data: Data[]): Promise<Result> {
  // Complex logic
}

// ❌ Bad Example
function handleClick() {
  console.log('clicked');
}
```

#### 2.1.6 Error Handling

- **try-catch**: Always wrap async operations in try-catch
- **Error Logging**: Record detailed logs when errors occur
- **Error Types**: Use specific error types

```typescript
// ✅ Good Example
try {
  const result = await database.query(sql, params);
  return result;
} catch (error) {
  console.error('Database query failed:', error);
  throw new DatabaseError('Failed to execute query', error);
}

// ❌ Bad Example
const result = await database.query(sql, params);
return result;
```

### 2.2 React Coding Standards

#### 2.2.1 Component Structure

- **Functional Components**: All components should be written as functional components
- **Hooks Usage**: Use Hooks instead of class components
- **Component Separation**: Follow single responsibility principle

```typescript
// ✅ Good Example
interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
}

function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <button onClick={() => onEdit(user)}>Edit</button>
    </div>
  );
}

// ❌ Bad Example
class UserCard extends React.Component {
  // ...
}
```

#### 2.2.2 Props Type Definition

- **Interface Usage**: Always define Props using interfaces
- **Required/Optional Distinction**: Use `?` to mark optional props

```typescript
// ✅ Good Example
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

function Button({ label, onClick, disabled = false, variant = 'primary' }: ButtonProps) {
  // ...
}

// ❌ Bad Example
function Button(props: any) {
  // ...
}
```

### 2.3 Node.js/Express Coding Standards

#### 2.3.1 Route Definition

- **Router Separation**: Separate router files by feature
- **Middleware Chaining**: Chain related middleware

```typescript
// ✅ Good Example
import express from 'express';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/users', authenticateToken, async (req, res) => {
  // ...
});

export default router;

// ❌ Bad Example
app.get('/users', async (req, res) => {
  // ...
});
```

#### 2.3.2 Async Processing

- **async/await**: Use async/await instead of Promise.then()
- **Error Handling**: Wrap all async functions in try-catch

```typescript
// ✅ Good Example
router.post('/users', async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ❌ Bad Example
router.post('/users', (req, res) => {
  createUser(req.body).then(user => {
    res.json(user);
  });
});
```

## 3. File and Directory Structure

### 3.1 Project Structure

```
ear-project/
├── server/                 # Backend
│   ├── index.ts           # Server entry point
│   ├── routes/            # API routes
│   ├── middleware/        # Middleware
│   ├── utils/             # Utilities
│   ├── types/             # Type definitions
│   └── db.ts              # Database connection
├── web/                    # Frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── hooks/         # Custom Hooks
│   │   └── utils/         # Utilities
└── doc/                    # Documentation
```

### 3.2 File Naming Rules

#### 3.2.1 TypeScript Files

- **Components**: PascalCase (e.g., `UserCard.tsx`)
- **Utilities**: camelCase (e.g., `api.ts`, `utils.ts`)
- **Type Definitions**: camelCase (e.g., `types.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `constants.ts`)

## 4. Naming Rules

### 4.1 Variables and Functions

- **camelCase**: Use camelCase for variables and function names
- **Meaningful Names**: Minimize use of abbreviations

```typescript
// ✅ Good Example
const userName = 'John';
const userList = [];
function getUserById(id: string) { }

// ❌ Bad Example
const un = 'John';
const ul = [];
function getUsr(id: string) { }
```

### 4.2 Constants

- **UPPER_SNAKE_CASE**: Use uppercase and underscores for constants

```typescript
// ✅ Good Example
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';

// ❌ Bad Example
const maxRetryCount = 3;
```

### 4.3 Classes and Interfaces

- **PascalCase**: Use PascalCase for classes, interfaces, and types

```typescript
// ✅ Good Example
interface User {
  id: string;
  name: string;
}

class UserService {
  // ...
}
```

## 5. Git Usage Rules

### 5.1 Branch Strategy

- **main**: Branch for production deployment
- **develop**: Branch for development integration
- **feature/**: Branch for feature development
- **bugfix/**: Branch for bug fixes
- **hotfix/**: Branch for urgent fixes

### 5.2 Commit Message Rules

- **Format**: `[Type] Brief description`
- **Types**: feat, fix, docs, style, refactor, test, chore

```bash
# ✅ Good Example
[feat] Add user management feature
[fix] Fix login error
[docs] Update API specifications
[refactor] Code refactoring

# ❌ Bad Example
update
fix bug
```

## 6. Code Review Process

### 6.1 Review Criteria

- **Code Quality**: Readability, maintainability
- **Functional Accuracy**: Requirements fulfillment
- **Performance**: Unnecessary operations, optimization
- **Security**: Security vulnerability review
- **Testing**: Test code writing

### 6.2 Review Checklist

- [ ] Coding conventions followed
- [ ] Type definitions complete
- [ ] Error handling implemented
- [ ] Security review completed
- [ ] Test code written
- [ ] Documentation completed
- [ ] Performance optimization reviewed

## 7. API Development Standards

### 7.1 RESTful API Design

- **HTTP Methods**: Use GET, POST, PUT, DELETE appropriately
- **URL Structure**: Resource-centric design

```typescript
// ✅ Good Example
GET    /api/users          // Get user list
GET    /api/users/:id      // Get user details
POST   /api/users          // Create user
PUT    /api/users/:id      // Update user
DELETE /api/users/:id      // Delete user
```

### 7.2 Response Format

- **Success Response**: `{ success: true, data: {...} }`
- **Error Response**: `{ success: false, error: '...', code: '...' }`

```typescript
// ✅ Good Example
res.json({
  success: true,
  data: {
    id: 1,
    name: 'John'
  }
});

res.status(400).json({
  success: false,
  error: 'Invalid input',
  code: 'VALIDATION_ERROR'
});
```

### 7.3 Authentication and Authorization

- **Authentication**: Apply authentication middleware to all APIs
- **Authorization**: Add authorization middleware for admin-only APIs

```typescript
// ✅ Good Example
router.get('/users', authenticateToken, async (req, res) => {
  // ...
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  // ...
});
```

## 8. Database Development Standards

### 8.1 Query Writing

- **Parameterization**: Use parameterized queries to prevent SQL Injection
- **Index Utilization**: Use columns with indexes

```typescript
// ✅ Good Example
const query = 'SELECT * FROM users WHERE user_id = ?';
const result = await db.query(query, [userId]);

// ❌ Bad Example
const query = `SELECT * FROM users WHERE user_id = '${userId}'`;
const result = await db.query(query);
```

### 8.2 Transaction Processing

- **Transactions**: Use transactions when multiple queries are part of one operation

```typescript
// ✅ Good Example
await db.beginTransaction();
try {
  await db.query('INSERT INTO users ...');
  await db.query('INSERT INTO user_roles ...');
  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
}
```

## 9. Testing Standards

### 9.1 Test Writing Principles

- **Unit Tests**: Write unit tests for all functions
- **Integration Tests**: Write integration tests for API endpoints
- **Coverage**: Target minimum 70% coverage

### 9.2 Test File Structure

```
server/
├── routes/
│   └── users.ts
└── __tests__/
    └── routes/
        └── users.test.ts
```

## 10. Security Development Standards

### 10.1 Input Validation

- **Validate All Inputs**: Always validate user input
- **Whitelist**: Only allow permitted values

```typescript
// ✅ Good Example
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

### 10.2 Output Filtering

- **XSS Prevention**: HTML escape processing
- **Sensitive Information Masking**: Mask personal information

```typescript
// ✅ Good Example
import DOMPurify from 'isomorphic-dompurify';

const sanitized = DOMPurify.sanitize(userInput);
```

### 10.3 Password Processing

- **Hashing**: Prohibit storing plain text passwords
- **bcrypt**: Hash with bcrypt

```typescript
// ✅ Good Example
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, hashedPassword);
```

## 11. Documentation Standards

### 11.1 Code Comments

- **Function Comments**: Write JSDoc comments for all public functions
- **Complex Logic**: Explain complex logic with comments

```typescript
// ✅ Good Example
/**
 * Retrieves user information by user ID.
 * @param userId - User ID to retrieve
 * @returns User information or null
 */
async function getUserById(userId: string): Promise<User | null> {
  // ...
}
```

### 11.2 README Writing

- **Project Description**: Project overview and purpose
- **Installation Method**: Environment setup and installation procedures
- **Usage**: Basic usage and examples

## 12. Development Environment Setup

### 12.1 Required Tools

- **Node.js**: 18.x or higher
- **npm**: 9.0.0 or higher
- **TypeScript**: 5.3.3 or higher
- **Git**: 2.30 or higher

### 12.2 Editor Settings

- **VS Code / Cursor**: Recommended editor
- **Extensions**:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features

## 13. Reference Materials

- TypeScript Official Documentation: https://www.typescriptlang.org/docs/
- React Official Documentation: https://react.dev/
- Express Official Documentation: https://expressjs.com/
- Airbnb JavaScript Style Guide: https://github.com/airbnb/javascript

## 14. Change History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-01-XX | Initial draft | AI ERP Team |

