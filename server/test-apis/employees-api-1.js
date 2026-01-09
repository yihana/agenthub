const express = require('express');
const app = express();
const PORT = 3001;

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

// 샘플 사원 데이터
const employees = [
  {
    emp_id: "EMP001",
    full_name: "김철수",
    dept_code: "DEV001",
    dept_name: "개발팀",
    position_level: "SENIOR",
    position_name: "시니어 개발자",
    email_address: "kimcs@company1.com",
    mobile_phone: "010-1234-5678",
    work_phone: "02-1234-5678",
    hire_date: "2022-03-15",
    work_status: "ACTIVE",
    salary_grade: "A",
    manager_id: "EMP005",
    office_location: "서울 본사",
    birth_date: "1990-05-20",
    gender: "M"
  },
  {
    emp_id: "EMP002",
    full_name: "이영희",
    dept_code: "HR001",
    dept_name: "인사팀",
    position_level: "MANAGER",
    position_name: "인사팀장",
    email_address: "leeyh@company1.com",
    mobile_phone: "010-2345-6789",
    work_phone: "02-2345-6789",
    hire_date: "2021-01-10",
    work_status: "ACTIVE",
    salary_grade: "B",
    manager_id: "EMP010",
    office_location: "서울 본사",
    birth_date: "1985-12-03",
    gender: "F"
  },
  {
    emp_id: "EMP003",
    full_name: "박민수",
    dept_code: "SALES001",
    dept_name: "영업팀",
    position_level: "JUNIOR",
    position_name: "영업사원",
    email_address: "parkms@company1.com",
    mobile_phone: "010-3456-7890",
    work_phone: "02-3456-7890",
    hire_date: "2023-07-01",
    work_status: "ACTIVE",
    salary_grade: "C",
    manager_id: "EMP007",
    office_location: "부산 지사",
    birth_date: "1995-08-15",
    gender: "M"
  },
  {
    emp_id: "EMP004",
    full_name: "정수진",
    dept_code: "FINANCE001",
    dept_name: "재무팀",
    position_level: "SENIOR",
    position_name: "재무팀원",
    email_address: "jeongsj@company1.com",
    mobile_phone: "010-4567-8901",
    work_phone: "02-4567-8901",
    hire_date: "2020-11-20",
    work_status: "ACTIVE",
    salary_grade: "A",
    manager_id: "EMP009",
    office_location: "서울 본사",
    birth_date: "1988-03-22",
    gender: "F"
  },
  {
    emp_id: "EMP005",
    full_name: "최대현",
    dept_code: "DEV001",
    dept_name: "개발팀",
    position_level: "LEAD",
    position_name: "개발팀장",
    email_address: "choi@company1.com",
    mobile_phone: "010-5678-9012",
    work_phone: "02-5678-9012",
    hire_date: "2019-06-01",
    work_status: "ACTIVE",
    salary_grade: "A",
    manager_id: null,
    office_location: "서울 본사",
    birth_date: "1983-09-10",
    gender: "M"
  }
];

// 인증 미들웨어 (Bearer Token)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '액세스 토큰이 필요합니다.' });
  }

  // 테스트용 토큰 검증 (실제로는 JWT 검증)
  if (token === 'test-token-company1-2024') {
    next();
  } else {
    return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
  }
};

// API 엔드포인트들
app.get('/', (req, res) => {
  res.json({
    message: "Company 1 Employee API",
    version: "1.0.0",
    endpoints: {
      employees: "/api/employees",
      employee_by_id: "/api/employees/:id",
      departments: "/api/departments"
    },
    authentication: "Bearer Token required"
  });
});

// 사원 목록 조회 (인증 필요)
app.get('/api/employees', authenticateToken, (req, res) => {
  const { page = 1, limit = 10, department, status } = req.query;
  
  let filteredEmployees = [...employees];
  
  // 부서 필터
  if (department) {
    filteredEmployees = filteredEmployees.filter(emp => 
      emp.dept_code === department || emp.dept_name.includes(department)
    );
  }
  
  // 상태 필터
  if (status) {
    filteredEmployees = filteredEmployees.filter(emp => 
      emp.work_status === status.toUpperCase()
    );
  }
  
  // 페이지네이션
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: paginatedEmployees,
    pagination: {
      current_page: parseInt(page),
      total_pages: Math.ceil(filteredEmployees.length / limit),
      total_count: filteredEmployees.length,
      limit: parseInt(limit)
    },
    message: `${paginatedEmployees.length}명의 사원 정보를 조회했습니다.`
  });
});

// 특정 사원 조회
app.get('/api/employees/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const employee = employees.find(emp => emp.emp_id === id);
  
  if (!employee) {
    return res.status(404).json({
      success: false,
      error: "사원을 찾을 수 없습니다.",
      employee_id: id
    });
  }
  
  res.json({
    success: true,
    data: employee
  });
});

// 부서 목록 조회
app.get('/api/departments', authenticateToken, (req, res) => {
  const departments = [
    { dept_code: "DEV001", dept_name: "개발팀", manager: "최대현", employee_count: 2 },
    { dept_code: "HR001", dept_name: "인사팀", manager: "이영희", employee_count: 1 },
    { dept_code: "SALES001", dept_name: "영업팀", manager: "김영수", employee_count: 1 },
    { dept_code: "FINANCE001", dept_name: "재무팀", manager: "박재무", employee_count: 1 }
  ];
  
  res.json({
    success: true,
    data: departments
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 Company 1 Employee API Server running on http://localhost:${PORT}`);
  console.log(`📋 Test Bearer Token: test-token-company1-2024`);
  console.log(`🔗 API Endpoints:`);
  console.log(`   GET /api/employees - 사원 목록 조회`);
  console.log(`   GET /api/employees/:id - 특정 사원 조회`);
  console.log(`   GET /api/departments - 부서 목록 조회`);
});

module.exports = app;
