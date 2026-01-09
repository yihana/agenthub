-- ESM 요청 테이블에 ESM 관련 필드 추가 (PostgreSQL)
-- note_id: ESM Note ID
-- esm_case_display_id: ESM Case Display ID

ALTER TABLE esm_requests 
ADD COLUMN IF NOT EXISTS esm_note_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS esm_case_display_id VARCHAR(100);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_esm_requests_note_id ON esm_requests(esm_note_id);
CREATE INDEX IF NOT EXISTS idx_esm_requests_case_display_id ON esm_requests(esm_case_display_id);

