const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ear_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function migrateUsernameToUserid() {
  const client = await pool.connect();
  
  try {
    console.log('마이그레이션 시작: username → userid');
    
    // 1. users 테이블의 username 컬럼을 userid로 변경
    console.log('1. users 테이블 컬럼명 변경 중...');
    await client.query('ALTER TABLE users RENAME COLUMN username TO userid;');
    console.log('✓ users 테이블 컬럼명 변경 완료');
    
    // 2. login_history 테이블의 username 컬럼을 userid로 변경
    console.log('2. login_history 테이블 컬럼명 변경 중...');
    await client.query('ALTER TABLE login_history RENAME COLUMN username TO userid;');
    console.log('✓ login_history 테이블 컬럼명 변경 완료');
    
    // 3. 기존 인덱스 삭제
    console.log('3. 기존 인덱스 삭제 중...');
    await client.query('DROP INDEX IF EXISTS idx_users_username;');
    await client.query('DROP INDEX IF EXISTS idx_login_history_username;');
    console.log('✓ 기존 인덱스 삭제 완료');
    
    // 4. 새로운 인덱스 생성
    console.log('4. 새로운 인덱스 생성 중...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_userid ON users(userid);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_login_history_userid ON login_history(userid);');
    console.log('✓ 새로운 인덱스 생성 완료');
    
    // 5. 변경 확인
    console.log('5. 변경 사항 확인 중...');
    const usersColumns = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('userid', 'username')
    `);
    
    const loginHistoryColumns = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'login_history' AND column_name IN ('userid', 'username')
    `);
    
    console.log('users 테이블 컬럼:', usersColumns.rows);
    console.log('login_history 테이블 컬럼:', loginHistoryColumns.rows);
    
    console.log('✅ 마이그레이션 완료!');
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateUsernameToUserid()
  .then(() => {
    console.log('마이그레이션이 성공적으로 완료되었습니다.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('마이그레이션 중 오류 발생:', error);
    process.exit(1);
  });
