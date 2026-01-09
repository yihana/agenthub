# XSUAA 및 SAP IAS 연동 설정 가이드

이 문서는 EAR 애플리케이션을 SAP Identity Authentication Service (IAS) 및 XSUAA와 연동하는 방법을 설명합니다.

## 목차
1. [개요](#개요)
2. [사전 준비사항](#사전-준비사항)
3. [XSUAA 서비스 인스턴스 생성](#xsuaa-서비스-인스턴스-생성)
4. [IAS 설정](#ias-설정)
5. [애플리케이션 배포 설정](#애플리케이션-배포-설정)
6. [권한(Role) 설정](#권한role-설정)
7. [테스트 및 검증](#테스트-및-검증)
8. [문제 해결](#문제-해결)

## 개요

### 아키텍처
```
사용자 → React App → Backend API
            ↓
        SAP IAS (다른 Subaccount)
            ↓
        XSUAA (현재 Subaccount)
            ↓
        권한 검증 (EAR-ADMIN, EAR-USER, etc.)
```

### 주요 개념
- **SAP IAS**: 사용자 인증을 담당하는 서비스 (외부 Subaccount에 이미 설정됨)
- **XSUAA**: 애플리케이션 권한 관리 및 토큰 발급을 담당
- **OAuth2**: IAS와 XSUAA 간의 인증 프로토콜

## 사전 준비사항

### 1. 필요한 정보 수집
- [ ] SAP IAS가 설정된 Subaccount 정보
- [ ] IAS Tenant URL
- [ ] 현재 애플리케이션이 배포된 Subaccount 정보
- [ ] 애플리케이션 URL (배포 후)

### 2. BTP Cockpit 접근 권한
- [ ] Subaccount Admin 권한
- [ ] Space Developer 권한

## XSUAA 서비스 인스턴스 생성

### 1. BTP Cockpit에서 XSUAA 서비스 생성

#### 1.1 Service Marketplace에서 XSUAA 선택
1. SAP BTP Cockpit에 로그인
2. 현재 애플리케이션이 배포된 Subaccount 선택
3. **Services** → **Service Marketplace** 이동
4. **XS User Account and Authentication** 검색 및 선택  --> 검색이 안되어 xsuaa 로 검색하면 나오는 "Authorization and Trust Management Service" 서비스 선택


#### 1.2 XSUAA 서비스 인스턴스 생성
1. **Create** 버튼 클릭
2. 서비스 인스턴스 설정:
   - **Service Instance Name**: `ear-xsuaa` (또는 원하는 이름) --> `ear-dev-xsuaa` 로 생성함
   - **Service Plan**: `application` 선택
   - **Space**: 애플리케이션 배포된 Space 선택

#### 1.3 XSUAA 설정 파일 (xs-security.json) 생성

프로젝트 루트에 `xs-security.json` 파일을 생성합니다:

```json
{
  "xsappname": "ear-dev-xsuaa",
  "tenant-mode": "dedicated",
  "description": "EAR Application Security Configuration",
  "scopes": [
    {
      "name": "$XSAPPNAME.Administrator",
      "description": "Administrator Scope"
    },
    {
      "name": "$XSAPPNAME.User",
      "description": "User Scope"
    },
    {
      "name": "$XSAPPNAME.5TIER",
      "description": "5TIER Scope"
    },
    {
      "name": "$XSAPPNAME.5TIER-ETC",
      "description": "5TIER-ETC Scope"
    }
  ],
  "role-templates": [
    {
      "name": "EAR-ADMIN",
      "description": "EAR Administrator Role",
      "scope-references": [
        "$XSAPPNAME.Administrator"
      ]
    },
    {
      "name": "EAR-USER",
      "description": "EAR User Role",
      "scope-references": [
        "$XSAPPNAME.User"
      ]
    },
    {
      "name": "EAR-5TIER",
      "description": "EAR 5TIER Role",
      "scope-references": [
        "$XSAPPNAME.5TIER"
      ]
    },
    {
      "name": "EAR-5TIER-ETC",
      "description": "EAR 5TIER-ETC Role",
      "scope-references": [
        "$XSAPPNAME.5TIER-ETC"
      ]
    }
  ],
   "oauth2-configuration": {
     "token-validity": 43200,
     "redirect-uris": [
       "https://<your-app-url>/**",
       "https://<your-app-url>/api/auth/callback"
     ]
   }
 }
```

**중요**: `<your-app-url>`을 실제 배포된 애플리케이션 URL로 교체하세요.

#### 1.4 XSUAA 서비스 인스턴스 업데이트

```bash
# XSUAA 서비스 인스턴스 업데이트
## 아래명령은 작동이 안되어 일단 화면에서 Bind Application 할때 json 파일을 주입하여 처리 application 을 ear-dev 로 선택해서 처리함
cf update-service ear-dev-xsuaa -c xs-security.json
```

또는 BTP Cockpit에서:
1. **Services** → **Instances and Subscriptions** 이동
2. 생성한 XSUAA 인스턴스 선택
3. **Update** 버튼 클릭
4. `xs-security.json` 파일 내용을 복사하여 붙여넣기

### 2. 서비스 키 생성

#### 2.1 CLI를 통한 서비스 키 생성
```bash
cf create-service-key ear-dev-xsuaa ear-dev-xsuaa-key
cf service-key ear-dev-xsuaa ear-dev-xsuaa-key
```

#### 2.2 BTP Cockpit을 통한 서비스 키 생성
1. **Services** → **Instances and Subscriptions**
2. `ear-xsuaa` 인스턴스 선택
3. **Service Keys** 탭 클릭
4. **Create Service Key** 클릭
5. Key 이름: `ear-xsuaa-key`
6. 생성된 키 복사 및 저장




## IAS 설정

### 1. IAS에서 애플리케이션 등록

#### 1.1 IAS Cockpit 접근
1. IAS가 설정된 Subaccount로 이동
2. **Services** → **Identity Authentication** 선택
3. **Go to Application** 클릭

#### 1.2 새 애플리케이션 생성
1. **Applications** → **Create** 클릭
2. 애플리케이션 설정:
   - **Name**: `EAR Application`
   - **Type**: `OpenID Connect`
   - **Template**: `Web Application`

#### 1.3 OAuth 2.0 설정
1. **Configuration** 탭에서:
   - **Allowed Redirect URIs**: 
     ```
     https://<your-app-url>/**
     https://<your-app-url>/api/auth/callback
     ```
   - **Allowed Logout URLs**:
     ```
     https://<your-app-url>/**
     ```
   - **Token Endpoint Authentication Method**: `client_secret_post` 또는 `client_secret_basic`

#### 1.4 사용자 속성 매핑
1. **User Attributes** 탭에서:
   - **Email**: `mail` 또는 `email`
   - **First Name**: `given_name`
   - **Last Name**: `family_name`
   - **User ID**: `user_name` 또는 `mail`

### 2. XSUAA와 IAS 연결 설정

#### 2.1 Trust 설정 (XSUAA에서 IAS로)
BTP Cockpit (애플리케이션 Subaccount)에서:
1. **Security** → **Trust Configuration** 이동
2. **New Trust Configuration** 클릭
3. **Identity Provider**: `IAS` 선택
4. IAS Tenant 정보 입력:
   - **IAS Tenant URL**: IAS Tenant URL (예: `https://<tenant-id>.accounts.ondemand.com`)
   - **Name**: `ias-trust`
5. **Save** 클릭

#### 2.2 XSUAA 설정에 IAS Trust 추가

`xs-security.json` 파일 업데이트:
###### 아래는 잘못된 설정임 이것때문에 엄청나게 삽질함
###### 아래는 잘못된 설정임 이것때문에 엄청나게 삽질함
###### identity-provider 는 xs-security.jso 에서 설정하는 것이 아니라 
###### BTP Cockpit → Subaccount → Security → Trust Configuration → Establish/New Trust → IAS 테넌트 선택/입력 → 저장.

```json
{
  "xsappname": "ear-app",
  "tenant-mode": "dedicated",
  "description": "EAR Application Security Configuration",
//   "identity-provider": {
//     "type": "SAP IDENTITY_PROVIDER",
//     "name": "ias-trust"
//   },
  "scopes": [
    // ... 기존 scopes 유지
  ],
  "role-templates": [
    // ... 기존 role-templates 유지
  ],
  "oauth2-configuration": {
    // ... 기존 설정 유지
  }
}
```

서비스 인스턴스 업데이트:
```bash
cf update-service ear-xsuaa -c xs-security.json
```

## 애플리케이션 배포 설정

### 1. manifest 파일 업데이트

#### manifest-dev.yml 또는 manifest-prd.yml 수정:

```yaml
---
applications:
  - name: ear-dev  # 또는 ear-prd
    memory: 2G
    disk_quota: 2G
    instances: 1
    buildpacks:
      - nodejs_buildpack
    command: npm start
    env:
      NODE_ENV: production
      NODE_VERSION: 22.x
      DB_TYPE: hana
      EMBEDDING_MODEL: text-embedding-3-large
      CHAT_MODEL: gpt-4o-mini
      USE_XSUAA: "true"  # XSUAA 활성화
    services:
      - EAR-DEV  # 또는 EAR-PRD (기존 서비스)
      - ear-xsuaa  # XSUAA 서비스 인스턴스 이름
    health-check-type: http
    health-check-http-endpoint: /health
    timeout: 180
```

### 2. 서비스 바인딩 확인

배포 전 서비스 바인딩 확인:
```bash
cf services
cf service ear-xsuaa
```

### 3. 애플리케이션 배포

```bash
# 빌드
npm run build

# 배포
cf push -f manifest-dev.yml  # 또는 manifest-prd.yml
```

### 4. 배포 후 확인

```bash
# 애플리케이션 환경 변수 확인
cf env ear-dev

# VCAP_SERVICES에 xsuaa가 포함되어 있는지 확인
cf env ear-dev | grep VCAP_SERVICES
```

## 권한(Role) 설정

### 1. BTP Cockpit에서 Role Collection 생성

#### 1.1 Role Collection 생성
1. **Security** → **Role Collections** 이동
2. **Create** 클릭
3. Role Collection 설정:
   - **Name**: `EAR-ADMIN`
   - **Description**: `EAR Administrator Role Collection`
4. **Add Role** 클릭:
   - **Application**: `ear-app` 선택
   - **Role Template**: `EAR-ADMIN` 선택
   - **Save** 클릭

#### 1.2 추가 Role Collection 생성
다음 Role Collection들도 동일한 방식으로 생성:
- `EAR-USER`
- `EAR-5TIER`
- `EAR-5TIER-ETC`

### 2. 사용자에게 Role Collection 할당

#### 2.1 BTP Cockpit에서 할당
1. **Security** → **Role Collections** 이동
2. `EAR-ADMIN` Role Collection 선택
3. **Users** 탭 클릭
4. **Add User** 클릭
5. 사용자 이메일 또는 User ID 입력
6. **Save** 클릭

#### 2.2 IAS에서 직접 할당 (권장)
IAS Cockpit에서:
1. **User Management** → **Users** 이동
2. 사용자 선택
3. **Role Collections** 탭 클릭
4. `EAR-ADMIN` 등 필요한 Role Collection 추가

## 테스트 및 검증

### 1. XSUAA 설정 확인

#### 백엔드 API로 확인:
```bash
curl https://<your-app-url>/api/auth/config
```

예상 응답:
```json
{
  "useXSUAA": true,
  "iasEnabled": true,
  "loginUrl": "https://..."
}
```

### 2. IAS 로그인 테스트

1. 애플리케이션 로그인 페이지 접속
2. **SAP IAS 로그인** 버튼 클릭
3. IAS 로그인 페이지로 리다이렉트되는지 확인
4. IAS 자격 증명으로 로그인
5. 애플리케이션으로 리다이렉트되는지 확인
6. 사용자 정보가 올바르게 표시되는지 확인

### 3. 권한 테스트

#### 관리자 권한 확인:
```bash
# XSUAA 토큰으로 API 호출
TOKEN="<xsuaa-token>"
curl -H "Authorization: Bearer $TOKEN" https://<your-app-url>/api/auth/verify
```

응답에서 `isAdmin: true` 및 `scopes` 배열에 `EAR-ADMIN` 포함 확인

### 4. 로그 확인

애플리케이션 로그에서 XSUAA 관련 메시지 확인:
```bash
cf logs ear-dev --recent
```

## 문제 해결

### 1. XSUAA 설정이 로드되지 않음

**증상**: `/api/auth/config`에서 `useXSUAA: false`

**해결 방법**:
- `VCAP_SERVICES` 환경 변수 확인:
  ```bash
  cf env ear-dev | grep VCAP_SERVICES
  ```
- 서비스 바인딩 확인:
  ```bash
  cf services
  cf bind-service ear-dev ear-xsuaa
  cf restart ear-dev
  ```

### 2. IAS 로그인 리다이렉트 실패

**증상**: 로그인 후 리다이렉트되지 않음

**해결 방법**:
- `xs-security.json`의 `redirect-uris` 확인
- IAS 애플리케이션 설정의 `Allowed Redirect URIs` 확인
- URL이 정확히 일치하는지 확인 (https 포함, 경로 포함)

### 3. 권한이 올바르게 표시되지 않음

**증상**: `isAdmin: false` 또는 스코프가 없음

**해결 방법**:
- Role Collection이 사용자에게 할당되었는지 확인
- 토큰 디코딩하여 스코프 확인:
  ```bash
  # JWT.io에서 토큰 디코딩하여 scope 확인
  ```
- `xs-security.json`의 role-template 설정 확인

### 4. Cross-Subaccount Trust 설정 문제

**증상**: IAS와 연결되지 않음

**해결 방법**:
- Trust Configuration이 올바르게 설정되었는지 확인
- `xs-security.json`의 `identity-provider` 설정 확인
- IAS Tenant URL이 올바른지 확인

### 5. CORS 오류

**증상**: 브라우저 콘솔에서 CORS 오류

**해결 방법**:
- 백엔드 CORS 설정 확인 (`server/index.ts`)
- IAS 및 XSUAA URL이 CORS 허용 목록에 있는지 확인

## 추가 리소스

- [SAP XSUAA 문서](https://help.sap.com/docs/btp/sap-business-technology-platform/configure-user-account-and-authentication)
- [SAP IAS 문서](https://help.sap.com/docs/identity-authentication)
- [OAuth 2.0 스펙](https://oauth.net/2/)

## 참고사항

### 스코프 vs Role Collection
- **스코프 (Scope)**: 애플리케이션 레벨 권한 정의 (`xs-security.json`에 정의)
- **Role Collection**: 사용자에게 할당되는 역할 그룹 (BTP Cockpit에서 관리)
- Role Collection은 하나 이상의 Role Template을 포함하며, 각 Role Template은 스코프를 참조

### 토큰 구조
XSUAA 토큰에는 다음 정보가 포함됩니다:
- `user_name`: 사용자 ID
- `email`: 이메일 주소
- `scope`: 권한 스코프 배열
- `given_name`, `family_name`: 사용자 이름

### 하이브리드 모드
현재 구현은 XSUAA와 JWT 인증을 모두 지원합니다:
- XSUAA가 설정된 경우: XSUAA 토큰 사용
- XSUAA가 설정되지 않은 경우: 기존 JWT 인증 사용 (하위 호환성)

이를 통해 점진적으로 XSUAA로 마이그레이션할 수 있습니다.

