# 🧪 인터페이스 연동 자동화 테스트 가이드

## 문제 해결 완료 ✅

"분석 실패: undefined" 오류가 발생했던 문제를 해결했습니다.

### 🔧 수정 사항
1. **백엔드 오류 처리 개선**: 더 자세한 로그와 오류 메시지 제공
2. **인증 우회**: 분석 엔드포인트는 인증 없이 테스트 가능
3. **프론트엔드 오류 처리 개선**: 더 명확한 오류 메시지 표시

## 🚀 테스트 방법

### 1단계: 테스트 API 서버 실행
```bash
cd server/test-apis
npm install
npm start
```

### 2단계: 메인 애플리케이션 실행
```bash
# 프로젝트 루트에서
start.bat
```

### 3단계: 인터페이스 자동화 테스트

#### 🏢 Company 1 API 테스트 (Bearer Token)
1. 메뉴에서 "인터페이스 연동 자동화" 클릭
2. "인터페이스 생성" 탭 선택
3. 다음 정보 입력:
   - **API URL**: `http://localhost:3001/api/employees`
   - **인증 방식**: Bearer Token
   - **Bearer Token**: `test-token-company1-2024`
4. "API 분석 및 매핑" 버튼 클릭

#### 🏢 Company 2 API 테스트 (Basic Auth)
1. 같은 페이지에서:
   - **API URL**: `http://localhost:3002/api/staff`
   - **인증 방식**: Basic Auth
   - **사용자명**: `company2`
   - **비밀번호**: `test123`
2. "API 분석 및 매핑" 버튼 클릭

## 📋 예상 결과

### Company 1 API 분석 결과
- **자동 매핑된 필드들**:
  - `emp_id` → `employeeId`
  - `full_name` → `name`
  - `dept_name` → `department`
  - `position_name` → `position`
  - `email_address` → `email`
  - `mobile_phone` → `phone`
  - `hire_date` → `hireDate`
  - `work_status` → `status`

### Company 2 API 분석 결과
- **자동 매핑된 필드들**:
  - `employee_number` → `employeeId`
  - `name` → `name`
  - `department` → `department`
  - `role` → `position`
  - `email` → `email`
  - `phone` → `phone`
  - `start_date` → `hireDate`
  - `employment_status` → `status`

## 🔍 디버깅 정보

### 백엔드 로그 확인
서버 콘솔에서 다음 로그들을 확인할 수 있습니다:
```
API 분석 요청: { url: 'http://localhost:3001/api/employees', authType: 'bearer', ... }
Bearer Token 설정됨
API 호출 시도: http://localhost:3001/api/employees
API 응답 상태: 200
API 응답 데이터: { success: true, data: [...] }
```

### 프론트엔드 로그 확인
브라우저 개발자 도구 콘솔에서 다음 로그들을 확인할 수 있습니다:
```
API 분석 요청: { url: 'http://localhost:3001/api/employees', authType: 'bearer', ... }
API 분석 응답 상태: 200
API 분석 결과: { success: true, fields: [...], ... }
```

## ⚠️ 주의사항

1. **포트 충돌**: 3001, 3002 포트가 사용 중이면 다른 포트로 변경
2. **방화벽**: 로컬호스트 접근이 차단되지 않았는지 확인
3. **CORS**: 브라우저에서 CORS 오류가 발생하면 서버 재시작

## 🎯 성공 확인

분석이 성공하면:
1. ✅ 성공 메시지 표시
2. 📋 필드 매핑 테이블 표시
3. 🔄 매핑 수정 가능
4. 💾 인터페이스 저장 가능

## 🆘 문제 해결

만약 여전히 문제가 발생하면:
1. 브라우저 개발자 도구 콘솔 확인
2. 서버 콘솔 로그 확인
3. 네트워크 탭에서 요청/응답 확인
4. 테스트 API 서버가 정상 실행 중인지 확인

```bash
# 테스트 API 서버 상태 확인
netstat -an | findstr :3001
netstat -an | findstr :3002
```
