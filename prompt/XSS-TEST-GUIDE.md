# Stored-XSS 취약점 보완 및 테스트 가이드

## 개요

모의해킹 점검에서 발견된 Stored-XSS(저장형 XSS) 취약점을 보완했습니다. 모든 Editor 형식의 입력 필드에 대해 입력 검증 및 출력 sanitization을 적용했습니다.

## 보완 내용

### 1. 서버 측 보완 (Backend)

#### 적용된 엔드포인트
- `/api/improvement/system-requests` (POST) - 시스템 개선요청 생성
  - `title` 필드: 텍스트 sanitization
  - `content` 필드: HTML sanitization (이미지 허용)
  
- `/api/improvement/requests` (POST) - 개선요청 생성
  - `selectedText`, `category`, `description` 필드: 텍스트 sanitization

- `/api/improvement/requests/:id/responses` (POST) - 관리자 응답 추가
  - `responseText` 필드: 텍스트 sanitization

- `/api/improvement/system-requests/:id/responses` (POST) - 시스템 개선요청 응답 추가
  - `responseText` 필드: 텍스트 sanitization

#### 사용된 라이브러리
- `isomorphic-dompurify`: 서버 측 HTML sanitization
- `dompurify`: 클라이언트 측 HTML sanitization

#### 구현 위치
- `server/utils/htmlSanitizer.ts`: HTML 및 텍스트 sanitization 유틸리티
- `server/routes/improvement.ts`: 각 엔드포인트에 sanitization 적용

### 2. 프론트엔드 측 보완 (Frontend)

#### 적용된 컴포넌트
- `SystemImprovementList.tsx`: 시스템 개선요청 목록/상세 화면
- `SystemImprovementAdmin.tsx`: 관리자용 시스템 개선요청 관리 화면

#### 구현 내용
- ReactQuill readOnly 모드에서 출력하는 HTML 콘텐츠 sanitization
- 제목 및 응답 텍스트에서 위험한 문자 제거

#### 구현 위치
- `web/src/utils/htmlSanitizer.ts`: 클라이언트 측 HTML sanitization 유틸리티

## 테스트 방법

### 1. 시스템 개선요청 생성 테스트

#### 테스트 케이스 1: HTML 태그 주입 시도
1. 시스템 개선요청 작성 페이지 접속
2. 제목 필드에 다음 입력:
   ```
   <script>alert('XSS')</script>테스트 제목
   ```
3. 내용 필드에 다음 입력:
   ```
   <p>정상 내용</p><script>alert('XSS')</script><img src=x onerror=alert('XSS')>
   ```
4. 제출 버튼 클릭
5. **예상 결과**: 
   - 제목: `<script>` 태그가 제거되고 텍스트만 저장됨
   - 내용: `<script>` 태그와 `onerror` 속성이 제거되고, 안전한 HTML만 저장됨

#### 테스트 케이스 2: JavaScript 프로토콜 주입 시도
1. 내용 필드에 다음 입력:
   ```
   <a href="javascript:alert('XSS')">클릭하세요</a>
   ```
2. 제출 후 상세 화면 확인
3. **예상 결과**: 링크가 제거되거나 안전하지 않은 프로토콜이 차단됨

#### 테스트 케이스 3: 이벤트 핸들러 주입 시도
1. 내용 필드에 다음 입력:
   ```
   <div onclick="alert('XSS')">클릭</div>
   <img src="test.jpg" onerror="alert('XSS')">
   ```
2. 제출 후 상세 화면 확인
3. **예상 결과**: `onclick`, `onerror` 등 이벤트 핸들러가 모두 제거됨

#### 테스트 케이스 4: iframe, embed 등 위험한 태그 주입
1. 내용 필드에 다음 입력:
   ```
   <iframe src="http://malicious.com"></iframe>
   <embed src="malicious.swf">
   ```
2. 제출 후 확인
3. **예상 결과**: `iframe`, `embed` 태그가 모두 제거됨

### 2. 출력 화면 테스트

