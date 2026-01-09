# Custom Domain 로그인 에러 해결 가이드

## 현재 상황 분석

로그를 확인한 결과:
- ✅ `baseUrl: 'https://ear-dev.sk.com'` - 올바르게 생성됨
- ✅ `callbackUri: 'https://ear-dev.sk.com/api/auth/callback'` - 올바르게 생성됨
- ✅ 코드는 정상적으로 작동 중

## 문제 원인

에러가 발생하는 이유는 **XSUAA 서비스 인스턴스에 Custom Domain의 redirect URI가 등록되지 않았기 때문**입니다.

에러 URL을 보면:
```
https://ear-dev-sf98y10l.authentication.ap12.hana.ondemand.com/oauth/authorize?
  client_id=sb-ear-xsuaa!t24882&
  response_type=code&
  redirect_uri=https%3A%2F%2Fear-dev.sk.com%2Fapi%2Fauth%2Fcallback&  ← 이 URI가 등록되지 않음
  scope=openid%20scim.read&
  idp=sap.custom&
  state=%2F
```

이 `redirect_uri` (`https://ear-dev.sk.com/api/auth/callback`)가 XSUAA 서비스 인스턴스의 `redirect-uris` 목록에 없어서 "Authorization Request Error"가 발생합니다.

## 해결 방법

### 1단계: XSUAA 서비스 인스턴스 확인

어떤 XSUAA 서비스 인스턴스를 사용하고 있는지 확인:

```bash
cf services
```

일반적으로 다음 중 하나일 것입니다:
- `ear-dev-xsuaa`
- `ear-xsuaa`
- 또는 다른 이름

### 2단계: 현재 XSUAA 설정 확인

BTP Cockpit에서 확인:

1. **SAP BTP Cockpit** 접속
2. 해당 **Subaccount** 선택
3. **Cloud Foundry** → **Spaces** → 해당 **Space** 선택
4. **Services** → **Instances and Subscriptions** 이동
5. XSUAA 인스턴스 선택
6. 현재 설정 확인:
   - **Parameters** 또는 **Configuration** 탭에서 `redirect-uris` 확인
   - `https://ear-dev.sk.com/api/auth/callback`가 있는지 확인

### 3단계: XSUAA 서비스 인스턴스 업데이트

#### 방법 A: BTP Cockpit 사용 (권장)

1. XSUAA 서비스 인스턴스 선택
2. **Update** 버튼 클릭
3. 현재 `xs-security.json` 파일의 전체 내용을 복사:

```json
{
  "xsappname": "ear-xsuaa",
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
  "attributes": [
    {
      "name": "employee_number", 
      "description": "employee number from IAS",
      "valueType": "string"
    }
  ],
  "role-templates": [
    {
      "name": "EAR-ADMIN",
      "description": "EAR Administrator Role",
      "scope-references": [
        "$XSAPPNAME.Administrator"
      ],
      "attribute-references": [
        "employee_number" 
      ]
    },
    {
      "name": "EAR-USER",
      "description": "EAR User Role",
      "scope-references": [
        "$XSAPPNAME.User"
      ],
      "attribute-references": [
        "employee_number" 
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
      "https://ear-dev.sk.com/api/auth/callback",
      "https://ear-dev.sk.com/**",
      "https://ear-dev.cfapps.ap12.hana.ondemand.com/api/auth/callback",
      "https://ear-dev.cfapps.ap12.hana.ondemand.com/**"
    ]
  }
}
```

4. 전체 내용을 JSON 필드에 붙여넣기
5. **Save** 클릭
6. 업데이트 완료 대기 (1-2분)

#### 방법 B: CF CLI 사용

```bash
# XSUAA 서비스 인스턴스 업데이트
cf update-service <서비스-인스턴스-이름> -c xs-security.json

# 예시:
cf update-service ear-dev-xsuaa -c xs-security.json
```

**참고**: CF CLI 명령이 작동하지 않을 수 있습니다. 이 경우 BTP Cockpit을 사용하세요.

### 4단계: 애플리케이션 재시작

XSUAA 서비스 인스턴스 업데이트 후 애플리케이션 재시작:

```bash
cf restart ear-dev
```

### 5단계: 확인 및 테스트

1. **XSUAA 설정 확인**:
   - BTP Cockpit에서 XSUAA 서비스 인스턴스 설정 확인
   - `redirect-uris`에 Custom Domain이 포함되어 있는지 확인

2. **로그인 테스트**:
   - `https://ear-dev.sk.com` 접속
   - 로그인 버튼 클릭
   - 정상적으로 로그인되는지 확인

## 추가 확인 사항

### xsappname 확인

로그를 보면:
```
xsappname: 'ear-xsuaa!t24882'
```

`xs-security.json` 파일의 `xsappname`이 실제 서비스 인스턴스와 일치하는지 확인해야 합니다.

만약 실제 서비스 인스턴스의 `xsappname`이 다르다면, `xs-security.json`도 그에 맞게 수정해야 합니다.

### IAS 애플리케이션 설정 확인

IAS를 직접 사용하는 경우, IAS 애플리케이션 설정에도 Custom Domain을 추가해야 할 수 있습니다:

1. **IAS Cockpit** 접속
2. 해당 애플리케이션 선택
3. **Configuration** 탭 클릭
4. **Allowed Redirect URIs** 확인:
   ```
   https://ear-dev.sk.com/api/auth/callback
   https://ear-dev.sk.com/**
   ```
5. 없으면 추가 후 **Save**

## 디버깅 팁

### 1. 실제 사용된 redirect URI 확인

에러가 발생했을 때 브라우저 주소창의 URL을 확인:
- `redirect_uri` 파라미터의 값을 확인
- 이것이 `xs-security.json`의 `redirect-uris`와 정확히 일치하는지 확인

### 2. XSUAA 서비스 키 확인

```bash
cf service-key <서비스-인스턴스-이름> <키-이름>
```

서비스 키에서 `redirect-uris` 설정이 올바르게 반영되었는지 확인할 수 없지만, clientid는 확인 가능합니다.

### 3. 로그 확인

애플리케이션 로그에서 생성된 redirect URI 확인:

```bash
cf logs ear-dev --recent | grep callbackUri
```

## 참고

- XSUAA 서비스 인스턴스 업데이트 후 변경사항이 적용되는 데 몇 분이 걸릴 수 있습니다
- 애플리케이션을 재시작해야 새로운 설정이 반영될 수 있습니다
- `xs-security.json` 파일을 수정했더라도, XSUAA 서비스 인스턴스를 업데이트하지 않으면 변경사항이 적용되지 않습니다








