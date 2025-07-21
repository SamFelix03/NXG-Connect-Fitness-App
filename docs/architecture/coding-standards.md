# Coding Standards

## Core Standards
- **Languages & Runtimes:** TypeScript 5.3.3, Node.js 20.11.0 LTS
- **Style & Linting:** ESLint with TypeScript rules, Prettier for formatting
- **Test Organization:** Jest tests co-located with source files, supertest for API tests

## Critical Rules
- **Async/Await Only:** Never use callbacks or raw Promises - always use async/await for better error handling
- **Input Validation Required:** All API endpoints must use Joi validation schemas before processing
- **Error Logging Mandatory:** All catch blocks must log errors with context using Winston logger
- **JWT Validation:** Protected routes must use auth middleware - never bypass authentication
- **External Service Timeouts:** All external HTTP calls must have explicit timeouts and error handling
- **Database Transactions:** Multi-document operations must use MongoDB transactions for consistency
- **Redis Key Prefixes:** All Redis keys must use consistent prefixes (auth:, cache:, session:) for organization
- **TypeScript Strict Mode:** All files must compile with strict TypeScript settings - no any types allowed
