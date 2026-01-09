import express, { Request, Response } from 'express';
import { pool as db } from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';

// axios를 동적으로 import (타입 오류 방지)
const axios = require('axios');

const router = express.Router();

// 인터페이스 목록 조회
router.get('/interfaces', authenticateToken, async (req, res) => {
  try {
    console.log('인터페이스 목록 조회 요청');
    const result = await db.query(`
      SELECT 
        id,
        company_name,
        api_url,
        auth_type,
        auth_config,
        api_fields,
        field_mappings,
        status,
        created_by,
        created_at,
        updated_at
      FROM company_interfaces 
      ORDER BY created_at DESC
    `);
    
    console.log('인터페이스 목록 조회 성공, 개수:', result.rows.length);
    
    // camelCase로 변환
    const interfaces = result.rows.map((row: any) => ({
      id: row.id,
      companyName: row.company_name,
      apiUrl: row.api_url,
      authType: row.auth_type,
      authConfig: row.auth_config,
      apiFields: row.api_fields,
      mappings: row.field_mappings,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(interfaces);
  } catch (error: any) {
    console.error('인터페이스 목록 조회 오류:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({ 
      error: '인터페이스 목록을 불러올 수 없습니다.',
      details: error.message 
    });
  }
});

// 인터페이스 상세 조회
router.get('/interfaces/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT 
        id,
        company_name,
        api_url,
        auth_type,
        auth_config,
        api_fields,
        field_mappings,
        status,
        created_by,
        created_at,
        updated_at
      FROM company_interfaces 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '인터페이스를 찾을 수 없습니다.' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('인터페이스 상세 조회 오류:', error);
    res.status(500).json({ error: '인터페이스를 불러올 수 없습니다.' });
  }
});

// API URL 분석
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { url, authType, authConfig } = req.body;
    
    console.log('API 분석 요청:', { url, authType, authConfig: authConfig ? '***' : null });
    
    if (!url) {
      return res.status(400).json({ error: 'API URL이 필요합니다.' });
    }

    // API 호출을 위한 헤더 설정
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'InterfaceAutomation/1.0'
    };

    // 인증 정보 설정
    if (authType === 'bearer' && authConfig && authConfig.token) {
      headers['Authorization'] = `Bearer ${authConfig.token}`;
      console.log('Bearer Token 설정됨');
    } else if (authType === 'basic' && authConfig && authConfig.username && authConfig.password) {
      const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
      console.log('Basic Auth 설정됨');
    }

    try {
      console.log('API 호출 시도:', url);
      console.log('헤더:', headers);
      
      // API 호출 시도
      const response = await axios.get(url, { 
        headers,
        timeout: 15000, // 15초 타임아웃
        validateStatus: function (status: number) {
          return status >= 200 && status < 300; // 기본값
        }
      });

      console.log('API 응답 상태:', response.status);
      console.log('API 응답 데이터:', response.data);

      const data = response.data;
      const fields = analyzeApiResponse(data);
      
      res.json({
        success: true,
        fields,
        rawData: data,
        message: 'API 분석이 성공적으로 완료되었습니다.'
      });
    } catch (apiError: any) {
      console.error('API 호출 오류 상세:', {
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        data: apiError.response?.data
      });
      
      // API 호출이 실패한 경우 샘플 데이터 반환
      const sampleFields = generateSampleFields();
      res.json({
        success: true,
        fields: sampleFields,
        warning: `API 호출에 실패했습니다: ${apiError.message}. 샘플 데이터를 반환합니다.`,
        error: {
          message: apiError.message,
          code: apiError.code,
          status: apiError.response?.status
        }
      });
    }
  } catch (error: any) {
    console.error('API 분석 전체 오류:', error);
    res.status(500).json({ 
      error: 'API 분석 중 오류가 발생했습니다.',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API 응답 분석 함수
function analyzeApiResponse(data: any): any[] {
  console.log('API 응답 분석 시작:', data);
  const fields: any[] = [];
  
  // 응답 구조에 따른 분석
  if (Array.isArray(data) && data.length > 0) {
    console.log('배열 데이터 분석:', data[0]);
    analyzeObject(data[0], fields, '');
  } else if (data && typeof data === 'object') {
    // data 객체가 있는 경우 (예: { success: true, data: [...] })
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      console.log('중첩 데이터 배열 분석:', data.data[0]);
      analyzeObject(data.data[0], fields, '');
    } else if (data.result && data.data && data.data.staff_list && Array.isArray(data.data.staff_list) && data.data.staff_list.length > 0) {
      console.log('staff_list 데이터 분석:', data.data.staff_list[0]);
      analyzeObject(data.data.staff_list[0], fields, '');
    } else {
      console.log('직접 객체 분석:', data);
      analyzeObject(data, fields, '');
    }
  }
  
  console.log('분석된 필드들:', fields);
  return fields;
}

function analyzeObject(obj: any, fields: any[], prefix: string): void {
  for (const [key, value] of Object.entries(obj)) {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    const fieldType = getFieldType(value);
    
    fields.push({
      name: fieldName,
      type: fieldType,
      description: generateFieldDescription(key, value),
      required: false, // 실제로는 스키마에서 확인해야 함
      sampleValue: getSampleValue(value)
    });
    
    // 중첩된 객체인 경우 재귀적으로 분석
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      analyzeObject(value, fields, fieldName);
    }
  }
}

function getFieldType(value: any): string {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'string') {
    // 날짜 형식 체크
    if (isDateString(value)) return 'date';
    // 이메일 형식 체크
    if (isEmailString(value)) return 'email';
    return 'string';
  }
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'string';
}

