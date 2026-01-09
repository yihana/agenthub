const axios = require('axios');

async function testApiAnalysis() {
  console.log('🧪 API 분석 테스트 시작...\n');

  // 테스트 1: Company 1 API (Bearer Token)
  console.log('📋 테스트 1: Company 1 API (Bearer Token)');
  try {
    const response = await axios.get('http://localhost:3001/api/employees', {
      headers: {
        'Authorization': 'Bearer test-token-company1-2024',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ API 호출 성공');
    console.log('응답 상태:', response.status);
    console.log('응답 데이터 구조:', Object.keys(response.data));
    
    if (response.data.success && response.data.data) {
      console.log('첫 번째 사원 데이터:', response.data.data[0]);
    }
  } catch (error) {
    console.error('❌ API 호출 실패:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 테스트 2: Company 2 API (Basic Auth)
  console.log('📋 테스트 2: Company 2 API (Basic Auth)');
  try {
    const response = await axios.get('http://localhost:3002/api/staff', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('company2:test123').toString('base64'),
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ API 호출 성공');
    console.log('응답 상태:', response.status);
    console.log('응답 데이터 구조:', Object.keys(response.data));
    
    if (response.data.result && response.data.data) {
      console.log('첫 번째 직원 데이터:', response.data.data.staff_list[0]);
    }
  } catch (error) {
    console.error('❌ API 호출 실패:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 테스트 3: 백엔드 분석 API 테스트
  console.log('📋 테스트 3: 백엔드 분석 API 테스트');
  try {
    const analysisResponse = await axios.post('http://localhost:8787/api/interface-automation/analyze', {
      url: 'http://localhost:3001/api/employees',
      authType: 'bearer',
      authConfig: {
        token: 'test-token-company1-2024'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyaWQiOiJhZG1pbiIsImlhdCI6MTczNTY0NzYwMCwiZXhwIjoxNzM1NzM0MDAwfQ.example' // 임시 토큰
      },
      timeout: 15000
    });

    console.log('✅ 분석 API 호출 성공');
    console.log('분석 결과:', analysisResponse.data);
  } catch (error) {
    console.error('❌ 분석 API 호출 실패:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

// 테스트 실행
testApiAnalysis().then(() => {
  console.log('\n🏁 테스트 완료');
}).catch(error => {
  console.error('테스트 실행 오류:', error);
});
