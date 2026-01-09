# Chat module update
## SKN RAG System Integration

로그인 직후 표시되는 메인화면의 채팅창 영역에서 
채팅 입력하는 텍스트 박스 왼쪽에 선택가능한 콤보박스를 추가해야해

콤보박스에 포함되어야할 항목은 아래 4개야 
- SKAX Chat Modul
- SK Networks RAG Module 
- SKAX First SKN Second
- SKN First SKAX Second

콤보박스 항목 설명
- SKAX Chat Modul : Default 선택된 항목으로 기존에 존재하는 OpenAI 로 LLM 질문을 하는 기능이 그대로 작동되면 됨
- SK Networks RAG Module : 이 부분은 SK Networks RAG Test 결과 참조하여 http 요청으로 기능 구현필요
- SKAX First SKN Second : 기능 정의중으로, 선택하면 "기능 구현중" 이라고 alert 띄우면 됨
- SKN First SKAX Second : 기능 정의중으로, 선택하면 "기능 구현중" 이라고 alert 띄우면 됨

## SK Networks RAG Test 결과
curl -v -X POST "https://adxp.adotbiz.ai/api/v1/agent_gateway/e032af7b-880a-469a-a1ba-b64b7bbf1b90/invoke" \
  --resolve adxp.adotbiz.ai:443:10.220.4.141 \
  -H "Content-Type: application/json" \
  -H "aip-user: wisdomguy" \
  -H "Authorization: Bearer ABCDEFG" \
  -d '{
        "input": {
            "messages": [
                {
                    "content": "사용자가 채팅창에 입력한 내용으로 치완필요",
                    "type": "human"
                }
            ],
            "additional_kwargs": {
                "<input-key>": "<input-value>"
            }
        }
      }'

## SK Networks RAG 호출 프로그램 작성시 주의사항
https://adxp.adotbiz.ai/api/v1/agent_gateway/e032af7b-880a-469a-a1ba-b64b7bbf1b90/invoke 은 환경변수명 SKN_RAG_URL 값을 읽어서 세팅
sk-a3bd20e3a717d966e494750f4f45d0a9 에 해당하는 토큰값은 환경변수명 SKN_RAG_TOKEN 값을 읽어서 처리
사용자가 입력한 채팅 내용을 "content" 키의 값으로 치완필요
"additional_kwargs" 키는 치완하지 않고 {
                "<input-key>": "<input-value>"
            }
그대로 사용
--resolve adxp.adotbiz.ai:443:10.220.4.141
dns 설정이 안되어 있기 때문에 node 에서 해당 아이피로 요청이 가도록 처리가 되어야하고, 
인증서 검증관련 에러가 나면 무시하도록 처리가 되어도 됨

구현해줘


## 환경설정방법
cf set-env ear-dev SKN_RAG_URL "https://adxp.adotbiz.ai/api/v1/agent_gateway/e032af7b-880a-469a-a1ba-b64b7bbf1b90/invoke"
cf set-env ear-dev SKN_RAG_TOKEN "ABCDEFG" 




# 기능 업그레이드 : 2026-01-04

## Chat 기능 업데이트
### 기능 수정 배경 
로그인 직후 표시되는 메인화면의 채팅창 영역에서 콤보박스에서 "SK Networks RAG Module" 일 때
SKN_RAG_URL 과 SKN_RAG_TOKEN 환경변수를 참조하여 작동되는데
이 URL 과 TOKEN 값이 자주 변경되어 변경될때 마다 적용 및 Application restart 가 필요해서 번거로움
이 값이 DB Table 로 관리되도록 수정 필요

### 지시사항
시스템 관리자 메뉴 하위에 "RAG Agent 관리" 메뉴를 추가하고 
관리항목으로는 "회사구분코드", "Agent Description", "Agent URL", "Agent Token", "사용여부", "등록자", "수정자", "등록일시", "수정일시"
항목에 대해 입력,조회,수정,삭제 기능을 추가해줘
그리고 "SK Networks RAG Module" 선택시 회사코드 "SKN" 인 항목중 사용여부 Y 인 값을 참조하여 작동하도록 수정해줘

### 제약조건
Table 명 : RAG_AGENTS_INFO
동일한 회사구분코드에 해당하는 행이 다수 있을 때 사용여부 "Y" 은 행은 한행만 있어야 하고 
최소한 하나의 행은 "Y" 가 있도록 제약조건을 걸어야하고
삭제시 마지막 남은 "Y" 인 row는 삭제가 안되도록 작동되어야해










