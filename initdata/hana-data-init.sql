INSERT INTO prompt_management (
  prompt_type, 
  company_code, 
  reference_content, 
  prompt, 
  is_active, 
  created_by, 
  created_at, 
  updated_at
) VALUES (
  'ESM_REQUEST',
  'SKN',
  '# CaseType

| 코드   | Desc.       |
|:-------|:------------|
| Z020   | 문의/요청 |
| Z030   | 시스템 개선 |

# ZMOD

|   코드 | Desc.      | 의미                    | 사용여부
|-------:|:-----------|:------------------------|:------------------------|
|   1000 | CSS(BI/CI) | 청구/수금 관리          | 미사용
|   1100 | CSS(FI-CA) | 계약/수납 관리          | 미사용
|   2000 | CO         | 관리 회계               | 사용
|   3000 | FI         | 재무 회계               | 사용
|   4000 | HR         | 인사 관리               | 사용
|   5000 | PP         | 생산 관리               | 미사용
|   6000 | SD         | 영업/판매 관리          | 사용
|   7000 | TD/MM      | 구매/자재 관리          | 사용
|   8000 | BC         | 시스템 관리             | 사용
|   9000 | BW         | 데이터 분석/리포팅 관리 | 미사용

# ZSUBCASE

| CaseType   | Unnamed: 1   | ZSUBCASE   | Unnamed: 3              |
|:-----------|:-------------|:-----------|:------------------------|
| 코드       | Desc.        | 코드       | Desc.                   |
| Z020       | 문의/요청    | 200010     | 단순 문의               |
| Z020       | 문의/요청    | 200020     | ERP 사용자 ID/권한 문의 |
| Z020       | 문의/요청    | 200030     | 사전 프로세스/기술 검토 |
| Z020       | 문의/요청    | 200040     | Data 확인 및 분석       |
| Z020       | 문의/요청    | 200050     | Data 추출               |
| Z020       | 문의/요청    | 200060     | 사용자 교육             |
| Z020       | 문의/요청    | 200070     | 기초조사 수행/지원      |
| Z020       | 문의/요청    | 200080     | 프로젝트 수행/지원      |
| Z020       | 문의/요청    | 200090     | IMG Configuration       |
| Z020       | 문의/요청    | 200100     | Data 관리               |
| Z030       | 시스템 개선  | 300010     | 시스템 개선 및 개발     ',
  '다음은 ESM Case 분류 코드 정보입니다:

{reference_content}

사용자가 입력한 요청 제목과 내용을 분석하여 가장 적절한 코드값을 찾아주세요.

제목: {title}
내용: {content}

다음 형식으로만 응답해주세요 (JSON 형식):
{
  "caseType": "Z020 또는 Z030",
  "ZMOD": "1000~9000 중 하나",
  "ZSUBCASE": "200010~300010 중 하나"
}

주의사항:
- caseType은 Z020(시스템 개선) 또는 Z030(문의/요청) 중 하나여야 합니다.
- ZMOD는 1000~9000 사이의 코드값이어야 합니다.
- ZSUBCASE는 200010~300010 사이의 코드값이어야 합니다.
- caseType이 Z020이면 ZSUBCASE는 200010~200100 중 하나여야 합니다.
- caseType이 Z030이면 ZSUBCASE는 300010이어야 합니다.
- 확실하지 않으면 기본값을 사용하세요: caseType="Z020", ZMOD="3000", ZSUBCASE="200010"
- JSON 형식만 응답하고 다른 설명은 하지 마세요.',
  true,
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);


