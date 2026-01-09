const express = require('express');
const app = express();
const PORT = 3002;

// JSON 응답을 위한 미들웨어
app.use(express.json());

// CORS 허용
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 샘플 사원 데이터 (다른 구조)
const staffMembers = [
  {
    id: 1001,
    employee_number: "STAFF-2024-001",
    name: "홍길동",
    department: "IT Development",
    role: "Senior Developer",
    email: "hong@company2.co.kr",
    phone: "010-1111-2222",
    office_phone: "031-123-4567",
    start_date: "2023-01-15",
    employment_status: "재직",
    level: "P3",
    supervisor: "김과장",
    work_location: "성남시 분당구",
    personal_info: {
      birth: "1987-04-12",
      gender: "남성"
    }
  },
  {
    id: 1002,
    employee_number: "STAFF-2024-002",
    name: "김영희",
    department: "Human Resources",
    role: "HR Manager",
    email: "kim@company2.co.kr",
    phone: "010-2222-3333",
    office_phone: "031-123-4568",
    start_date: "2022-08-01",
    employment_status: "재직",
    level: "M2",
    supervisor: "이부장",
    work_location: "성남시 분당구",
    personal_info: {
      birth: "1985-11-25",
      gender: "여성"
    }
  },
  {
    id: 1003,
    employee_number: "STAFF-2024-003",
    name: "박민수",
    department: "Sales & Marketing",
    role: "Sales Representative",
    email: "park@company2.co.kr",
    phone: "010-3333-4444",
    office_phone: "031-123-4569",
    start_date: "2024-03-01",
    employment_status: "재직",
    level: "P1",
    supervisor: "정팀장",
    work_location: "대구시 수성구",
    personal_info: {
      birth: "1992-07-08",
      gender: "남성"
    }
  },
  {
    id: 1004,
    employee_number: "STAFF-2024-004",
    name: "이수진",
    department: "Finance & Accounting",
    role: "Financial Analyst",
    email: "lee@company2.co.kr",
    phone: "010-4444-5555",
    office_phone: "031-123-4570",
    start_date: "2021-12-01",
    employment_status: "재직",
    level: "P2",
    supervisor: "최과장",
    work_location: "성남시 분당구",
    personal_info: {
      birth: "1990-02-14",
      gender: "여성"
    }
  },
  {
    id: 1005,
    employee_number: "STAFF-2024-005",
    name: "정대현",
    department: "IT Development",
    role: "Technical Lead",
    email: "jung@company2.co.kr",
    phone: "010-5555-6666",
    office_phone: "031-123-4571",
    start_date: "2020-05-01",
    employment_status: "재직",
    level: "P4",
    supervisor: "한부장",
    work_location: "성남시 분당구",
    personal_info: {
      birth: "1984-09-30",
      gender: "남성"
    }
  },
  {
    id: 1006,
    employee_number: "STAFF-2024-006",
    name: "최영수",
    department: "Operations",
    role: "Operations Manager",
    email: "choi@company2.co.kr",
    phone: "010-6666-7777",
    office_phone: "031-123-4572",
    start_date: "2019-11-01",
    employment_status: "재직",
    level: "M3",
    supervisor: null,
    work_location: "성남시 분당구",
    personal_info: {
      birth: "1981-06-18",
      gender: "남성"
    }
  }
];

// Basic Auth 인증 미들웨어
const authenticateBasicAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ 
      error: 'Basic Authentication이 필요합니다.',
      hint: '사용자명: company2, 비밀번호: test123'
    });
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  // 테스트용 계정 검증
  if (username === 'company2' && password === 'test123') {
    req.user = { username, company: 'Company2' };
    next();
  } else {
    return res.status(403).json({ 
      error: '잘못된 인증 정보입니다.',
      hint: '사용자명: company2, 비밀번호: test123'
    });
  }
};

// API 엔드포인트들
app.get('/', (req, res) => {
  res.json({
    service_name: "Company 2 Staff Management API",
    version: "2.1.0",
    company: "Company 2 Ltd.",
    endpoints: {
      staff_list: "/api/staff",
      staff_detail: "/api/staff/:id",
      departments: "/api/departments",
      search: "/api/staff/search"
    },
    authentication: "Basic Authentication required",
    credentials: {
      username: "company2",
      password: "test123"
    }
  });
});

