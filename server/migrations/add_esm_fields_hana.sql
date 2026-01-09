-- ESM 요청 테이블에 ESM 관련 필드 추가 (HANA)
-- note_id: ESM Note ID
-- esm_case_display_id: ESM Case Display ID

ALTER TABLE EAR.ESM_REQUESTS 
ADD (ESM_NOTE_ID NVARCHAR(100), ESM_CASE_DISPLAY_ID NVARCHAR(100));

-- 인덱스 추가
CREATE INDEX idx_esm_requests_note_id ON EAR.ESM_REQUESTS(ESM_NOTE_ID);
CREATE INDEX idx_esm_requests_case_display_id ON EAR.ESM_REQUESTS(ESM_CASE_DISPLAY_ID);

