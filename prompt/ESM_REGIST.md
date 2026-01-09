## 지시사항
"ESM 요청등록" 메뉴의 기능을 수정해야해 
현재까지는 사용자 요청내용을 DB에 저장했는데, 
이제부터는 DB저장은 기본이고, 
SAP ESM 시스템에 API 로 등록도 되어야해
SAP ESM 에 추가등록하는 기능 추가하돼 상세 지시사항의 내용참조하여 진행해줘


## 상세 지시사항
### ESM API 정보
ESM 등록 API : https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/case-service/cases

### API 가이드 문서
https://api.sap.com/api/SalesSvcCloudV2_case/resource/Case

### Basic 인증을 위한 정보는
환경변수에서 아래 정보 참조 
C4C_USERNAME
C4C_PASSWORD

## 기타참조 header 값
APIKey : ZhQTrUa9MULNGxozr2ksCT1RYRZbby11
content_type : application/json
accountDisplayId : 190010
caseDisplayId : 103
caseZMOD : 2000

### 상세지시사항
아래 URL 로 바로 등록해야 하는데, 
https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/case-service/cases

등록시 컨턴츠내용이 등록이 안되어, 
아래 URL 로 먼저 htmlContent 를 먼저 등록하고,
https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/note-service/notes
전달할 값 예시 참조
{
   "noteTypeCode": "S001",
   "htmlContent": "<p>[EAR 에서 전송] 테스트 전송 시간</p>"
}

응답에서 noteId 를 받아
https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/case-service/cases
에 다시 요청하는 형식으로는 개발해줘


필요시 ESM 등록관련 테이블 구조도 변경해줘
