# Test Strategy and Standards

## Testing Philosophy
- **Approach:** Test-driven development (TDD) for critical business logic
- **Coverage Goals:** 80% minimum code coverage for services and controllers
- **Test Pyramid:** 70% unit tests, 20% integration tests, 10% end-to-end tests

## Test Types and Organization

### Unit Tests
- **Framework:** Jest 29.7.0 with TypeScript support
- **File Convention:** `*.test.ts` co-located with source files
- **Location:** Adjacent to source files for better discoverability
- **Mocking Library:** Jest built-in mocking with manual mocks for external services
- **Coverage Requirement:** 85% minimum for service layer, 75% for controllers

**AI Agent Requirements:**
- Generate tests for all public methods and API endpoints
- Cover edge cases and error conditions with specific test scenarios
- Follow AAA pattern (Arrange, Act, Assert) for test structure
- Mock all external dependencies including databases and external APIs

### Integration Tests
- **Scope:** API endpoint testing with real database connections
- **Location:** `tests/integration/` directory with organized test suites
- **Test Infrastructure:**
  - **MongoDB:** TestContainers with isolated test database
  - **Redis:** In-memory Redis instance for testing
  - **External APIs:** WireMock for stubbing external service responses

### End-to-End Tests
- **Framework:** Supertest 6.3.3 for HTTP testing
- **Scope:** Critical user journeys and complete API workflows
- **Environment:** Dedicated testing environment with full service stack
- **Test Data:** Factory pattern for consistent test data generation

## Test Data Management
- **Strategy:** Factory functions for generating consistent test data
- **Fixtures:** JSON fixtures for complex test scenarios in `tests/fixtures/`
- **Factories:** TypeScript factory functions for model creation
- **Cleanup:** Automated test database cleanup between test runs

## Continuous Testing
- **CI Integration:** Automated testing on every pull request and merge
- **Performance Tests:** Artillery load testing in staging environment
- **Security Tests:** OWASP ZAP automated security scanning
