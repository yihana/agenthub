# RAG 문서관리 Object Store 마이그레이션 가이드

## 개요
RAG 문서관리 기능이 로컬 파일시스템에서 SAP BTP Object Store(S3)로 전환되었습니다.

## 주요 변경사항

### 1. 파일 저장 위치 변경
- **이전**: 로컬 파일시스템 (`server/uploads/rag/`)
- **현재**: SAP BTP Object Store (S3)

### 2. 데이터베이스 URL 정보
- DB에 저장되는 `file_path` 컬럼이 Object Store URL (`s3://bucket-name/key`) 형식으로 저장됩니다.

### 3. 환경 변수 설정

다음 환경 변수를 `.env` 파일에 추가해야 합니다:

```env
# Object Store 설정 (SAP BTP)
OBJECT_STORE_ACCESS_KEY_ID=AKIAY6GRCOJYWPUQW4FN
OBJECT_STORE_SECRET_ACCESS_KEY=your-secret-access-key
OBJECT_STORE_BUCKET=hcp-afbb500a-4188-4cc6-bfdd-5c74d902685c
OBJECT_STORE_HOST=s3-ap-northeast-2.amazonaws.com
OBJECT_STORE_REGION=ap-northeast-2
```

### 4. Cloud Foundry 배포 시

BTP 환경에서 배포할 때는 VCAP_SERVICES를 통해 자동으로 서비스 키를 가져올 수 있습니다:

```typescript
// index.ts 또는 관련 설정 파일에 추가
import { readServices } from '@sap/xsenv';

if (process.env.VCAP_SERVICES) {
  const services = readServices();
  const objectStoreService = services.find(s => s.label === 'Object Store' || s.name === 'ear-store');
  
  if (objectStoreService) {
    process.env.OBJECT_STORE_ACCESS_KEY_ID = objectStoreService.credentials.access_key_id;
    process.env.OBJECT_STORE_SECRET_ACCESS_KEY = objectStoreService.credentials.secret_access_key;
    process.env.OBJECT_STORE_BUCKET = objectStoreService.credentials.bucket;
    process.env.OBJECT_STORE_HOST = objectStoreService.credentials.host;
    process.env.OBJECT_STORE_REGION = objectStoreService.credentials.region;
  }
}
```

## 새로 추가된 파일

### server/utils/objectStore.ts
Object Store와의 통신을 위한 유틸리티 모듈:
- `uploadToObjectStore()`: 파일 업로드
- `downloadFromObjectStore()`: 파일 다운로드
- `deleteFromObjectStore()`: 파일 삭제
- `checkObjectStoreConnection()`: 연결 상태 확인

## 수정된 파일

### server/routes/rag.ts
- 업로드 라우트: Object Store에 파일 저장
- 다운로드 라우트: Object Store에서 파일 가져오기
- 삭제 라우트: Object Store에서 파일 삭제
- 멀터 설정: 메모리 스토리지 사용 (Buffer 처리)

## 의존성

### 추가된 패키지
- `@aws-sdk/client-s3`: AWS S3 호환 SDK (Object Store 지원)

## 기능 개선 사항

1. **확장성**: 로컬 파일시스템 제한 없음
2. **안정성**: BTP 인프라에 통합된 스토리지 사용
3. **백업**: Object Store의 자동 백업 기능 활용
4. **접근성**: 다중 인스턴스 환경에서 파일 공유 가능

## 기존 파일 마이그레이션

기존에 로컬 파일시스템에 저장된 문서가 있다면:

1. 기존 문서는 Object Store로 마이그레이션 필요
2. DB의 `file_path`를 Object Store URL로 업데이트 필요
3. 로컬 파일은 별도 스크립트로 Object Store에 업로드

## 테스트 방법

1. 환경 변수 설정 확인
2. RAG 문서업로드 테스트
3. Object Store에 파일이 저장되는지 확인
4. 문서 다운로드/삭제 테스트

## 문제 해결

### Object Store 업로드 실패
- 환경 변수 확인
- 서비스 키 유효성 확인
- 네트워크 연결 확인

### 파일 다운로드 실패
- Object Store 권한 확인
- URL 형식 확인 (`s3://` 스키마)

