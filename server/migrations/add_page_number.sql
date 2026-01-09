-- 페이지 번호 컬럼 추가 마이그레이션 스크립트
-- PostgreSQL용

-- 기존 테이블에 페이지 번호 컬럼 추가
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS page_number INTEGER;

-- 인덱스 추가 (선택사항)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_page_number ON rag_chunks(page_number);

-- HANA DB용 (별도 실행 필요)
-- ALTER TABLE EAR.RAG_CHUNKS ADD (PAGE_NUMBER INTEGER);
