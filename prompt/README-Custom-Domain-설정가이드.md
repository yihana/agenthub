# Custom Domain 설정 가이드

이 문서는 Custom Domain (`https://ear-dev.sk.com`)을 사용할 때 XSUAA/IAS 로그인이 작동하도록 설정하는 방법을 설명합니다.

## 문제 상황

Custom Domain을 설정한 후 로그인 시도 시 다음 에러가 발생:
```
Authorization Request Error
There was an error. The request for authorization was invalid.
```

## 원인

Custom Domain 사용 시 발생할 수 있는 문제들:

1. **XSUAA 서비스의 `redirect-uris` 설정에 Custom Domain이 등록되지 않음**
2. **Cloud Foundry 프록시 환경에서 Host 헤더를 올바르게 처리하지 못함**
   - Custom Domain 사용 시 `X-Forwarded-Host` 헤더 확인 필요
   - `req.get('host')`만으로는 실제 요청 Host를 정확히 파악하지 못할 수 있음
3. **redirect URI 생성 시 프로토콜/호스트 불일치**

## 해결 방법

### 1단계: 코드 개선 (완료됨)

#### 1.1 Host 헤더 처리 개선
- Cloud Foundry Custom Domain 환경을 고려한 Host 헤더 처리 함수 추가
- `X-Forwarded-Host` 헤더를 우선적으로 확인
- `getBaseUrl()` 유틸리티 함수로 일관된 Base URL 생성

#### 1.2 xs-security.json 파일 업데이트
`xs-security.json` 파일에 Custom Domain의 redirect URI가 추가되었습니다 (순서 최적화):

```json
"oauth2-configuration": {
  "token-validity": 43200,
  "redirect-uris": [
    "https://ear-dev.sk.com/api/auth/callback",
    "https://ear-dev.sk.com/**",
    "https://ear-dev.cfapps.ap12.hana.ondemand.com/api/auth/callback",
    "https://ear-dev.cfapps.ap12.hana.ondemand.com/**"
  ]
}
```

**참고**: 구체적인 경로를 먼저 배치하고, wildcard 패턴을 나중에 배치했습니다.

### 2단계: 애플리케이션 재배포

코드 변경사항을 적용하기 위해 애플리케이션을 재배포하세요:

```bash
npm run build
cf push ear-dev
```

또는 변경된 파일만 배포:

```bash
cf push ear-dev
```

### 3단계: XSUAA 서비스 인스턴스 업데이트

#### 방법 A: BTP Cockpit 사용 (권장)

1. **SAP BTP Cockpit** 접속
2. 해당 **Subaccount** 선택
3. **Cloud Foundry** → **Spaces** → 해당 **Space** 선택
4. **Services** → **Instances and Subscriptions** 이동
5. XSUAA 인스턴스 선택 (예: `ear-dev-xsuaa` 또는 `ear-xsuaa`)
6. **Update** 버튼 클릭
7. 업데이트된 `xs-security.json` 파일 내용을 복사하여 붙여넣기
8. **Save** 클릭
9. 애플리케이션 재시작:
   ```bash
   cf restart ear-dev
   ```

#### 방법 B: CF CLI 사용

```bash
# XSUAA 서비스 인스턴스 업데이트
cf update-service ear-dev-xsuaa -c xs-security.json

# 애플리케이션 재시작
cf restart ear-dev
```

**참고**: CF CLI 명령이 작동하지 않는 경우 BTP Cockpit을 사용하세요.

### 4단계: IAS 애플리케이션 설정 확인 (필요한 경우)

IAS를 사용하는 경우, IAS 애플리케이션 설정에도 Custom Domain을 추가해야 할 수 있습니다:

1. **IAS Cockpit** 접속
   - BTP Cockpit → **Services** → **Identity Authentication** → **Go to Application**
2. 해당 애플리케이션 선택
3. **Configuration** 탭 클릭
4. **Allowed Redirect URIs** 섹션 확인:
   ```
   https://ear-dev.cfapps.ap12.hana.ondemand.com/**
   https://ear-dev.cfapps.ap12.hana.ondemand.com/api/auth/callback
   https://ear-dev.sk.com/**
   https://ear-dev.sk.com/api/auth/callback
   ```
5. Custom Domain이 없으면 추가
6. **Save** 클릭

### 5단계: 테스트

1. Custom Domain으로 애플리케이션 접속: `https://ear-dev.sk.com`
2. 로그인 버튼 클릭
3. IAS 로그인 페이지로 정상 리다이렉트되는지 확인
4. 로그인 후 애플리케이션으로 정상 리다이렉트되는지 확인

## 문제 해결

### 여전히 에러가 발생하는 경우

1. **XSUAA 서비스 인스턴스 업데이트 확인**
   - BTP Cockpit에서 서비스 인스턴스의 설정이 업데이트되었는지 확인
   - 애플리케이션이 재시작되었는지 확인

2. **Redirect URI 정확히 일치하는지 확인**
   - 에러 메시지에 표시된 redirect_uri 확인
   - `xs-security.json`의 redirect-uris와 정확히 일치하는지 확인
   - URL 끝의 슬래시(`/`) 포함 여부 확인
   - 프로토콜(`https`) 포함 여부 확인

3. **애플리케이션 로그 확인**
   ```bash
   cf logs ear-dev --recent
   ```
   - OAuth 관련 에러 메시지 확인

4. **XSUAA 설정 확인 API 호출**
   ```bash
   curl https://ear-dev.sk.com/api/auth/config
   ```
   - 응답에서 `loginUrl`이 올바르게 생성되는지 확인

## 주요 개선 사항

### 1. Host 헤더 처리 개선
- **문제**: Cloud Foundry 프록시 환경에서 `req.get('host')`가 실제 요청 Host를 반환하지 않을 수 있음
- **해결**: `X-Forwarded-Host` 헤더를 우선적으로 확인하는 `getBaseUrl()` 함수 추가
- **위치**: `server/utils/ipUtils.ts`

### 2. 일관된 Base URL 생성
- 모든 redirect URI 생성 부분에서 동일한 로직 사용
- Custom Domain과 프록시 환경을 자동으로 감지하여 올바른 Base URL 생성

### 3. 디버깅 로그 강화
- 실제 사용된 Host 헤더 값 로깅
- Base URL 생성 과정 상세 로깅
- 에러 발생 시 redirect URI 비교 정보 제공

## 참고

- Custom Domain은 DNS를 통해 원래 Cloud Foundry 도메인(`ear-dev.cfapps.ap12.hana.ondemand.com`)으로 리다이렉트됩니다
- Cloud Foundry 프록시는 `X-Forwarded-Host` 헤더에 원본 요청 Host를 포함합니다
- 코드는 이제 `X-Forwarded-Host` 헤더를 우선적으로 확인하여 올바른 redirect URI를 생성합니다
- XSUAA 설정에 Custom Domain의 redirect URI가 등록되어 있어야 합니다

