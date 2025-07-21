# Infrastructure and Deployment

## Infrastructure as Code
- **Tool:** AWS CloudFormation with CDK (TypeScript)
- **Location:** `infrastructure/` directory
- **Approach:** Code-first infrastructure with version control and automated deployment

## Deployment Strategy
- **Strategy:** Blue/Green deployment with health checks
- **CI/CD Platform:** AWS CodePipeline with CodeBuild and CodeDeploy
- **Pipeline Configuration:** `.aws/buildspec.yml` and deployment scripts

## Environments

- **Development:** Local development with Docker containers for MongoDB and Redis
- **Staging:** Single EC2 instance with shared MongoDB Atlas cluster for testing
- **Production:** Auto Scaling Group with multiple EC2 instances and dedicated MongoDB Atlas cluster

## Environment Promotion Flow
```text
Development (Local) → Staging (AWS) → Production (AWS)
- Automated testing at each stage
- Manual approval required for production deployment
- Rollback capability at each stage
```

## Rollback Strategy
- **Primary Method:** AWS CodeDeploy automatic rollback on health check failure
- **Trigger Conditions:** HTTP 5xx errors > 5% or application health check failure
- **Recovery Time Objective:** < 5 minutes for automated rollback
