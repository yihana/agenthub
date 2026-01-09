# Custom Domain 설정 확인 체크리스트

## 현재 상황

로그 분석 결과 코드는 정상적으로 작동하고 있습니다:
- ✅ `baseUrl: 'https://ear-dev.sk.com'` - 올바르게 생성됨
- ✅ `callbackUri: 'https://ear-dev.sk.com/api/auth/callback'` - 올바르게 생성됨

그러나 여전히 "Authorization Request Error"가 발생한다면, **XSUAA 서비스 인스턴스 설정**에 문제가 있을 가능성이 높습니다.

## 확인 사항 체크리스트

### ✅ 1. 코드 확인 (완료됨)

- [x] `xs-security.json`에 Custom Domain redirect URI 추가됨
- [x] Host 헤더 처리 로직 개선됨
- [x] 애플리케이션 재배포됨

### ⚠️ 2. XSUAA 서비스 인스턴스 업데이트 확인 (필수)

#### 2.1 XSUAA 서비스 인스턴스 이름 확인

```bash
cf services
```

어떤 XSUAA 서비스 인스턴스를 사용하고 있는지 확인하세요. 예:
- `ear-dev-xsuaa`
- `ear-xsuaa`
- 또는 다른 이름

#### 2.2 BTP Cockpit에서 설정 확인

1. **SAP BTP Cockpit** 접속
2. 해당 **Subaccount** 선택
3. **Cloud Foundry** → **Spaces** → 해당 **Space** 선택
4. **Services** → **Instances and Subscriptions** 이동
5. XSUAA 인스턴스 선택
6. **Parameters** 또는 **Configuration** 탭 클릭
7. **확인 사항**:
   - [ ] `redirect-uris` 배열에 `https://ear-dev.sk.com/api/auth/callback`가 포함되어 있는가?
   - [ ] `redirect-uris` 배열에 `https://ear-dev.sk.com/**`가 포함되어 있는가?
   - [ ] 최근에 업데이트를 했는가? (업데이트 후 몇 분이 걸릴 수 있음)

#### 2.3 XSUAA 서비스 인스턴스 업데이트 (필요한 경우)

만약 Custom Domain이 등록되지 않았다면:

1. XSUAA 인스턴스 선택
2. **Update** 버튼 클릭
3. 프로젝트의 `xs-security.json` 파일 전체 내용 복사
4. JSON 필드에 붙여넣기
5. **Save** 클릭
6. 업데이트 완료 대기 (1-2분)

### ⚠️ 3. 애플리케이션 재시작 확인

XSUAA 서비스 인스턴스를 업데이트한 후:

```bash
cf restart ear-dev
```

- [ ] 애플리케이션이 재시작되었는가?

### ⚠️ 4. xsappname 확인

로그에서:
```
xsappname: 'ear-xsuaa!t24882'
```

`xs-security.json`의 `xsappname`이 실제 서비스 인스턴스와 일치하는지 확인:

- [ ] `xs-security.json`의 `xsappname` 확인
- [ ] 실제 XSUAA 서비스 인스턴스의 xsappname과 일치하는가?

**중요**: 만약 `xsappname`이 다르다면, `xs-security.json`을 실제 서비스 인스턴스에 맞게 수정해야 합니다.

### ⚠️ 5. 실제 생성된 redirect URI 확인

에러가 발생했을 때 브라우저 주소창의 URL을 확인:

1. 에러 페이지에서 브라우저 주소창 확인
2. URL의 `redirect_uri` 파라미터 확인
3. 예: `redirect_uri=https%3A%2F%2Fear-dev.sk.com%2Fapi%2Fauth%2Fcallback`
4. 디코딩하면: `https://ear-dev.sk.com/api/auth/callback`
5. 이 URI가 XSUAA 서비스 인스턴스의 `redirect-uris`에 정확히 일치하는지 확인

**확인 사항**:
- [ ] URL 끝에 슬래시(`/`)가 없는가? (`/api/auth/callback`이 맞음, `/api/auth/callback/`는 틀림)
- [ ] 프로토콜이 `https`인가?
- [ ] 도메인이 정확한가? (`ear-dev.sk.com`)

### ⚠️ 6. IAS 애플리케이션 설정 확인 (필요한 경우)

IAS를 직접 사용하는 경우:

1. **IAS Cockpit** 접속
   - BTP Cockpit → **Services** → **Identity Authentication** → **Go to Application**
2. 해당 애플리케이션 선택
3. **Configuration** 탭 클릭
4. **Allowed Redirect URIs** 확인:
   - [ ] `https://ear-dev.sk.com/api/auth/callback` 포함되어 있는가?
   - [ ] `https://ear-dev.sk.com/**` 포함되어 있는가?

### ⚠️ 7. 시간 경과 확인

XSUAA 서비스 인스턴스를 업데이트한 후:

- [ ] 최소 2-3분 대기했는가? (변경사항 반영에 시간이 걸릴 수 있음)
- [ ] 애플리케이션을 재시작했는가?

## 문제 해결 단계

### Step 1: 현재 설정 확인

```bash
# XSUAA 서비스 인스턴스 목록 확인
cf services

# 애플리케이션 환경 변수 확인
cf env ear-dev | grep VCAP_SERVICES
```

### Step 2: XSUAA 서비스 인스턴스 업데이트

BTP Cockpit에서:
1. XSUAA 서비스 인스턴스 선택
2. **Update** 클릭
3. 현재 `xs-security.json` 파일의 **전체 내용** 복사 후 붙여넣기
4. **Save** 클릭

### Step 3: 애플리케이션 재시작

```bash
cf restart ear-dev
```

### Step 4: 대기 및 테스트

1. 2-3분 대기
2. `https://ear-dev.sk.com` 접속
3. 로그인 시도
4. 정상 작동 여부 확인

## 디버깅 정보 수집

에러가 계속 발생하면 다음 정보를 수집하세요:

### 1. 브라우저 주소창의 에러 URL

에러 발생 시 브라우저 주소창의 전체 URL을 복사하세요. 예:
```
https://ear-dev-sf98y10l.authentication.ap12.hana.ondemand.com/oauth/authorize?client_id=...&redirect_uri=...
```

### 2. 애플리케이션 로그

```bash
cf logs ear-dev --recent | grep -E "(callbackUri|baseUrl|redirect_uri|error)"
```

### 3. XSUAA 설정 확인

```bash
curl https://ear-dev.sk.com/api/auth/config
```

응답에서 `loginUrl`과 `callbackUrl`을 확인하세요.

## 가장 흔한 문제

1. **XSUAA 서비스 인스턴스가 업데이트되지 않음**
   - `xs-security.json` 파일만 수정하고 서비스 인스턴스를 업데이트하지 않은 경우

2. **업데이트 후 애플리케이션 재시작 안 함**
   - XSUAA 서비스 인스턴스를 업데이트했지만 애플리케이션을 재시작하지 않은 경우

3. **xsappname 불일치**
   - `xs-security.json`의 `xsappname`이 실제 서비스 인스턴스와 다른 경우

4. **시간 경과 부족**
   - XSUAA 서비스 인스턴스 업데이트 후 즉시 테스트하여 변경사항이 아직 반영되지 않은 경우

## 다음 단계

위 체크리스트를 모두 확인했는데도 문제가 해결되지 않으면:

1. 에러가 발생한 정확한 URL을 공유해주세요
2. XSUAA 서비스 인스턴스의 현재 설정을 확인해주세요
3. 추가 로그 정보를 수집해주세요








