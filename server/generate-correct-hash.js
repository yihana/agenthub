const bcrypt = require('bcrypt');

async function generateCorrectHash() {
  const password = 'admin123';
  const saltRounds = 10;
  
  try {
    console.log('비밀번호 "admin123"에 대한 해시 생성 중...');
    const hash = await bcrypt.hash(password, saltRounds);
    
    console.log('생성된 해시:', hash);
    
    // 검증
    const isValid = await bcrypt.compare(password, hash);
    console.log('검증 결과:', isValid);
    
    if (isValid) {
      console.log('\n=== SQL 업데이트 쿼리 ===');
      console.log(`UPDATE users SET password_hash = '${hash}' WHERE userid = 'admin';`);
    }
    
    return hash;
  } catch (error) {
    console.error('해시 생성 오류:', error);
    throw error;
  }
}

generateCorrectHash()
  .then(() => {
    console.log('\n해시 생성 완료!');
  })
  .catch((error) => {
    console.error('오류:', error);
  });
