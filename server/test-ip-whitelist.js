const axios = require('axios');

// 테스트할 IP 주소들
const testIps = [
  '211.45.61.18',    // 허용된 IP
  '211.45.61.20',    // 허용된 IP  
  '211.45.62.70',    // 허용된 IP
  '127.0.0.1',       // 허용된 IP (localhost)
  '192.168.1.100',   // 허용되지 않은 IP
  '10.0.0.1',        // 허용되지 않은 IP
  '8.8.8.8'          // 허용되지 않은 IP
];

const serverUrl = 'http://localhost:8787';

async function testIpAccess(ip) {
  try {
    console.log(`\n🔍 테스트 IP: ${ip}`);
    
    const response = await axios.get(`${serverUrl}/health`, {
      headers: {
        'X-Forwarded-For': ip,
        'X-Real-IP': ip
      },
      timeout: 5000
    });
    
    console.log(`✅ 접근 허용됨 (${response.status})`);
    return true;
    
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log(`❌ 접근 거부됨 (403 Forbidden)`);
      console.log(`   에러 메시지: ${error.response.data?.error || 'Unknown error'}`);
      return false;
    } else {
      console.log(`⚠️  연결 오류: ${error.message}`);
      return null;
    }
  }
}

async function runTests() {
  console.log('🚀 IP 화이트리스트 테스트 시작');
  console.log('='.repeat(50));
  
  let allowedCount = 0;
  let deniedCount = 0;
  let errorCount = 0;
  
  for (const ip of testIps) {
    const result = await testIpAccess(ip);
    
    if (result === true) allowedCount++;
    else if (result === false) deniedCount++;
    else errorCount++;
    
    // 테스트 간 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 테스트 결과 요약:');
  console.log(`   허용된 접근: ${allowedCount}`);
  console.log(`   거부된 접근: ${deniedCount}`);
  console.log(`   연결 오류: ${errorCount}`);
  
  if (allowedCount === 4 && deniedCount === 3) {
    console.log('🎉 모든 테스트가 예상대로 통과했습니다!');
  } else {
    console.log('⚠️  일부 테스트가 예상과 다릅니다.');
  }
}

// 서버가 실행 중인지 확인
async function checkServer() {
  try {
    await axios.get(`${serverUrl}/health`, { timeout: 3000 });
    console.log('✅ 서버가 실행 중입니다.');
    return true;
  } catch (error) {
    console.log('❌ 서버에 연결할 수 없습니다. 서버를 먼저 시작해주세요.');
    console.log('   실행 명령: npm run dev 또는 npm start');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  
  if (serverRunning) {
    await runTests();
  }
}

main().catch(console.error);
