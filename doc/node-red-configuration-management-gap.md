# Node-RED 형상/변경관리 적합성 점검 (현재 구현 기준)

## 1) 요약
- 현재 Subflow 개발/배포 화면은 **Node-RED Admin API 기반 조회/배포**와 **flows.json 파일 조회**를 지원합니다.
- 추가로 이번 변경에서 **Node-RED 현재 flows를 파일로 export**하여 Git 형상으로 저장하는 기능을 넣었습니다.
- 다만, 전사 EAI 수준의 거버넌스(승인/릴리즈/감사로그/환경별 파이프라인)까지는 아직 일부 보완이 필요합니다.

## 2) 사용자가 제시한 관리안 대비 체크

### 이미 반영됨
1. Flow를 코드(JSON)로 취급
   - `/api/subflow-manager/v1/node-red/flow-template` 로 템플릿 JSON 조회
   - `/api/subflow-manager/v1/node-red/deploy/admin-api` 로 JSON 배포
2. Node-RED 현재 형상 조회
   - `/api/subflow-manager/v1/node-red/flows` (Admin API `/flows` 조회)
   - `/api/subflow-manager/v1/node-red/flows-file` (로컬 flows.json 조회)
3. 배포 자동화 경로
   - Admin API/CLI 배포 버튼 분리
4. 가독성
   - Flow 탭 목록 + 선택 탭 노드 흐름 + 선택 탭 JSON 상세

### 이번에 추가 반영
1. 현재 Node-RED flows를 Git 경로로 저장
   - `/api/subflow-manager/v1/node-red/export-file`
   - 예: `node-red/flows/flows.dev.json`

### 아직 별도 체계 필요
1. `flows_cred.json`, `credentialSecret`, settings 분리 정책 강제
2. `main/develop/feature/hotfix` 브랜치 정책 자동 강제
3. 배포 승인, 감사로그, 릴리즈 태깅 자동화
4. Node-RED 프로젝트 모드/CI 파이프라인 통합

## 3) 권장 운영 방식 (현 구조에서 즉시 가능)
1. Node-RED에서 변경
2. 배포 화면 > 로컬 플로우 조회
3. 조회 결과를 `node-red/flows/flows.<env>.json` 으로 Export
4. PR로 형상 반영
5. 승인 후 배포 화면에서 Admin API로 반영

## 4) 참고
- Node-RED RFC 런타임 오류 (`connectionParameters`)는 형상 문제가 아니라 Node-RED SAP RFC 노드 설정 문제입니다.
- Node-RED HTTP request `RequestError`는 대상 API URL/접속/프록시 문제 점검 필요.
