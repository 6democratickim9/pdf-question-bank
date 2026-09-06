export const DVA_TAXONOMY = {
  LAMBDA: ['Concurrency Control', 'Async Failure Handling', 'Retry', 'Event Source Mapping', 'Version / Alias', 'Cold Start / Performance', 'Memory / CPU', 'VPC Integration', 'Environment Variables', 'Execution Role'],
  DYNAMODB: ['Partition Key Design', 'Hot Partition', 'GSI', 'LSI', 'GSI vs LSI', 'Strong vs Eventual Consistency', 'TTL', 'Transactions', 'Streams', 'Capacity / Throttling'],
  'API GATEWAY': ['Stage / Stage Variable', 'Lambda Integration', 'Mock Integration', 'Mapping Template', 'Authorizer', 'Cognito', 'API Key / Usage Plan', 'Canary Deployment'],
  'MESSAGING / EVENT': ['SQS Decoupling', 'SNS Fan-out', 'DLQ', 'Visibility Timeout', 'FIFO', 'EventBridge Routing', 'EventBridge Scheduling', 'Event Filtering', 'Kinesis', 'Step Functions'],
  SECURITY: ['IAM Role', 'Execution Role', 'Resource Policy', 'AssumeRole / STS', 'Cross-account Access', 'KMS', 'Secrets Manager', 'Parameter Store', 'Cognito User Pool', 'Cognito Identity Pool'],
  'CLOUDFORMATION / SAM': ['Change Set', 'Drift Detection', 'ImportValue', 'DeletionPolicy', 'SAM Transform', 'Dynamic Reference', 'Deployment Package'],
  OBSERVABILITY: ['CloudWatch Logs', 'Metric Filter', 'Alarm', 'Custom Metric', 'X-Ray', 'CloudTrail', 'Distributed Tracing'],
  'CI/CD': ['CodePipeline', 'Manual Approval', 'CodeBuild', 'CodeBuild Cache', 'CodeArtifact', 'CodeDeploy', 'Blue/Green', 'Canary', 'Rollback'],
  'STORAGE / CACHE / NETWORK': ['S3 Access', 'S3 Event', 'CloudFront Cache', 'OAC', 'Presigned URL', 'ElastiCache', 'Cache Strategy', 'X-Forwarded-For', 'ALB', 'VPC Endpoint'],
} as const;

export const DVA_PARTS = ['PART 1 Lambda', 'PART 2 DynamoDB', 'PART 3 API Gateway + S3', 'PART 4 Messaging / Event', 'PART 5 Security', 'PART 6 IaC / CI-CD', 'PART 7 Observability / Troubleshooting', 'PART 8 Other Services'] as const;
export const allowedPatterns = new Set<string>(Object.values(DVA_TAXONOMY).flat());
