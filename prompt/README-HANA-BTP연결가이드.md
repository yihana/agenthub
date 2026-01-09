# SAP BTP Cloud Foundry HANA DB 연결 가이드

## 🔍 문제 진단

### 현재 상황
로그를 분석한 결과, VCAP_SERVICES에서 HANA 서비스를 찾았지만 **인증 정보(user/password 또는 certificate/key)가 누락**되어 연결에 실패하고 있습니다.

```
Credentials 구조: {
  "hasUser": false,
  "hasPassword": false,
  "hasCertificate": false,
  "hasKey": false,
  "allKeys": "driver, host, port, uaa, url"
}
```

### 오류 메시지
```
Error: Connection failed (RTE:[200117] Failed to initiate any authentication method.
X.509: No key store or PEM provided
Kerberos error. Major: "No credentials were supplied..."
```

## ✅ 해결 방법

### 1. 코드 수정 완료 ✓
다음 수정 사항이 이미 적용되었습니다:

1. ✅ `@sap/xsenv` 패키지 추가 (`server/package.json`)
2. ✅ `db-hana.ts`에서 `@sap/xsenv` 사용하도록 개선
3. ✅ 다양한 credential 구조 처리 로직 추가
4. ✅ UAA 기반 인증 감지 및 안내 메시지 추가

### 2. SAP BTP에서 서비스 바인딩 재설정 (필수)

현재 문제의 핵심은 **서비스 바인딩에 인증 정보가 없다는 것**입니다. 다음 중 하나를 선택하여 해결해야 합니다:

#### 방법 A: 서비스 키 재생성 (권장)

1. **SAP BTP Cockpit 접속**
   - Cloud Foundry Space로 이동
   - Service Instances에서 `EAR-DEV` (또는 해당 HANA 서비스 인스턴스) 클릭

2. **기존 서비스 키 삭제 (있다면)**
   ```bash
   cf delete-service-key EAR-DEV ear-app-key
   ```

3. **새 서비스 키 생성 (인증서 방식 - 권장)**
   ```bash
   cf create-service-key EAR-DEV ear-app-key -c '{"certificate": true}'
   ```
   
   또는 BTP Cockpit UI에서:
   - "Create Service Key" 클릭
   - Name: `ear-app-key`
   - Parameters (JSON):
     ```json
     {
       "certificate": true
     }
     ```

4. **서비스 키 확인**
   ```bash
   cf service-key EAR-DEV ear-app-key
   ```
   
   다음 필드가 있는지 확인:
   - ✅ `host`, `port`
   - ✅ `certificate`, `key` (인증서 방식)
   - 또는 `user`, `password` (비밀번호 방식)

#### 방법 B: User/Password 인증 방식

인증서 방식이 작동하지 않는다면 User/Password 방식으로 생성:

```bash
cf create-service-key EAR-DEV ear-app-key -c '{"password": true}'
```

#### 방법 C: 앱 재바인딩

서비스 키 대신 앱에 직접 바인딩:

1. **기존 바인딩 해제**
   ```bash
   cf unbind-service ear-app EAR-DEV
   ```

2. **재바인딩 (인증서 방식)**
   ```bash
   cf bind-service ear-app EAR-DEV -c '{"certificate": true}'
   ```

3. **앱 재시작**
   ```bash
   cf restage ear-app
   ```

### 3. 의존성 설치 및 빌드

로컬에서 테스트하거나 재배포하기 전에:

```bash
# 서버 의존성 설치
cd server
npm install

# 전체 빌드
cd ..
npm run build
```

### 4. Cloud Foundry에 재배포

```bash
# 방법 1: cf push 사용
npm run cf:push

# 방법 2: 직접 배포
npm run build
cf push

# 방법 3: 배포 스크립트 사용 (Windows)
cf-deploy.bat

# 방법 3: 배포 스크립트 사용 (Mac/Linux)
./cf-deploy.sh
```

### 5. 로그 확인

배포 후 로그를 확인하여 연결이 성공했는지 확인:

```bash
cf logs ear-app --recent
```

#### 성공적인 연결 로그 예시
```
✅ @sap/xsenv 로드 완료
🔍 @sap/xsenv를 사용하여 HANA 서비스 검색 중...
✅ hana 서비스 찾음
📋 Credentials 구조: {"hasHost":true,"hasPort":true,"hasUser":true,"hasPassword":true,...}
🔑 User/Password 방식 사용
🔌 HANA DB 연결 시도: xxx.hana.prod-ap12.hanacloud.ondemand.com:443
✅ HANA DB 연결 성공!
```

또는 인증서 방식:
```
🔐 X.509 인증서 방식 사용
✅ HANA DB 연결 성공!
```