function isDateString(str: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}/;
  return dateRegex.test(str) && !isNaN(Date.parse(str));
}

function isEmailString(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

function generateFieldDescription(key: string, value: any): string {
  // 키 이름을 기반으로 설명 생성
  const keyLower = key.toLowerCase();
  
  if (keyLower.includes('id')) return '식별자';
  if (keyLower.includes('name')) return '이름';
  if (keyLower.includes('email')) return '이메일 주소';
  if (keyLower.includes('phone')) return '전화번호';
  if (keyLower.includes('department')) return '부서';
  if (keyLower.includes('position')) return '직급';
  if (keyLower.includes('date')) return '날짜';
  if (keyLower.includes('status')) return '상태';
  if (keyLower.includes('address')) return '주소';
  
  return `${key} 필드`;
}

function getSampleValue(value: any): any {
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return value;
}

// 샘플 필드 생성 (API 호출 실패 시 사용)
function generateSampleFields(): any[] {
  return [
    {
      name: 'id',
      type: 'integer',
      description: '사원 ID',
      required: true,
      sampleValue: 1001
    },
    {
      name: 'employeeId',
      type: 'string',
      description: '사원번호',
      required: true,
      sampleValue: 'EMP001'
    },
    {
      name: 'name',
      type: 'string',
      description: '성명',
      required: true,
      sampleValue: '홍길동'
    },
    {
      name: 'department',
      type: 'string',
      description: '부서',
      required: true,
      sampleValue: '개발팀'
    },
    {
      name: 'position',
      type: 'string',
      description: '직급',
      required: false,
      sampleValue: '대리'
    },
    {
      name: 'email',
      type: 'email',
      description: '이메일',
      required: false,
      sampleValue: 'hong@company.com'
    },
    {
      name: 'phone',
      type: 'string',
      description: '전화번호',
      required: false,
      sampleValue: '010-1234-5678'
    },
    {
      name: 'hireDate',
      type: 'date',
      description: '입사일',
      required: false,
      sampleValue: '2023-01-15'
    },
    {
      name: 'status',
      type: 'string',
      description: '재직상태',
      required: true,
      sampleValue: 'active'
    }
  ];
}

// 인터페이스 저장
router.post('/save', requireAdmin, async (req: any, res) => {
  try {
    console.log('인터페이스 저장 요청:', req.body);
    const { companyName, apiUrl, authType, authConfig, apiFields, mappings } = req.body;
    
    if (!companyName || !apiUrl) {
      console.log('필수 필드 누락:', { companyName, apiUrl });
      return res.status(400).json({ error: '회사명과 API URL은 필수입니다.' });
    }

    // 트랜잭션 시작
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      console.log('트랜잭션 시작');
      
      // 인터페이스 저장
      const interfaceResult = await client.query(`
        INSERT INTO company_interfaces (
          company_name, api_url, auth_type, auth_config, 
          api_fields, field_mappings, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        companyName,
        apiUrl,
        authType,
        JSON.stringify(authConfig),
        JSON.stringify(apiFields),
        JSON.stringify(mappings),
        req.user?.userid || 'system'
      ]);
      
      console.log('인터페이스 저장 완료, ID:', interfaceResult.rows[0].id);
      
      const interfaceId = interfaceResult.rows[0].id;
      
      // 이력 저장
      await client.query(`
        INSERT INTO interface_history (
          interface_id, change_type, changes, changed_by
        ) VALUES ($1, $2, $3, $4)
      `, [
        interfaceId,
        'create',
        JSON.stringify({
          companyName,
          apiUrl,
          authType,
          fieldCount: apiFields?.length || 0,
          mappingCount: mappings?.length || 0
        }),
        req.user?.userid || 'system'
      ]);
      
      // 스탠다드 배치 서비스 생성
      const serviceName = `StandardBatchService_${companyName}`;
      await client.query(`
        INSERT INTO standard_batch_services (
          service_name, company_name, service_config, created_by
        ) VALUES ($1, $2, $3, $4)
      `, [
        serviceName,
        companyName,
        JSON.stringify({
          interfaceId,
          apiUrl,
          authType,
          mappings
        }),
        req.user?.userid || 'system'
      ]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        interfaceId,
        message: '인터페이스가 성공적으로 저장되었습니다.'
      });
    } catch (error: any) {
      console.error('트랜잭션 오류:', error);
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('인터페이스 저장 오류:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      stack: error.stack
    });
    
    let errorMessage = '인터페이스 저장 중 오류가 발생했습니다.';
    let statusCode = 500;
    
    if (error.code === '23505') { // 중복 키 오류
      errorMessage = '이미 존재하는 회사명입니다.';
      statusCode = 409;
    } else if (error.code === '23503') { // 외래 키 오류
      errorMessage = '데이터 참조 오류가 발생했습니다.';
      statusCode = 400;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.detail || error.message,
      code: error.code
    });
  }
});

// 인터페이스 수정
router.put('/interfaces/:id', requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { companyName, apiUrl, authType, authConfig, apiFields, mappings, status } = req.body;
    
    // 기존 데이터 조회
    const existingResult = await db.query(`
      SELECT * FROM company_interfaces WHERE id = $1
    `, [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: '인터페이스를 찾을 수 없습니다.' });
    }
    
    const existingInterface = existingResult.rows[0];
    
    // 트랜잭션 시작
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // 인터페이스 수정
      await client.query(`
        UPDATE company_interfaces SET
          company_name = $1,
          api_url = $2,
          auth_type = $3,
          auth_config = $4,
          api_fields = $5,
          field_mappings = $6,
          status = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
      `, [
        companyName || existingInterface.company_name,
        apiUrl || existingInterface.api_url,
        authType || existingInterface.auth_type,
        authConfig ? JSON.stringify(authConfig) : existingInterface.auth_config,
        apiFields ? JSON.stringify(apiFields) : existingInterface.api_fields,
        mappings ? JSON.stringify(mappings) : existingInterface.field_mappings,
        status || existingInterface.status,
        id
      ]);
      
      // 이력 저장
      await client.query(`
        INSERT INTO interface_history (
          interface_id, change_type, changes, previous_state, changed_by
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        id,
        'update',
        JSON.stringify({
          companyName: companyName || existingInterface.company_name,
          apiUrl: apiUrl || existingInterface.api_url,
          authType: authType || existingInterface.auth_type,
          status: status || existingInterface.status
        }),
        JSON.stringify({
          companyName: existingInterface.company_name,
          apiUrl: existingInterface.api_url,
          authType: existingInterface.auth_type,
          status: existingInterface.status
        }),
        req.user?.userid || 'system'
      ]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: '인터페이스가 성공적으로 수정되었습니다.'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('인터페이스 수정 오류:', error);
    res.status(500).json({ error: '인터페이스 수정 중 오류가 발생했습니다.' });
  }
});

// 인터페이스 삭제
router.delete('/interfaces/:id', requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // 트랜잭션 시작
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // 이력 저장 (삭제 전)
      await client.query(`
        INSERT INTO interface_history (
          interface_id, change_type, changes, changed_by
        ) VALUES ($1, $2, $3, $4)
      `, [
        id,
        'delete',
        JSON.stringify({ deletedAt: new Date().toISOString() }),
        req.user?.userid || 'system'
      ]);
      
      // 인터페이스 삭제
      await client.query(`
        DELETE FROM company_interfaces WHERE id = $1
      `, [id]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: '인터페이스가 성공적으로 삭제되었습니다.'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('인터페이스 삭제 오류:', error);
    res.status(500).json({ error: '인터페이스 삭제 중 오류가 발생했습니다.' });
  }
});

// 변경 이력 조회
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { interfaceId, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        h.id,
        h.interface_id,
        h.change_type,
        h.changes,
        h.previous_state,
        h.changed_by,
        h.created_at,
        c.company_name
      FROM interface_history h
      LEFT JOIN company_interfaces c ON h.interface_id = c.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (interfaceId) {
      query += ` AND h.interface_id = $${paramIndex}`;
      params.push(interfaceId);
      paramIndex++;
    }
    
    query += ` ORDER BY h.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('변경 이력 조회 오류:', error);
    res.status(500).json({ error: '변경 이력을 불러올 수 없습니다.' });
  }
});

// 스탠다드 배치 서비스 목록 조회
router.get('/batch-services', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        service_name,
        company_name,
        service_config,
        status,
        created_by,
        created_at,
        updated_at
      FROM standard_batch_services 
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('배치 서비스 목록 조회 오류:', error);
    res.status(500).json({ error: '배치 서비스 목록을 불러올 수 없습니다.' });
  }
});

// 배치 서비스 코드 생성
router.post('/generate-batch-service/:interfaceId', requireAdmin, async (req: any, res) => {
  try {
    const { interfaceId } = req.params;
    
    // 인터페이스 정보 조회
    const interfaceResult = await db.query(`
      SELECT * FROM company_interfaces WHERE id = $1
    `, [interfaceId]);
    
    if (interfaceResult.rows.length === 0) {
      return res.status(404).json({ error: '인터페이스를 찾을 수 없습니다.' });
    }
    
    const interfaceData = interfaceResult.rows[0];
    const generatedCode = generateBatchServiceCode(interfaceData);
    
    // 생성된 코드를 데이터베이스에 저장
    await db.query(`
      UPDATE standard_batch_services 
      SET generated_code = $1, updated_at = CURRENT_TIMESTAMP
      WHERE company_name = $2
    `, [generatedCode, interfaceData.company_name]);
    
    res.json({
      success: true,
      generatedCode,
      message: '배치 서비스 코드가 생성되었습니다.'
    });
  } catch (error) {
    console.error('배치 서비스 생성 오류:', error);
    res.status(500).json({ error: '배치 서비스 생성 중 오류가 발생했습니다.' });
  }
});

// 배치 서비스 코드 생성 함수
function generateBatchServiceCode(interfaceData: any): string {
  const { company_name, api_url, auth_type, auth_config, field_mappings } = interfaceData;
  const mappings = JSON.parse(field_mappings || '[]');
  
  const serviceName = `StandardBatchService_${company_name}`;
  
  let code = `// ${serviceName}
// 자동 생성된 배치 서비스 코드
// 생성일: ${new Date().toISOString()}

package com.company.batch.${company_name.toLowerCase()};

import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.configuration.annotation.JobBuilderFactory;
import org.springframework.batch.core.configuration.annotation.StepBuilderFactory;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;

@Configuration
public class ${serviceName} {

    @Autowired
    private JobBuilderFactory jobBuilderFactory;

    @Autowired
    private StepBuilderFactory stepBuilderFactory;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    // API URL: ${api_url}
    // 인증 방식: ${auth_type}

    @Bean
    public Job ${company_name.toLowerCase()}EmployeeSyncJob() {
        return jobBuilderFactory.get("${company_name.toLowerCase()}EmployeeSyncJob")
                .start(${company_name.toLowerCase()}EmployeeSyncStep())
                .build();
    }

    @Bean
    public Step ${company_name.toLowerCase()}EmployeeSyncStep() {
        return stepBuilderFactory.get("${company_name.toLowerCase()}EmployeeSyncStep")
                .<Map<String, Object>, EmployeeData>chunk(100)
                .reader(employeeReader())
                .processor(employeeProcessor())
                .writer(employeeWriter())
                .build();
    }

    @Bean
    public ItemReader<Map<String, Object>> employeeReader() {
        return new EmployeeApiReader();
    }

    @Bean
    public ItemProcessor<Map<String, Object>, EmployeeData> employeeProcessor() {
        return new EmployeeDataProcessor();
    }

    @Bean
    public ItemWriter<EmployeeData> employeeWriter() {
        return new EmployeeDataWriter();
    }

    // API Reader 클래스
    public class EmployeeApiReader implements ItemReader<Map<String, Object>> {
        
        private List<Map<String, Object>> employees;
        private int index = 0;

        @Override
        public Map<String, Object> read() throws Exception {
            if (employees == null) {
                fetchEmployeesFromApi();
            }
            
            if (index < employees.size()) {
                return employees.get(index++);
            }
            
            return null;
        }

        private void fetchEmployeesFromApi() {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.set("Content-Type", "application/json");
                
                // 인증 헤더 설정
                ${generateAuthCode(auth_type, auth_config)}
                
                HttpEntity<String> entity = new HttpEntity<>(headers);
                ResponseEntity<String> response = restTemplate.exchange(
                    "${api_url}",
                    HttpMethod.GET,
                    entity,
                    String.class
                );
                
                List<Map<String, Object>> responseList = objectMapper.readValue(
                    response.getBody(), 
                    objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class)
                );
                
                employees = responseList;
            } catch (Exception e) {
                throw new RuntimeException("API 호출 실패: " + e.getMessage(), e);
            }
        }
    }

    // 데이터 변환 프로세서
    public class EmployeeDataProcessor implements ItemProcessor<Map<String, Object>, EmployeeData> {
        
        @Override
        public EmployeeData process(Map<String, Object> item) throws Exception {
            EmployeeData employee = new EmployeeData();
            
            // 필드 매핑 처리
            ${generateMappingCode(mappings)}
            
            return employee;
        }
    }

    // 데이터 저장 Writer
    public class EmployeeDataWriter implements ItemWriter<EmployeeData> {
        
        @Override
        public void write(List<? extends EmployeeData> items) throws Exception {
            // 데이터베이스 저장 로직
            for (EmployeeData employee : items) {
                // 여기에 실제 데이터베이스 저장 로직 구현
                System.out.println("저장할 직원 데이터: " + employee);
            }
        }
    }

    // 직원 데이터 모델
    public static class EmployeeData {
        private String employeeId;
        private String name;
        private String department;
        private String position;
        private String email;
        private String phone;
        private String hireDate;
        private String status;
        
        // Getters and Setters
        public String getEmployeeId() { return employeeId; }
        public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getDepartment() { return department; }
        public void setDepartment(String department) { this.department = department; }
        
        public String getPosition() { return position; }
        public void setPosition(String position) { this.position = position; }
        
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
        
        public String getHireDate() { return hireDate; }
        public void setHireDate(String hireDate) { this.hireDate = hireDate; }
        
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        
        @Override
        public String toString() {
            return "EmployeeData{" +
                    "employeeId='" + employeeId + '\'' +
                    ", name='" + name + '\'' +
                    ", department='" + department + '\'' +
                    ", position='" + position + '\'' +
                    ", email='" + email + '\'' +
                    ", phone='" + phone + '\'' +
                    ", hireDate='" + hireDate + '\'' +
                    ", status='" + status + '\'' +
                    '}';
        }
    }
}`;

  return code;
}

function generateAuthCode(authType: string, authConfig: any): string {
  const config = JSON.parse(authConfig || '{}');
  
  switch (authType) {
    case 'bearer':
      return `headers.set("Authorization", "Bearer ${config.token}");`;
    case 'basic':
      return `String credentials = "${config.username}:${config.password}";
                String encodedCredentials = Base64.getEncoder().encodeToString(credentials.getBytes());
                headers.set("Authorization", "Basic " + encodedCredentials);`;
    case 'oauth2':
      return `// OAuth2 토큰 획득 로직 필요
                String oauthToken = getOAuthToken("${config.clientId}", "${config.clientSecret}");
                headers.set("Authorization", "Bearer " + oauthToken);`;
    default:
      return '// 인증 없음';
  }
}

function generateMappingCode(mappings: any[]): string {
  let mappingCode = '';
  
  mappings.forEach(mapping => {
    if (mapping.standardField && mapping.apiField) {
      const fieldName = mapping.standardField;
      const apiField = mapping.apiField;
      
      switch (mapping.mappingType) {
        case 'direct':
          mappingCode += `employee.set${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}(
                    (String) item.get("${apiField}"));\n            `;
          break;
        case 'transform':
          mappingCode += `// 변환 로직: ${mapping.transformRule}
                    String ${fieldName}Value = (String) item.get("${apiField}");
                    ${mapping.transformRule}
                    employee.set${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}(${fieldName}Value);\n            `;
          break;
        case 'custom':
          mappingCode += `// 커스텀 매핑: ${mapping.transformRule}
                    ${mapping.transformRule}\n            `;
          break;
      }
    }
  });
  
  return mappingCode;
}

export default router;
