const bcrypt = require('bcrypt');

async function generateCorrectHash() {
  const password = 'admin123';
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('새로운 해시:', hash);
    
    // bcrypt.compare로 검증
    const isValid = await bcrypt.compare(password, hash);
    console.log('검증 결과:', isValid);
    
    return hash;
  } catch (error) {
    console.error('해시 생성 오류:', error);
    throw error;
  }
}

generateCorrectHash()
  .then((hash) => {
    console.log('\n=== SQL 업데이트 쿼리 ===');
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE userid = 'admin';`);
  })
  .catch((error) => {
    console.error('오류:', error);
  });