// 직원 목록 조회 (Basic Auth 필요)
app.get('/api/staff', authenticateBasicAuth, (req, res) => {
  const { page = 1, size = 10, dept, status } = req.query;
  
  let filteredStaff = [...staffMembers];
  
  // 부서 필터
  if (dept) {
    filteredStaff = filteredStaff.filter(staff => 
      staff.department.toLowerCase().includes(dept.toLowerCase())
    );
  }
  
  // 상태 필터
  if (status) {
    filteredStaff = filteredStaff.filter(staff => 
      staff.employment_status.includes(status)
    );
  }
  
  // 페이지네이션
  const startIndex = (page - 1) * size;
  const endIndex = page * size;
  const paginatedStaff = filteredStaff.slice(startIndex, endIndex);
  
  res.json({
    result: {
      success: true,
      message: "직원 정보 조회 성공"
    },
    data: {
      staff_list: paginatedStaff,
      total_count: filteredStaff.length,
      current_page: parseInt(page),
      page_size: parseInt(size),
      total_pages: Math.ceil(filteredStaff.length / size)
    }
  });
});

// 특정 직원 조회
app.get('/api/staff/:id', authenticateBasicAuth, (req, res) => {
  const { id } = req.params;
  const staff = staffMembers.find(member => member.id === parseInt(id));
  
  if (!staff) {
    return res.status(404).json({
      result: {
        success: false,
        error_code: "STAFF_NOT_FOUND",
        message: "해당 직원을 찾을 수 없습니다."
      },
      data: null
    });
  }
  
  res.json({
    result: {
      success: true,
      message: "직원 정보 조회 성공"
    },
    data: {
      staff_info: staff
    }
  });
});

// 부서 목록 조회
app.get('/api/departments', authenticateBasicAuth, (req, res) => {
  const departments = [
    { 
      code: "IT_DEV", 
      name: "IT Development", 
      manager: "정대현", 
      location: "성남시 분당구",
      staff_count: 2 
    },
    { 
      code: "HR", 
      name: "Human Resources", 
      manager: "김영희", 
      location: "성남시 분당구",
      staff_count: 1 
    },
    { 
      code: "SALES", 
      name: "Sales & Marketing", 
      manager: "정팀장", 
      location: "대구시 수성구",
      staff_count: 1 
    },
    { 
      code: "FINANCE", 
      name: "Finance & Accounting", 
      manager: "최과장", 
      location: "성남시 분당구",
      staff_count: 1 
    },
    { 
      code: "OPS", 
      name: "Operations", 
      manager: "최영수", 
      location: "성남시 분당구",
      staff_count: 1 
    }
  ];
  
  res.json({
    result: {
      success: true,
      message: "부서 정보 조회 성공"
    },
    data: {
      departments: departments
    }
  });
});

// 직원 검색
app.get('/api/staff/search', authenticateBasicAuth, (req, res) => {
  const { keyword, field } = req.query;
  
  if (!keyword) {
    return res.status(400).json({
      result: {
        success: false,
        error_code: "MISSING_KEYWORD",
        message: "검색 키워드가 필요합니다."
      }
    });
  }
  
  let searchResults = staffMembers;
  
  if (field) {
    // 특정 필드에서 검색
    switch (field.toLowerCase()) {
      case 'name':
        searchResults = staffMembers.filter(staff => 
          staff.name.includes(keyword)
        );
        break;
      case 'department':
        searchResults = staffMembers.filter(staff => 
          staff.department.toLowerCase().includes(keyword.toLowerCase())
        );
        break;
      case 'email':
        searchResults = staffMembers.filter(staff => 
          staff.email.toLowerCase().includes(keyword.toLowerCase())
        );
        break;
      default:
        searchResults = staffMembers.filter(staff => 
          staff.name.includes(keyword) || 
          staff.department.toLowerCase().includes(keyword.toLowerCase()) ||
          staff.email.toLowerCase().includes(keyword.toLowerCase())
        );
    }
  } else {
    // 전체 검색
    searchResults = staffMembers.filter(staff => 
      staff.name.includes(keyword) || 
      staff.department.toLowerCase().includes(keyword.toLowerCase()) ||
      staff.email.toLowerCase().includes(keyword.toLowerCase()) ||
      staff.employee_number.includes(keyword)
    );
  }
  
  res.json({
    result: {
      success: true,
      message: `${searchResults.length}명의 직원을 찾았습니다.`
    },
    data: {
      search_results: searchResults,
      total_found: searchResults.length,
      search_keyword: keyword,
      search_field: field || "전체"
    }
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 Company 2 Staff Management API Server running on http://localhost:${PORT}`);
  console.log(`🔐 Basic Auth Credentials:`);
  console.log(`   Username: company2`);
  console.log(`   Password: test123`);
  console.log(`🔗 API Endpoints:`);
  console.log(`   GET /api/staff - 직원 목록 조회`);
  console.log(`   GET /api/staff/:id - 특정 직원 조회`);
  console.log(`   GET /api/departments - 부서 목록 조회`);
  console.log(`   GET /api/staff/search?keyword=검색어 - 직원 검색`);
});

module.exports = app;
