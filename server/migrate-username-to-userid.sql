-- username 컬럼을 userid로 변경하는 마이그레이션 스크립트

-- 1. users 테이블의 username 컬럼을 userid로 변경
ALTER TABLE users RENAME COLUMN username TO userid;

-- 2. login_history 테이블의 username 컬럼을 userid로 변경
ALTER TABLE login_history RENAME COLUMN username TO userid;

-- 3. 기존 인덱스 삭제
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_login_history_username;

-- 4. 새로운 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_userid ON users(userid);
CREATE INDEX IF NOT EXISTS idx_login_history_userid ON login_history(userid);

-- 5. 변경 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('userid', 'username');

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'login_history' AND column_name IN ('userid', 'username');
