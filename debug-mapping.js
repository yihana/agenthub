// 필드 매핑 디버깅 스크립트
const axios = require('axios');

async function debugMapping() {
  console.log('🔍 필드 매핑 디버깅 시작...\n');

  try {
    // Company 1 API 테스트
    console.log('📋 Company 1 API 테스트');
    const response1 = await axios.get('http://localhost:3001/api/employees', {
      headers: {
        'Authorization': 'Bearer test-token-company1-2024'
      }
    });

    console.log('응답 구조:', Object.keys(response1.data));
    if (response1.data.data && response1.data.data[0]) {
      console.log('첫 번째 사원 데이터:', response1.data.data[0]);
      console.log('필드 목록:', Object.keys(response1.data.data[0]));
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Company 2 API 테스트
    console.log('📋 Company 2 API 테스트');
    const response2 = await axios.get('http://localhost:3002/api/staff', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('company2:test123').toString('base64')
      }
    });

    console.log('응답 구조:', Object.keys(response2.data));
    if (response2.data.data && response2.data.data.staff_list && response2.data.data.staff_list[0]) {
      console.log('첫 번째 직원 데이터:', response2.data.data.staff_list[0]);
      console.log('필드 목록:', Object.keys(response2.data.data.staff_list[0]));
    }

  } catch (error) {
    console.error('API 호출 오류:', error.message);
  }
}

debugMapping();