## 📋 체크리스트

배포 전에 확인해야 할 사항:

- [ ] `manifest.yml`에 서비스 바인딩이 있는가? (`services: - EAR-DEV`)
- [ ] SAP BTP에서 서비스 키를 인증 정보와 함께 생성했는가?
- [ ] 서비스 키에 `certificate`+`key` 또는 `user`+`password`가 포함되어 있는가?
- [ ] `server/package.json`에 `@sap/xsenv`가 설치되어 있는가?
- [ ] 빌드가 성공적으로 완료되었는가? (`npm run build`)
- [ ] 배포 후 로그에서 "HANA DB 연결 성공!" 메시지가 보이는가?

## 🔧 트러블슈팅

### 여전히 "No key store or PEM provided" 오류가 발생하는 경우

1. **VCAP_SERVICES 확인**
   ```bash
   cf env ear-app
   ```
   
   `VCAP_SERVICES` 환경 변수에 HANA 서비스 credential이 올바르게 바인딩되어 있는지 확인

2. **서비스 인스턴스 상태 확인**
   ```bash
   cf services
   ```
   
   `EAR-DEV` 서비스가 `create succeeded` 상태인지 확인

3. **HANA Cloud 인스턴스 실행 상태 확인**
   - SAP BTP Cockpit → SAP HANA Cloud
   - HANA 인스턴스가 **RUNNING** 상태인지 확인
   - 중지된 경우 시작

4. **서비스 키 다시 확인**
   ```bash
   cf service-key EAR-DEV ear-app-key
   ```
   
   출력에 다음이 포함되어 있어야 함:
   ```json
   {
     "host": "xxx.hana.prod-ap12.hanacloud.ondemand.com",
     "port": "443",
     "certificate": "-----BEGIN CERTIFICATE-----\n...",
     "key": "-----BEGIN PRIVATE KEY-----\n...",
     "schema": "..."
   }
   ```
   또는
   ```json
   {
     "host": "xxx.hana.prod-ap12.hanacloud.ondemand.com",
     "port": "443",
     "user": "...",
     "password": "...",
     "schema": "..."
   }
   ```

### UAA 기반 인증만 있는 경우

로그에 다음과 같은 메시지가 보이는 경우:
```
🎫 UAA JWT 토큰 방식 사용 (아직 미구현 - 서비스 키 재생성 필요)
⚠️  현재 credential에 user/password 또는 certificate가 없습니다.
```

**해결 방법**: 서비스 키를 재생성하여 명시적으로 인증서 또는 비밀번호를 요청해야 합니다.

```bash
# 기존 키 삭제
cf delete-service-key EAR-DEV ear-app-key

# 인증서 방식으로 재생성
cf create-service-key EAR-DEV ear-app-key -c '{"certificate": true}'

# 또는 비밀번호 방식으로 재생성
cf create-service-key EAR-DEV ear-app-key -c '{"password": true}'
```

## 🌐 로컬 개발 환경 설정

로컬에서 개발하려면 `.env` 파일에 다음을 설정:

```env
DB_TYPE=hana
HANA_HOST=your-instance-id.hana.prod-ap12.hanacloud.ondemand.com
HANA_PORT=443
HANA_USER=your-username
HANA_PASSWORD=your-password
HANA_SCHEMA=EAR
HANA_ENCRYPT=true
HANA_SSL_VALIDATE_CERTIFICATE=false
```

또는 `default-env.json` 파일 생성:

```json
{
  "VCAP_SERVICES": {
    "hana": [
      {
        "credentials": {
          "host": "your-instance-id.hana.prod-ap12.hanacloud.ondemand.com",
          "port": "443",
          "user": "your-username",
          "password": "your-password",
          "schema": "EAR"
        }
      }
    ]
  }
}
```

## 📚 참고 자료

- [SAP HANA Client Node.js Documentation](https://help.sap.com/docs/SAP_HANA_CLIENT/f1b440ded6144a54ada97ff95dac7adf/f3b8fabf84324d9293fcf87e6c8fbba5.html)
- [SAP BTP Service Bindings](https://help.sap.com/docs/btp/sap-business-technology-platform/binding-service-instances-to-applications)
- [@sap/xsenv Documentation](https://www.npmjs.com/package/@sap/xsenv)

## 💡 핵심 요약

1. **문제**: 서비스 바인딩에 인증 정보가 없음
2. **원인**: 서비스 키 생성 시 인증 방식이 명시되지 않음
3. **해결**: `cf create-service-key ... -c '{"certificate": true}'` 또는 `'{"password": true}'`로 재생성
4. **확인**: 로그에서 "✅ HANA DB 연결 성공!" 메시지 확인