#### 테스트 케이스 5: 저장된 XSS 공격 확인
1. 위의 테스트 케이스로 악성 코드를 포함한 요청 생성
2. 목록 화면에서 해당 요청 확인
3. 상세 화면에서 해당 요청 확인
4. **예상 결과**: 
   - JavaScript 실행되지 않음
   - alert 창이 나타나지 않음
   - 개발자 도구 콘솔에 오류 없음

### 3. 관리자 응답 테스트

#### 테스트 케이스 6: 관리자 응답에 XSS 시도
1. 관리자 화면에서 시스템 개선요청 상세 열기
2. 응답 입력란에 다음 입력:
   ```
   <script>alert('XSS')</script>정상 응답
   ```
3. 응답 제출
4. **예상 결과**: `<script>` 태그가 제거되고 텍스트만 저장됨

### 4. 브라우저 개발자 도구를 이용한 테스트

#### 테스트 케이스 7: 실제 XSS 공격 확인
1. 브라우저 개발자 도구(F12) 열기
2. Console 탭 확인
3. 위의 테스트 케이스들을 실행
4. **예상 결과**: 
   - JavaScript 실행되지 않음
   - Console에 오류 메시지 없음

#### 테스트 케이스 8: 네트워크 요청 확인
1. 개발자 도구의 Network 탭 열기
2. 시스템 개선요청 제출
3. POST 요청 확인
4. **예상 결과**: 요청 본문에 sanitize된 데이터가 포함됨

## 수동 테스트 스크립트

### cURL을 이용한 테스트

```bash
# 1. 로그인하여 토큰 획득 (실제 토큰으로 대체 필요)
TOKEN="your_jwt_token_here"

# 2. 시스템 개선요청 생성 (XSS 시도)
curl -X POST http://localhost:3000/api/improvement/system-requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "<script>alert(\"XSS\")</script>테스트",
    "content": "<p>정상</p><script>alert(\"XSS\")</script>"
  }'

# 3. 응답 확인 (스크립트 태그가 제거되었는지 확인)
```

### JavaScript 콘솔 테스트

브라우저 개발자 도구 Console에서 실행:

```javascript
// 1. 악성 코드가 포함된 요청 생성
fetch('/api/improvement/system-requests', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: '<script>alert("XSS")</script>테스트',
    content: '<p>정상</p><script>alert("XSS")</script>'
  })
})
.then(res => res.json())
.then(data => {
  console.log('저장된 데이터:', data);
  // title과 content에서 <script> 태그가 제거되었는지 확인
});
```

## 허용되는 태그 및 속성

### HTML 콘텐츠 (content 필드)
**허용 태그**: `p`, `br`, `strong`, `em`, `u`, `s`, `strike`, `h1`, `h2`, `h3`, `ul`, `ol`, `li`, `a`, `span`, `div`, `blockquote`, `img` (이미지만)

**허용 속성**: `href`, `target`, `rel`, `class`, `src`, `alt`, `width`, `height` (이미지용)

**차단 태그**: `script`, `iframe`, `object`, `embed`, `form`, `input`, `button`, `textarea`

**차단 속성**: `onerror`, `onload`, `onclick`, `onmouseover` 등 모든 이벤트 핸들러

### 텍스트 필드 (title, description, responseText)
- 모든 HTML 태그 제거
- `<`, `>` 문자 제거

## 보완 확인 체크리스트

- [x] 서버 측 입력 sanitization 구현
- [x] 프론트엔드 출력 sanitization 구현
- [x] 시스템 개선요청 생성 엔드포인트 보완
- [x] 개선요청 생성 엔드포인트 보완
- [x] 관리자 응답 엔드포인트 보완
- [x] 목록 화면 출력 보완
- [x] 상세 화면 출력 보완
- [ ] 실제 테스트 수행
- [ ] 모의해킹 재점검

## 추가 보안 권장사항

1. **Content Security Policy (CSP) 헤더 추가**
   - `Content-Security-Policy: default-src 'self'; script-src 'self'` 등 설정

2. **입력 길이 제한**
   - 이미 구현되어 있지만 추가 검증 권장

3. **정기적인 보안 점검**
   - 새로운 XSS 공격 기법 모니터링
   - DOMPurify 라이브러리 업데이트 확인

4. **로그 모니터링**
   - sanitization 과정에서 차단된 악성 코드 로깅

## 참고 자료

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)

