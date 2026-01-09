// 한 번만 실행하는 HANA DB 리셋 스크립트
// 사용법: npx tsx reset-hana-once.ts

import dotenv from 'dotenv';
dotenv.config();

process.env.DB_TYPE = 'hana';

const { resetDatabase } = require('./db-hana');

async function main() {
  console.log('⚠️  HANA DB 테이블을 모두 삭제하고 재생성합니다.');
  console.log('⚠️  모든 데이터가 삭제됩니다!');
  console.log('');
  console.log('3초 후 시작...');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await resetDatabase();
  
  console.log('');
  console.log('✅ 완료! 이제 이 스크립트를 삭제해도 됩니다.');
  process.exit(0);
}

main().catch(error => {
  console.error('오류:', error);
  process.exit(1);
});

