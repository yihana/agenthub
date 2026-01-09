const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 테스트 API 서버들을 시작합니다...\n');

// API 서버 1 시작 (Company 1 - Bearer Token)
const api1 = spawn('node', ['employees-api-1.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// API 서버 2 시작 (Company 2 - Basic Auth)
const api2 = spawn('node', ['employees-api-2.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// 프로세스 종료 시 모든 서버 종료
process.on('SIGINT', () => {
  console.log('\n🛑 테스트 API 서버들을 종료합니다...');
  api1.kill('SIGINT');
  api2.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 테스트 API 서버들을 종료합니다...');
  api1.kill('SIGTERM');
  api2.kill('SIGTERM');
  process.exit(0);
});

// 서버 시작 확인
setTimeout(() => {
  console.log('\n✅ 테스트 API 서버들이 시작되었습니다!');
  console.log('\n📋 테스트용 API 정보:');
  console.log('\n🏢 Company 1 API (Bearer Token):');
  console.log('   URL: http://localhost:3001/api/employees');
  console.log('   인증: Bearer Token');
  console.log('   토큰: test-token-company1-2024');
  console.log('\n🏢 Company 2 API (Basic Auth):');
  console.log('   URL: http://localhost:3002/api/staff');
  console.log('   인증: Basic Authentication');
  console.log('   사용자명: company2');
  console.log('   비밀번호: test123');
  console.log('\n💡 인터페이스 자동화 테스트에서 위 URL들을 사용하세요!');
  console.log('\n⚠️  종료하려면 Ctrl+C를 누르세요.\n');
}, 2000);
