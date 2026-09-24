import { AWS_SERVICE_DESCRIPTIONS } from './awsServiceDescriptions';

export const AWS_CONCEPT_DESCRIPTIONS: Record<string, string> = {
  'ALB Client IP Forwarding': 'X-Forwarded-For는 HTTP 프록시나 로드 밸런서를 거치기 전 원래 클라이언트 IP를 전달하는 헤더입니다. ALB 뒤의 애플리케이션은 연결 source IP가 아니라 이 헤더를 읽어 실제 클라이언트를 식별합니다.',
  'API Audit Trail': 'CloudTrail은 API 호출 주체, 시간, 대상, 요청 정보를 기록합니다. 누가 리소스를 변경했는지 조사하거나 보안 감사를 수행할 때 사용합니다.',
  'API Authentication with Cognito': 'Cognito 사용자 풀은 로그인과 JWT 발급을 담당하고 API Gateway authorizer는 토큰을 검증합니다. 애플리케이션 코드를 실행하기 전에 API 계층에서 사용자를 인증할 수 있습니다.',
  'API Gateway Lambda Integration': 'API Gateway가 HTTP 요청을 Lambda 이벤트로 변환하고 함수 응답을 HTTP 응답으로 반환하는 통합 방식입니다. 서버 관리 없이 API 백엔드를 구현할 때 사용합니다.',
  'API Request Transformation': 'Mapping Template은 VTL을 사용해 API 요청과 응답 형식을 백엔드가 요구하는 구조로 변환합니다. 백엔드 코드를 바꾸지 않고 필드명이나 payload 형태를 맞출 때 사용합니다.',
  'API Usage Control': 'API Key는 호출자를 식별하고 Usage Plan은 초당 요청률과 할당량을 제한합니다. 인증 자체보다 고객별 사용량 측정과 throttling에 사용합니다.',
  'Application Caching': 'ElastiCache는 자주 읽는 데이터를 메모리에 저장해 데이터베이스 호출과 응답 지연을 줄입니다. 캐시 무효화와 TTL 전략을 함께 설계해야 합니다.',
  'Blue/Green Deployment': '기존 환경과 새 환경을 동시에 유지한 뒤 트래픽을 새 환경으로 전환하는 배포 방식입니다. 문제가 생기면 트래픽을 기존 환경으로 되돌려 빠르게 롤백할 수 있습니다.',
  'Build Automation': 'CodeBuild는 buildspec에 정의한 명령을 격리된 환경에서 실행해 컴파일, 테스트, 패키징을 자동화합니다. 빌드 서버를 직접 유지하지 않아도 됩니다.',
  'CI/CD Pipeline': 'CodePipeline은 소스, 빌드, 테스트, 승인, 배포 단계를 연결해 코드 변경이 릴리스되는 흐름을 자동화합니다.',
  'Canary Deployment': '새 버전에 일부 트래픽만 먼저 보내 지표와 오류를 확인한 뒤 전체로 확대하는 배포 방식입니다. 위험을 제한하면서 실제 트래픽으로 검증할 수 있습니다.',
  'CloudFormation Change Set': 'Change Set은 CloudFormation 업데이트가 실제 적용되기 전에 생성·수정·삭제할 리소스를 미리 보여줍니다. 영향 검토 후 안전하게 변경할 때 사용합니다.',
  'CloudFormation Drift': 'Drift Detection은 실제 리소스 설정이 CloudFormation 템플릿과 달라졌는지 찾습니다. 콘솔이나 API로 수동 변경된 리소스를 확인할 때 사용합니다.',
  'CloudFormation Dynamic Reference': 'Dynamic Reference는 템플릿에 비밀 값을 직접 기록하지 않고 배포 시점에 Secrets Manager나 Parameter Store 값을 참조합니다.',
  'CloudFormation Resource Retention': 'DeletionPolicy는 스택 삭제나 리소스 교체 때 데이터 리소스를 보존, 스냅샷 생성, 삭제 중 무엇으로 처리할지 결정합니다.',
  'CloudFront Caching': 'CloudFront는 Cache Key와 TTL에 따라 엣지에서 응답을 재사용합니다. 헤더·쿠키·쿼리 문자열을 Cache Key에 포함할지에 따라 캐시 적중률과 응답 정확성이 달라집니다.',
  'CloudWatch Alarm': 'CloudWatch Alarm은 지표가 임계값을 일정 기간 벗어나면 상태를 변경하고 SNS나 Auto Scaling 같은 동작을 실행합니다.',
  'CloudWatch Logging': 'CloudWatch Logs는 애플리케이션과 AWS 서비스 로그를 중앙 수집하고 검색·보존합니다. Metric Filter를 사용하면 로그 패턴을 수치 지표로 변환할 수 있습니다.',
  'Cognito Identity Pool': 'Identity Pool은 인증된 사용자나 게스트에게 AWS STS 임시 자격 증명을 발급합니다. 사용자가 S3 같은 AWS 리소스에 직접 접근해야 할 때 사용합니다.',
  'Cognito User Pool': 'User Pool은 회원가입, 로그인, MFA와 JWT 토큰 발급을 담당하는 사용자 디렉터리입니다. 애플리케이션 사용자 인증에 사용합니다.',
  'Configuration and Secrets': 'Parameter Store는 일반 설정과 SecureString을 계층적으로 저장합니다. 자동 교체가 필요한 비밀은 Secrets Manager, 단순 설정과 저비용 보관은 Parameter Store가 적합합니다.',
  'Cross-account Access': '교차 계정 접근은 리소스 소유 계정의 신뢰 또는 리소스 정책과 호출 계정의 IAM 권한을 모두 맞춰야 합니다. 서비스에 따라 AssumeRole 또는 리소스 기반 정책을 사용합니다.',
  'Cross-account Role Assumption': 'AssumeRole은 다른 계정의 IAM Role을 맡아 STS 임시 자격 증명을 받는 방식입니다. 장기 액세스 키 없이 교차 계정 권한을 위임할 수 있습니다.',
  'Cross-stack Reference': 'CloudFormation Export와 Fn::ImportValue는 한 스택의 출력을 다른 스택에서 참조하게 합니다. 공유 리소스 값을 하드코딩하지 않고 연결할 때 사용합니다.',
  'Dead-letter Queue': 'DLQ는 반복 처리에 실패한 메시지나 비동기 이벤트를 별도로 격리합니다. 정상 처리를 막지 않으면서 원인 조사와 재처리를 가능하게 합니다.',
  'Deployment Automation': 'CodeDeploy는 배포 그룹과 배포 구성을 사용해 새 버전을 대상에 배포하고 상태를 추적합니다. Lambda에서는 트래픽 이동과 자동 롤백을 지원합니다.',
  'Deployment Rollback': 'Rollback은 배포 오류나 경보 발생 시 이전의 정상 버전으로 되돌리는 과정입니다. 배포 서비스의 상태 감시와 CloudWatch Alarm을 연결해 자동화할 수 있습니다.',
  'Distributed Tracing': 'X-Ray는 하나의 요청이 여러 서비스와 함수에서 처리되는 경로를 trace와 segment로 기록합니다. 어느 구간에서 지연이나 오류가 발생했는지 찾을 때 사용합니다.',
  'DynamoDB Capacity': 'DynamoDB 처리량은 읽기·쓰기 용량과 파티션별 부하의 영향을 받습니다. On-demand는 트래픽 변화에 자동 대응하고 Provisioned는 예측 가능한 부하와 세밀한 용량 제어에 적합합니다.',
  'DynamoDB GSI': 'GSI는 기본 파티션 키와 다른 키로 전체 테이블을 조회하는 보조 인덱스입니다. 테이블 생성 후에도 추가할 수 있고 별도 처리량을 가지며 최종적 일관성 읽기만 지원합니다.',
  'DynamoDB LSI': 'LSI는 기본 파티션 키를 유지하면서 다른 정렬 키로 조회하는 인덱스입니다. 테이블 생성 시에만 만들 수 있고 기본 테이블 처리량을 공유하며 강력한 일관성 읽기가 가능합니다.',
  'DynamoDB Partition Key': 'Partition Key는 항목의 저장 파티션을 결정합니다. 값의 종류가 많고 요청이 고르게 분산되는 키를 선택해야 hot partition과 throttling을 피할 수 있습니다.',
  'DynamoDB Streams': 'DynamoDB Streams는 항목 생성·수정·삭제의 변경 기록을 시간 순서대로 제공합니다. Lambda를 연결해 변경 데이터 캡처와 후속 처리를 구현할 수 있습니다.',
  'DynamoDB TTL': 'TTL은 지정한 Unix epoch 속성이 지난 항목을 DynamoDB가 비동기적으로 삭제하게 합니다. 즉시 삭제 보장은 없으며 만료 데이터 정리에 사용합니다.',
  'DynamoDB Transactions': 'TransactWriteItems와 TransactGetItems는 여러 항목 작업을 원자적으로 처리합니다. 모두 성공하거나 모두 취소되어 데이터 일관성이 필요한 작업에 적합합니다.',
  'Encryption with KMS': 'KMS는 암호화 키의 생성, 보관, 권한과 감사를 관리합니다. Envelope Encryption에서는 KMS가 데이터 키를 보호하고 실제 대용량 데이터는 데이터 키로 암호화합니다.',
  'Event Filtering': 'Event Filtering은 이벤트 내용이 조건과 일치할 때만 대상을 호출합니다. 불필요한 함수 실행과 비용을 줄이고 소비자별 관심 이벤트를 분리합니다.',
  'EventBridge Routing': 'EventBridge Rule은 event pattern과 일치하는 이벤트를 Lambda, SQS, SNS 등의 대상으로 전달합니다. 서비스 간 결합도를 낮춘 이벤트 기반 라우팅에 사용합니다.',
  'EventBridge Scheduling': 'EventBridge Scheduler 또는 예약 규칙은 cron/rate 일정에 따라 대상을 호출합니다. 서버 없이 주기 작업과 예약 실행을 구성할 수 있습니다.',
  'FIFO Ordering and Deduplication': 'SQS FIFO는 MessageGroupId 안에서 순서를 보장하고 중복 제거 ID로 반복 전송을 억제합니다. 순서와 중복 방지가 필요한 작업에 사용합니다.',
  'IAM Role and Permissions': 'IAM Role은 고정 자격 증명 없이 서비스나 사용자가 임시 권한을 얻도록 합니다. Trust Policy는 누가 역할을 맡는지, Permission Policy는 맡은 뒤 무엇을 할 수 있는지 정합니다.',
  'Kinesis Streaming': 'Kinesis Data Streams는 레코드를 shard에 순서대로 저장해 여러 소비자가 실시간 처리하게 합니다. Partition Key가 레코드의 shard 배치를 결정합니다.',
  'Lambda Async Failure': 'Lambda 비동기 호출은 실패 시 자동 재시도하며 최종 실패 이벤트를 DLQ나 Destination으로 보낼 수 있습니다. 호출자와 함수 실행이 분리된 실패 처리 방식입니다.',
  'Lambda Cold Start': 'Cold Start는 새 실행 환경을 만들고 런타임과 코드를 초기화할 때 발생하는 지연입니다. Provisioned Concurrency는 실행 환경을 미리 준비해 이 지연을 줄입니다.',
  'Lambda Concurrency': 'Lambda Concurrency는 동시에 실행 중인 함수 인스턴스 수입니다. Reserved Concurrency는 함수 전체의 보장·상한을 정하고 Provisioned Concurrency는 미리 준비된 환경 수를 정하며 Event Source Maximum Concurrency는 특정 소스의 병렬 처리를 제한합니다.',
  'Lambda Event Source': 'Event Source Mapping은 SQS, Kinesis, DynamoDB Streams에서 레코드를 읽어 Lambda를 호출합니다. batch size, batching window, 병렬성, 실패 처리를 소스 단위로 제어합니다.',
  'Lambda Execution Role': 'Lambda Execution Role은 함수 코드가 다른 AWS 서비스 API를 호출할 때 사용하는 IAM 역할입니다. 함수 호출 권한과 함수 내부의 리소스 접근 권한은 서로 다릅니다.',
  'Lambda Memory / CPU': 'Lambda는 설정한 메모리에 비례해 CPU와 네트워크 자원을 할당합니다. CPU 병목 작업은 메모리를 올리면 실행 시간이 줄어 전체 비용도 낮아질 수 있습니다.',
  'Lambda VPC Integration': 'Lambda를 VPC 서브넷에 연결하면 RDS 같은 프라이빗 리소스에 접근할 수 있습니다. 인터넷이나 AWS 공개 API 접근에는 NAT Gateway 또는 VPC Endpoint가 추가로 필요할 수 있습니다.',
  'Lambda Version / Alias': 'Lambda Version은 배포 코드와 설정의 변경 불가능한 스냅샷이고 Alias는 특정 버전을 가리키는 이동 가능한 이름입니다. Alias 가중치로 두 버전에 트래픽을 나눌 수 있습니다.',
  'Resource-based Access': 'Resource Policy는 리소스 자체에 누가 접근할 수 있는지 정의합니다. 교차 계정 접근이나 Lambda 호출 권한처럼 리소스 소유자가 호출 주체를 허용할 때 사용합니다.',
  'S3 Access Control': 'S3 접근은 IAM Policy, Bucket Policy, Access Point Policy 등의 조합으로 결정됩니다. 공개 차단과 최소 권한을 유지하면서 객체 또는 prefix 단위로 권한을 제한해야 합니다.',
  'S3 Event Notification': 'S3 Event Notification은 객체 생성·삭제 같은 이벤트를 Lambda, SQS, SNS, EventBridge로 전달합니다. 동일 객체를 다시 쓰는 함수는 재귀 호출을 피하도록 prefix나 별도 버킷을 사용해야 합니다.',
  'S3 Presigned URL': 'Presigned URL은 AWS 자격 증명을 공개하지 않고 제한된 시간 동안 특정 S3 작업을 허용하는 서명된 URL입니다. 클라이언트가 S3에 직접 업로드·다운로드하게 할 때 사용합니다.',
  'SAM Build / Package / Deploy': 'SAM은 build로 함수 의존성을 조립하고 package/deploy로 산출물을 S3에 올린 뒤 CloudFormation 스택을 배포합니다. 일반적인 순서는 build → package → deploy입니다.',
  'SNS Fan-out': 'SNS Fan-out은 하나의 게시 메시지를 여러 SQS 큐, Lambda, HTTP 구독자에게 복제해 전달합니다. 각 소비자가 독립적으로 같은 이벤트를 처리할 때 사용합니다.',
  'SQS Decoupling': 'SQS는 요청을 메시지로 버퍼링해 생산자와 소비자의 속도 및 장애를 분리합니다. 소비자는 자신의 처리량에 맞춰 메시지를 가져가므로 트래픽 급증을 흡수할 수 있습니다.',
  'SQS Visibility Timeout': 'Visibility Timeout은 소비자가 받은 메시지를 일정 시간 다른 소비자에게 보이지 않게 합니다. 처리 시간보다 짧으면 같은 메시지가 중복 처리될 수 있으므로 충분히 길게 설정하거나 연장해야 합니다.',
  'Secrets Management': 'Secrets Manager는 비밀 값을 KMS로 암호화해 저장하고 애플리케이션이 런타임에 검색하게 합니다. 데이터베이스 자격 증명 자동 교체와 교차 계정 리소스 정책도 지원합니다.',
  'Workflow Orchestration': 'Step Functions는 작업 순서, 분기, 병렬 실행, 재시도와 오류 처리를 상태 머신으로 정의합니다. 여러 Lambda와 AWS 서비스를 장기 실행 워크플로로 조정할 때 사용합니다.',
};

export function describeAwsConcept(concept: string, primaryServices: string[]) {
  const exact = AWS_CONCEPT_DESCRIPTIONS[concept];
  if (exact) return exact;
  if (concept.endsWith(' Architecture Decision')) {
    const service = concept.slice(0, -' Architecture Decision'.length);
    const description = AWS_SERVICE_DESCRIPTIONS[service] ?? AWS_SERVICE_DESCRIPTIONS[primaryServices[0]];
    return `${description ?? `${service}의 핵심 기능을 기준으로 판단합니다.`} 문제의 처리 방식, 확장성, 권한, 운영 부담을 비교해 요구사항을 가장 직접적으로 만족하는 구성을 선택합니다.`;
  }
  return `${concept}의 동작 방식과 적용 조건을 확인하고 문제의 핵심 요구사항에 맞는 기능인지 판단합니다.`;
}
