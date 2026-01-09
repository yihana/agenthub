import express from 'express';
import multer from 'multer';
import path from 'path';
import { OpenAI } from 'openai';
import { query, DB_TYPE } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
const jwt = require('jsonwebtoken');

const router = express.Router();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 기본 ESM 코드 정보 (DB에서 가져오지 못할 경우 사용)
const DEFAULT_ESM_CODE_INFO = `# CaseType

| 코드   | Desc.       |
|:-------|:------------|
| Z020   | 문의/요청 |
| Z030   | 시스템 개선 |

# ZMOD

|   코드 | Desc.      | 의미                    | 사용여부
|-------:|:-----------|:------------------------|:------------------------|
|   1000 | CSS(BI/CI) | 청구/수금 관리          | 미사용
|   1100 | CSS(FI-CA) | 계약/수납 관리          | 미사용
|   2000 | CO         | 관리 회계               | 사용
|   3000 | FI         | 재무 회계               | 사용
|   4000 | HR         | 인사 관리               | 사용
|   5000 | PP         | 생산 관리               | 미사용
|   6000 | SD         | 영업/판매 관리          | 사용
|   7000 | TD/MM      | 구매/자재 관리          | 사용
|   8000 | BC         | 시스템 관리             | 사용
|   9000 | BW         | 데이터 분석/리포팅 관리 | 미사용

# ZSUBCASE

| CaseType   | Unnamed: 1   | ZSUBCASE   | Unnamed: 3              |
|:-----------|:-------------|:-----------|:------------------------|
| 코드       | Desc.        | 코드       | Desc.                   |
| Z020       | 문의/요청    | 200010     | 단순 문의               |
| Z020       | 문의/요청    | 200020     | ERP 사용자 ID/권한 문의 |
| Z020       | 문의/요청    | 200030     | 사전 프로세스/기술 검토 |
| Z020       | 문의/요청    | 200040     | Data 확인 및 분석       |
| Z020       | 문의/요청    | 200050     | Data 추출               |
| Z020       | 문의/요청    | 200060     | 사용자 교육             |
| Z020       | 문의/요청    | 200070     | 기초조사 수행/지원      |
| Z020       | 문의/요청    | 200080     | 프로젝트 수행/지원      |
| Z020       | 문의/요청    | 200090     | IMG Configuration       |
| Z020       | 문의/요청    | 200100     | Data 관리               |
| Z030       | 시스템 개선  | 300010     | 시스템 개선 및 개발     `;

// DB에서 활성 프롬프트 가져오기
async function getActivePrompt(promptType: string, companyCode: string = 'SKN'): Promise<{ reference_content: string | null; prompt: string } | null> {
  try {
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT reference_content, prompt
        FROM prompt_management
        WHERE prompt_type = $1 AND company_code = $2 AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `;
    } else {
      queryText = `
        SELECT TOP 1 REFERENCE_CONTENT as reference_content, PROMPT as prompt
        FROM EAR.prompt_management
        WHERE PROMPT_TYPE = ? AND COMPANY_CODE = ? AND IS_ACTIVE = true
        ORDER BY CREATED_AT DESC
      `;
    }
    
    const result = await query(queryText, [promptType, companyCode]);
    const prompt = ((result as any).rows || result)[0];
    
    if (prompt) {
      return {
        reference_content: prompt.reference_content,
        prompt: prompt.prompt
      };
    }
    
    return null;
  } catch (error) {
    console.error('프롬프트 조회 오류:', error);
    return null;
  }
}

// LLM을 사용하여 적절한 코드값을 찾는 함수
async function findESMCodes(
  title: string,
  content: string,
  companyCode: string = 'SKN'
): Promise<{ caseType: string; ZMOD: string; ZSUBCASE: string }> {
  // 기본값
  const defaultValues = {
    caseType: 'Z020',
    ZMOD: '2000',
    ZSUBCASE: '200010'
  };

  // 입력이 너무 짧은 경우 기본값 반환 (제목과 내용의 총 길이가 20자 미만)
  const totalLength = (title || '').length + (content || '').length;
  if (totalLength < 20) {
    console.log('입력이 너무 짧아 기본값을 사용합니다:', defaultValues);
    return defaultValues;
  }

  try {
    // DB에서 활성 프롬프트 가져오기
    const dbPrompt = await getActivePrompt('ESM_REQUEST', companyCode);
    
    // DB에서 가져온 프롬프트 사용, 없으면 기본값 사용
    const referenceContent = dbPrompt?.reference_content || DEFAULT_ESM_CODE_INFO;
    let promptTemplate = dbPrompt?.prompt || `다음은 ESM Case 분류 코드 정보입니다:

${referenceContent}

사용자가 입력한 요청 제목과 내용을 분석하여 가장 적절한 코드값을 찾아주세요.

제목: {title}
내용: {content}

다음 형식으로만 응답해주세요 (JSON 형식):
{
  "caseType": "Z020 또는 Z030",
  "ZMOD": "1000~9000 중 하나",
  "ZSUBCASE": "200010~300010 중 하나"
}

주의사항:
- caseType은 Z020(시스템 개선) 또는 Z030(문의/요청) 중 하나여야 합니다.
- ZMOD는 1000~9000 사이의 코드값이어야 합니다.
- ZSUBCASE는 200010~300010 사이의 코드값이어야 합니다.
- caseType이 Z020이면 ZSUBCASE는 200010~200100 중 하나여야 합니다.
- caseType이 Z030이면 ZSUBCASE는 300010이어야 합니다.
- 확실하지 않으면 기본값을 사용하세요: caseType="Z020", ZMOD="3000", ZSUBCASE="200010"
- JSON 형식만 응답하고 다른 설명은 하지 마세요.`;

    // 프롬프트 템플릿에서 변수 치환
    const prompt = promptTemplate
      .replace(/{title}/g, title)
      .replace(/{content}/g, content)
      .replace(/{reference_content}/g, referenceContent);

    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 ESM Case 분류 전문가입니다. 사용자의 요청을 분석하여 적절한 코드값을 찾아주세요.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const response = completion.choices[0].message.content?.trim() || '';
    console.log('LLM 응답:', response);

    // JSON 파싱 시도
    let parsedResponse;
    try {
      // JSON 코드 블록이 있는 경우 제거
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = JSON.parse(response);
      }
    } catch (parseError) {
      console.error('JSON 파싱 실패, 기본값 사용:', parseError);
      return defaultValues;
    }

    // 값 검증 및 기본값으로 대체
    const result = {
      caseType: (parsedResponse.caseType === 'Z020' || parsedResponse.caseType === 'Z030') 
        ? parsedResponse.caseType 
        : defaultValues.caseType,
      ZMOD: /^[1-9]\d{3}$/.test(String(parsedResponse.ZMOD)) 
        ? String(parsedResponse.ZMOD) 
        : defaultValues.ZMOD,
      ZSUBCASE: /^(2000[1-9]\d|2001[0-9]\d|300010)$/.test(String(parsedResponse.ZSUBCASE))
        ? String(parsedResponse.ZSUBCASE)
        : defaultValues.ZSUBCASE
    };

    // caseType과 ZSUBCASE의 일관성 검증
    if (result.caseType === 'Z020' && !result.ZSUBCASE.startsWith('200')) {
      result.ZSUBCASE = defaultValues.ZSUBCASE;
    }
    if (result.caseType === 'Z030' && result.ZSUBCASE !== '300010') {
      result.ZSUBCASE = '300010';
    }

    console.log('LLM으로 찾은 코드값:', result);
    return result;

  } catch (error) {
    console.error('LLM 호출 중 오류 발생, 기본값 사용:', error);
    return defaultValues;
  }
}

// displayId가 "0"으로 시작하면 "X"로 변경하는 헬퍼 함수
function normalizeDisplayId(displayId: string | null | undefined): string {
  if (!displayId) {
    return '119010'; // 기본값
  }
  
  // "0"으로 시작하는 경우 "X"로 변경
  if (displayId.startsWith('0')) {
    return 'X' + displayId.substring(1);
  }
  
  return displayId;
}

// 허용된 파일 확장자 목록
const allowedExtensions = ['.md', '.txt', '.doc', '.docx', '.ppt', '.pptx', '.pdf', '.xls', '.xlsx'];
const allowedMimeTypes = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
];

// 파일 업로드를 위한 multer 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isValidExtension = allowedExtensions.includes(fileExtension);
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    
    if (isValidExtension || isValidMimeType) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. MD, TXT, DOC, DOCX, PPT, PPTX, PDF, XLS, XLSX 파일만 업로드 가능합니다.'));
    }
  },
});

// SAP ESM Note 생성 (htmlContent 등록)
async function createESMNote(htmlContent: string): Promise<string> {
  const username = process.env.C4C_USERNAME;
  const password = process.env.C4C_PASSWORD;
  
  if (!username || !password) {
    throw new Error('C4C 인증 정보가 설정되지 않았습니다. 환경변수를 확인하세요.');
  }
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  // C4C Base URL (환경변수에서 가져오거나 기본값 사용)
  const c4cBaseUrl = process.env.C4C_BASE_URL || 'https://my1002010.au1.test.crm.cloud.sap';
  const noteUrl = `${c4cBaseUrl}/sap/c4c/api/v1/note-service/notes`;
  
  const notePayload = {
    noteTypeCode: 'S001',
    htmlContent: htmlContent
  };
  
  const response = await fetch(noteUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'APIKey': 'ZhQTrUa9MULNGxozr2ksCT1RYRZbby11'
    },
    body: JSON.stringify(notePayload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('ESM Note 생성 실패:', response.status, errorText);
    throw new Error(`ESM Note 생성 실패: ${response.status} - ${errorText}`);
  }
  
  const noteData = await response.json() as { value?: { id?: string }; id?: string };
  console.log('ESM Note 응답 데이터:', JSON.stringify(noteData, null, 2));
  
  // 응답에서 noteId 추출 (응답 구조: { value: { id: "..." } })
  const noteId = noteData.value?.id || noteData.id;
  
  if (!noteId) {
    console.error('Note 응답 데이터 (전체):', JSON.stringify(noteData, null, 2));
    throw new Error('ESM Note ID를 찾을 수 없습니다. 응답 구조를 확인하세요.');
  }
  
  console.log('추출된 Note ID:', noteId);
  return String(noteId);
}

// SAP ContactPerson 등록
async function createContactPerson(displayId: string, familyName?: string): Promise<string> {
  const username = process.env.C4C_USERNAME;
  const password = process.env.C4C_PASSWORD;
  
  if (!username || !password) {
    throw new Error('C4C 인증 정보가 설정되지 않았습니다. 환경변수를 확인하세요.');
  }
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  // C4C Base URL (환경변수에서 가져오거나 기본값 사용)
  const c4cBaseUrl = process.env.C4C_BASE_URL || 'https://my1002010.au1.test.crm.cloud.sap';
  const contactPersonUrl = `${c4cBaseUrl}/sap/c4c/api/v1/contact-person-service/contactPersons`;
  
  // familyName이 제공되지 않으면 기본값 사용
  const finalFamilyName = familyName || 'SKN API TEST';
  
  const contactPersonPayload = {
    lifeCycleStatus: 'ACTIVE',
    familyName: finalFamilyName,
    displayId: displayId,
    accountDisplayId: '190010'
  };
  
  console.log('ContactPerson 생성 Payload:', JSON.stringify(contactPersonPayload, null, 2));
  
  const response = await fetch(contactPersonUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Node.js',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'APIKey': 'ZhQTrUa9MULNGxozr2ksCT1RYRZbby11'
    },
    body: JSON.stringify(contactPersonPayload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('ContactPerson 생성 실패:', response.status, errorText);
    throw new Error(`ContactPerson 생성 실패: ${response.status} - ${errorText}`);
  }
  
  const contactPersonData = await response.json() as { value?: { displayId?: string; id?: string }; displayId?: string; id?: string };
  const createdDisplayId = contactPersonData.value?.displayId || contactPersonData.displayId;
  
  if (!createdDisplayId) {
    console.error('ContactPerson 응답 데이터:', JSON.stringify(contactPersonData, null, 2));
    throw new Error('ContactPerson displayId를 찾을 수 없습니다. 응답 구조를 확인하세요.');
  }
  
  console.log('ContactPerson 생성 완료:', { displayId: createdDisplayId });
  return createdDisplayId;
}

// SAP ESM Case 생성
async function createESMCase(
  requestData: {
    title: string;
    content: string;
    createdBy: string;
    noteId: string;
    userName?: string | null;
    familyName?: string | null;
    companyCode?: string;
  }
): Promise<{ caseId: string; displayId: string }> {
  const username = process.env.C4C_USERNAME;
  const password = process.env.C4C_PASSWORD;
  
  if (!username || !password) {
    throw new Error('C4C 인증 정보가 설정되지 않았습니다. 환경변수를 확인하세요.');
  }
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  // C4C Base URL (환경변수에서 가져오거나 기본값 사용)
  const c4cBaseUrl = process.env.C4C_BASE_URL || 'https://my1002010.au1.test.crm.cloud.sap';
  const caseUrl = `${c4cBaseUrl}/sap/c4c/api/v1/case-service/cases`;
  
  // Case 데이터 구조 (SAP C4C API 스펙에 맞게 조정)
  console.log('Case 생성 시 전달할 noteId:', requestData.noteId);
  
  if (!requestData.noteId || requestData.noteId.trim() === '') {
    throw new Error('Note ID가 비어있습니다. Note 생성이 실패했을 수 있습니다.');
  }
  
  //Todo: accountDisplayId 는 IAS 에서 받은 값 기준으로 나중에는 업데이트 해야함
  // LLM을 사용하여 적절한 코드값 찾기
  const companyCode = requestData.companyCode || 'SKN';
  const esmCodes = await findESMCodes(requestData.title, requestData.content, companyCode);
  
  const casePayload: any = {
    subject: requestData.title,
    caseType: esmCodes.caseType,
    account: {
      displayId: '190010'
    },
    contact: {
      displayId: normalizeDisplayId(requestData.userName)
    },
    origin: 'ZEAR',
    extensions: {
      ZMOD: esmCodes.ZMOD,
      ZSUBCASE: esmCodes.ZSUBCASE
    }
  };
  
  // description 객체에 noteId 추가 (notes 배열이 아님)
  // SAP C4C API는 description.noteId 형식을 사용
  if (requestData.noteId && requestData.noteId.trim() !== '') {
    casePayload.description = {
      noteId: requestData.noteId.trim()
    };
  }
  
  const normalizedDisplayId = normalizeDisplayId(requestData.userName);
  console.log('Case 생성 Payload:', JSON.stringify(casePayload, null, 2));
  console.log('Case 생성 시 사용된 userName (원본):', requestData.userName || '119010 (기본값)');
  console.log('Case 생성 시 사용된 displayId (변환됨):', normalizedDisplayId);
  console.log('Case 생성 시 notes 배열:', JSON.stringify(casePayload.notes, null, 2));
  
  const response = await fetch(caseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'APIKey': 'ZhQTrUa9MULNGxozr2ksCT1RYRZbby11'
    },
    body: JSON.stringify(casePayload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('ESM Case 생성 실패:', response.status, errorText);
    
    // 422 에러이고 Party display ID가 유효하지 않은 경우
    if (response.status === 422) {
      let errorData: any = null;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // JSON 파싱 실패 시 errorText 그대로 사용
      }
      
      const errorMessage = errorData?.error?.message || errorText;
      const displayId = requestData.userName || '119010';
      
      // 에러 메시지에서 displayId 추출 시도 (예: "Party display IDs: [08723] are not valid")
      const displayIdMatch = errorMessage.match(/\[([^\]]+)\]/);
      const extractedDisplayId = displayIdMatch ? displayIdMatch[1] : displayId;
      // "0"으로 시작하는 displayId는 "X"로 변경
      const invalidDisplayId = normalizeDisplayId(extractedDisplayId);
      
      // Party display ID가 유효하지 않다는 에러인 경우
      if (errorMessage.includes('Party display IDs') && errorMessage.includes('not valid')) {
        console.log(`=== ContactPerson이 존재하지 않음 감지 (원본 displayId: ${extractedDisplayId}, 변환된 displayId: ${invalidDisplayId}) ===`);
        console.log('ContactPerson 등록 후 Case 생성을 재시도합니다.');
        
        try {
          // ContactPerson 등록 (변환된 displayId 사용, 이름 정보 전달)
          await createContactPerson(invalidDisplayId, requestData.familyName || undefined);
          
          // ContactPerson 등록 성공 후 Case 생성을 재시도
          // casePayload의 contact.displayId도 변환된 값으로 업데이트
          const retryCasePayload = {
            ...casePayload,
            contact: {
              displayId: invalidDisplayId
            }
          };
          
          console.log('=== Case 생성 재시도 ===');
          console.log('재시도 Case Payload:', JSON.stringify(retryCasePayload, null, 2));
          const retryResponse = await fetch(caseUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/json',
              'APIKey': 'ZhQTrUa9MULNGxozr2ksCT1RYRZbby11'
            },
            body: JSON.stringify(retryCasePayload)
          });
          
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            console.error('ESM Case 생성 재시도 실패:', retryResponse.status, retryErrorText);
            throw new Error(`ESM Case 생성 실패 (재시도 후): ${retryResponse.status} - ${retryErrorText}`);
          }
          
          // 재시도 성공 - 응답 처리
          const retryCaseData = await retryResponse.json() as { value?: { id?: string; displayId?: string }; id?: string; displayId?: string };
          const retryCaseId = retryCaseData.value?.id || retryCaseData.id;
          const retryDisplayId = retryCaseData.value?.displayId || retryCaseData.displayId;
          
          if (!retryCaseId) {
            console.error('Case 응답 데이터 (재시도):', retryCaseData);
            throw new Error('ESM Case ID를 찾을 수 없습니다 (재시도 후). 응답 구조를 확인하세요.');
          }
          
          console.log('=== Case 생성 재시도 성공 ===');
          return {
            caseId: retryCaseId,
            displayId: retryDisplayId || ''
          };
        } catch (contactPersonError) {
          console.error('ContactPerson 등록 또는 Case 재시도 중 오류:', contactPersonError);
          throw new Error(`ContactPerson 등록 또는 Case 재시도 실패: ${contactPersonError instanceof Error ? contactPersonError.message : String(contactPersonError)}`);
        }
      }
    }
    
    // 422 에러가 아니거나 다른 종류의 에러인 경우
    throw new Error(`ESM Case 생성 실패: ${response.status} - ${errorText}`);
  }
  
  const caseData = await response.json() as { value?: { id?: string; displayId?: string }; id?: string; displayId?: string };
  // 응답에서 caseId와 displayId 추출
  const caseId = caseData.value?.id || caseData.id;
  const displayId = caseData.value?.displayId || caseData.displayId;
  
  if (!caseId) {
    console.error('Case 응답 데이터:', caseData);
    throw new Error('ESM Case ID를 찾을 수 없습니다. 응답 구조를 확인하세요.');
  }
  
  return {
    caseId: caseId,
    displayId: displayId || ''
  };
}

// ESM 요청 등록 API (EAR와 유사하지만 SAP Sales Cloud 연동 추가)
router.post('/requests', authenticateToken, upload.array('attachments'), async (req, res) => {
  try {
    const { title, content, template_id, form_data, environment = 'dev' } = req.body;
    const files = req.files as Express.Multer.File[];
    const userEmail = (req as AuthenticatedRequest).user?.email || (req as AuthenticatedRequest).user?.userid;
    
    if (!userEmail) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }
    
    if (!title || !content) {
      return res.status(400).json({ error: '요청 제목과 요청 내용은 필수입니다.' });
    }
    
    console.log('ESM 요청 등록 요청:', { title, content, template_id, filesCount: files?.length || 0, userEmail, environment });
    
    // 템플릿이 제공된 경우에만 템플릿 존재 확인
    let templateName = null;
    if (template_id) {
      const templateResult = DB_TYPE === 'postgres'
        ? await query('SELECT id, template_name FROM ear_request_templates WHERE id = $1', [template_id])
        : await query('SELECT ID as id, TEMPLATE_NAME as template_name FROM EAR.EAR_REQUEST_TEMPLATES WHERE ID = ?', [template_id]);

      const rows = (templateResult as any).rows || templateResult;
      if (rows.length === 0) {
        return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
      }
      
      templateName = rows[0].template_name;
    }
    
    // 첨부파일 정보 처리
    let attachmentsData = null;
    if (files && files.length > 0) {
      console.log('첨부파일 처리 시작:', files.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })));
      attachmentsData = files.map(file => ({
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        data: file.buffer.toString('base64')
      }));
      console.log('첨부파일 처리 완료:', attachmentsData.length, '개 파일');
    } else {
      console.log('첨부파일 없음');
    }
    
    // 1. 먼저 DB에 저장
    let newRequest: any;
    if (DB_TYPE === 'postgres') {
      const result = await query(`
        INSERT INTO esm_requests (
          request_title,
          request_content,
          template_id,
          form_data,
          attachments,
          status,
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, request_title, status, created_at
      `, [
        title,
        content,
        template_id || null,
        form_data ? JSON.stringify(JSON.parse(form_data)) : null,
        attachmentsData ? JSON.stringify(attachmentsData) : null,
        userEmail
      ]);
      newRequest = (result as any).rows[0];
    } else {
      // HANA: EAR 스키마 및 대문자 컬럼 사용
      await query(
        `INSERT INTO EAR.ESM_REQUESTS (
           REQUEST_TITLE,
           REQUEST_CONTENT,
           TEMPLATE_ID,
           FORM_DATA,
           ATTACHMENTS,
           STATUS,
           CREATED_BY,
           CREATED_AT,
           UPDATED_AT
         ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          title,
          content,
          template_id || null,
          form_data ? JSON.stringify(JSON.parse(form_data)) : null,
          attachmentsData ? JSON.stringify(attachmentsData) : null,
          userEmail
        ]
      );
      
      const selectResult = await query(
        `SELECT TOP 1 ID as id, REQUEST_TITLE as request_title, STATUS as status, CREATED_AT as created_at
         FROM EAR.ESM_REQUESTS
         ORDER BY ID DESC`
      );
      newRequest = (selectResult as any).rows?.[0] || (selectResult as any)[0];
    }
    
    console.log('ESM 요청 DB 저장 완료:', { id: newRequest.id, title: newRequest.request_title });
    
    // 2. 사용자 이름 정보 추출 (토큰 및 IAS SCIM API에서)
    let userName = null;
    let userFamilyName = null; // 성 + 이름을 저장할 변수
    
    // 먼저 req.user에서 이름 정보 추출 시도
    const user = (req as AuthenticatedRequest).user;
    const tokenGivenName = user?.givenName;
    const tokenFamilyName = user?.familyName;
    
    // 토큰에서 이름 정보가 있으면 조합
    if (tokenGivenName || tokenFamilyName) {
      const nameParts: string[] = [];
      if (tokenFamilyName) nameParts.push(tokenFamilyName);
      if (tokenGivenName) nameParts.push(tokenGivenName);
      userFamilyName = nameParts.join(' ') || null;
      console.log('토큰에서 추출한 사용자 이름:', userFamilyName);
    }
    
    try {
      // 요청 헤더에서 토큰 추출
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      
      if (token) {
        // 토큰에서 user_uuid 추출
        const decoded = jwt.decode(token, { complete: true }) as any;
        const payload = decoded?.payload;
        
        // user_uuid는 여러 위치에서 찾을 수 있음
        const xsUserAttributes = payload?.['xs.user.attributes'] || {};
        const extAttr = payload?.ext_attr || {};
        const customAttributes = payload?.custom_attributes || {};
        const userAttributes = payload?.user_attributes || {};
        
        const userUuid = 
          xsUserAttributes.user_uuid || 
          extAttr.user_uuid || 
          customAttributes.user_uuid || 
          userAttributes.user_uuid ||
          payload?.user_uuid;
        
        if (userUuid) {
          // IAS SCIM API URL (환경변수에서 가져오거나 기본값 사용)
          const iasBaseUrl = process.env.IAS_BASE_URL || 'https://avbayppic.accounts.ondemand.com';
          const scimUrl = `${iasBaseUrl}/scim/Users/${userUuid}`;
          console.log('IAS SCIM API URL:', scimUrl);
          console.log('IAS Base URL (환경변수):', process.env.IAS_BASE_URL || '기본값(개발서버)');
          
          // Basic 인증을 위한 환경변수 확인
          const iasApiUsername = process.env.IAS_API_USERNAME;
          const iasApiPassword = process.env.IAS_API_PASSWORD;
          
          if (!iasApiUsername || !iasApiPassword) {
            console.warn('IAS SCIM API 호출 실패: IAS_API_USERNAME 또는 IAS_API_PASSWORD 환경변수가 설정되지 않았습니다.');
          } else {
            // Basic 인증 헤더 생성
            const basicAuth = Buffer.from(`${iasApiUsername}:${iasApiPassword}`).toString('base64');
            
            console.log('IAS SCIM API 호출:', { 
              scimUrl, 
              userUuid,
              username: iasApiUsername
            });
            
            const scimResponse = await fetch(scimUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': '*/*',
                'User-Agent': 'Node.js',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
              }
            });
            
            if (scimResponse.ok) {
              const scimData = await scimResponse.json() as any;
              
              // userName 필드 직접 추출 (최상위 레벨)
              userName = scimData?.userName || null;
              
              // SCIM API에서 이름 정보 추출 (여러 형식 지원)
              const scimGivenName = scimData?.name?.givenName || scimData?.givenName || null;
              const scimFamilyName = scimData?.name?.familyName || scimData?.familyName || null;
              
              // SCIM API에서 이름 정보가 있으면 사용 (토큰 정보보다 우선)
              if (scimGivenName || scimFamilyName) {
                const nameParts: string[] = [];
                if (scimFamilyName) nameParts.push(scimFamilyName);
                if (scimGivenName) nameParts.push(scimGivenName);
                userFamilyName = nameParts.join(' ') || null;
                console.log('IAS SCIM API에서 추출한 사용자 이름:', userFamilyName);
              }
              
              console.log('=== IAS SCIM API 응답에서 userName 추출 (ESM 등록) ===');
              console.log('추출된 userName:', userName);
              console.log('추출된 이름 정보:', { givenName: scimGivenName, familyName: scimFamilyName, combined: userFamilyName });
              console.log('=== userName 로그 출력 완료 ===');
              
              if (!userName) {
                console.warn('IAS SCIM API 응답에서 userName을 찾을 수 없습니다. 사용 가능한 필드:', Object.keys(scimData || {}));
              }
            } else {
              const errorText = await scimResponse.text();
              const errorData = errorText ? (() => {
                try {
                  return JSON.parse(errorText);
                } catch {
                  return errorText;
                }
              })() : null;
              
              console.warn('IAS SCIM Users API 호출 실패:', {
                status: scimResponse.status,
                statusText: scimResponse.statusText,
                error: errorData
              });
            }
          }
        } else {
          console.warn('=== user_uuid를 찾을 수 없어 IAS SCIM API 호출을 건너뜁니다 (ESM 등록) ===');
        }
      }
    } catch (scimError: any) {
      console.error('IAS SCIM Users API 호출 오류 (ESM 등록):', scimError?.message || scimError);
      console.error('IAS SCIM API 호출 스택:', scimError?.stack);
      // SCIM API 실패해도 Case 생성은 계속 진행 (기본값 사용)
    }
    
    // 3. SAP ESM에 등록 (Note 먼저 생성, 그 다음 Case 생성)
    let esmNoteId = null;
    let esmCaseId = null;
    let esmCaseDisplayId = null;
    
    try {
      // 3-1. 먼저 Note 생성 (htmlContent 등록)
      const htmlContent = `<p>${content.replace(/\n/g, '<br>')}</p>`;
      esmNoteId = await createESMNote(htmlContent);
      console.log('ESM Note 생성 완료:', { noteId: esmNoteId });
      
      // 3-2. Case 생성 (Note ID, userName 및 이름 정보 포함)
      const user = (req as AuthenticatedRequest).user;
      const companyCode = user?.companyCode || 'SKN';
      const caseResult = await createESMCase({
        title,
        content,
        createdBy: userEmail,
        noteId: esmNoteId,
        userName: userName,
        familyName: userFamilyName,
        companyCode: companyCode
      });
      
      esmCaseId = caseResult.caseId;
      esmCaseDisplayId = caseResult.displayId;
      
      console.log('ESM Case 생성 완료:', { caseId: esmCaseId, displayId: esmCaseDisplayId, userName: userName });
      
      // 4. DB에 ESM 정보 업데이트
      // C4C Base URL (환경변수에서 가져오거나 기본값 사용)
      const c4cBaseUrl = process.env.C4C_BASE_URL || 'https://my1002010.au1.test.crm.cloud.sap';
      const caseDetailUrl = `${c4cBaseUrl}/sap/c4c/api/v1/case-service/cases/${esmCaseId}`;
      
      if (DB_TYPE === 'postgres') {
        await query(
          `UPDATE esm_requests 
           SET sales_cloud_case_id = $1, 
               sales_cloud_case_url = $2, 
               esm_note_id = $3,
               esm_case_display_id = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [
            esmCaseId, 
            caseDetailUrl, 
            esmNoteId,
            esmCaseDisplayId,
            newRequest.id
          ]
        );
      } else {
        await query(
          `UPDATE EAR.ESM_REQUESTS 
           SET SALES_CLOUD_CASE_ID = ?, 
               SALES_CLOUD_CASE_URL = ?, 
               ESM_NOTE_ID = ?,
               ESM_CASE_DISPLAY_ID = ?,
               UPDATED_AT = CURRENT_TIMESTAMP
           WHERE ID = ?`,
          [
            esmCaseId, 
            caseDetailUrl, 
            esmNoteId,
            esmCaseDisplayId,
            newRequest.id
          ]
        );
      }
      
      newRequest.sales_cloud_case_id = esmCaseId;
      newRequest.sales_cloud_case_url = caseDetailUrl;
      newRequest.esm_case_display_id = esmCaseDisplayId;
      newRequest.esm_note_id = esmNoteId;
      
    } catch (esmError) {
      console.error('SAP ESM 등록 오류:', esmError);
      // DB에는 저장되었지만 ESM 연동 실패
      // 사용자에게 경고 메시지와 함께 성공 응답 반환
      return res.json({
        success: true,
        warning: '요청은 저장되었지만 SAP ESM 연동에 실패했습니다.',
        error: esmError instanceof Error ? esmError.message : 'Unknown error',
        request: newRequest
      });
    }
    
    res.json({
      success: true,
      message: 'SAP ESM에 요청이 등록되었습니다.',
      request: newRequest
    });
    
  } catch (error) {
    console.error('ESM 요청 등록 오류:', error);
    res.status(500).json({ error: 'ESM 요청 등록 중 오류가 발생했습니다.' });
  }
});

// ESM 요청 목록 조회 API
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      search, 
      dateFrom, 
      dateTo, 
      page = 1, 
      limit = 20 
    } = req.query;

    if (DB_TYPE === 'postgres') {
      let listQuery = `
        SELECT 
          r.id,
          r.request_title,
          r.request_content,
          r.status,
          r.created_by,
          r.created_at,
          r.updated_at,
          r.sales_cloud_case_id,
          r.sales_cloud_case_url,
          t.template_name
        FROM esm_requests r
        LEFT JOIN ear_request_templates t ON r.template_id = t.id
      `;
      
      let countQuery = 'SELECT COUNT(*) as total FROM esm_requests r';
      
      const queryParams: any[] = [];
      const countParams: any[] = [];
      let paramIndex = 1;
      let countParamIndex = 1;
      let whereConditions: string[] = [];

      if (status) {
        whereConditions.push(`r.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
        countParamIndex++;
      }

      if (search) {
        whereConditions.push(`(r.request_title ILIKE $${paramIndex} OR r.request_content ILIKE $${paramIndex})`);
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm);
        countParams.push(searchTerm);
        paramIndex++;
        countParamIndex++;
      }

      if (dateFrom) {
        whereConditions.push(`r.created_at >= $${paramIndex}`);
        queryParams.push(dateFrom);
        countParams.push(dateFrom);
        paramIndex++;
        countParamIndex++;
      }

      if (dateTo) {
        whereConditions.push(`r.created_at <= $${paramIndex}`);
        queryParams.push(String(dateTo) + ' 23:59:59');
        countParams.push(String(dateTo) + ' 23:59:59');
        paramIndex++;
        countParamIndex++;
      }

      if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        listQuery += whereClause;
        countQuery += whereClause;
      }

      listQuery += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, (Number(page) - 1) * Number(limit));

      const result = await query(listQuery, queryParams);
      const countResult = await query(countQuery, countParams);
      const total = parseInt((countResult as any).rows[0].total);

      return res.json({
        requests: (result as any).rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } else {
      // HANA
      let listQuery = `
        SELECT 
          R.ID as id,
          R.REQUEST_TITLE as request_title,
          R.REQUEST_CONTENT as request_content,
          R.STATUS as status,
          R.CREATED_BY as created_by,
          R.CREATED_AT as created_at,
          R.UPDATED_AT as updated_at,
          R.SALES_CLOUD_CASE_ID as sales_cloud_case_id,
          R.SALES_CLOUD_CASE_URL as sales_cloud_case_url,
          T.TEMPLATE_NAME as template_name
        FROM EAR.ESM_REQUESTS R
        LEFT JOIN EAR.EAR_REQUEST_TEMPLATES T ON R.TEMPLATE_ID = T.ID
      `;

      let countQuery = 'SELECT COUNT(*) as total FROM EAR.ESM_REQUESTS R';

      const queryParams: any[] = [];
      const countParams: any[] = [];
      const whereConditions: string[] = [];

      if (status) {
        whereConditions.push(`R.STATUS = ?`);
        queryParams.push(String(status).toUpperCase());
        countParams.push(String(status).toUpperCase());
      }

      if (search) {
        whereConditions.push('(UPPER(R.REQUEST_TITLE) LIKE ? OR UPPER(R.REQUEST_CONTENT) LIKE ?)');
        const searchTerm = `%${String(search).toUpperCase()}%`;
        queryParams.push(searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm);
      }

      if (dateFrom) {
        whereConditions.push('R.CREATED_AT >= ?');
        queryParams.push(dateFrom);
        countParams.push(dateFrom);
      }

      if (dateTo) {
        whereConditions.push('R.CREATED_AT <= ?');
        const endOfDay = String(dateTo) + ' 23:59:59';
        queryParams.push(endOfDay);
        countParams.push(endOfDay);
      }

      if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        listQuery += whereClause;
        countQuery += whereClause;
      }

      // HANA supports LIMIT ... OFFSET
      listQuery += ' ORDER BY R.CREATED_AT DESC LIMIT ? OFFSET ?';
      queryParams.push(Number(limit), (Number(page) - 1) * Number(limit));

      const result = await query(listQuery, queryParams);
      const countResult = await query(countQuery, countParams);
      const total = parseInt(((countResult as any).rows?.[0] || (countResult as any)[0]).total);

      return res.json({
        requests: (result as any).rows || result,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    }

  } catch (error) {
    console.error('ESM 요청 목록 조회 오류:', error);
    res.status(500).json({ error: 'ESM 요청 목록 조회 중 오류가 발생했습니다.' });
  }
});

// ESM 요청 상세 조회 API
router.get('/requests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (DB_TYPE === 'postgres') {
      const result = await query(`
        SELECT 
          r.*,
          t.template_name,
          t.template_description,
          k.display_name as keyword_display_name
        FROM esm_requests r
        LEFT JOIN ear_request_templates t ON r.template_id = t.id
        LEFT JOIN ear_keywords k ON t.keyword_id = k.id
        WHERE r.id = $1
      `, [id]);

      if ((result as any).rows.length === 0) {
        return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
      }

      const request = (result as any).rows[0];

      // 첨부파일 정보에서 base64 데이터 제거 (용량 때문)
      if (request.attachments) {
        request.attachments = request.attachments.map((file: any) => ({
          name: file.name,
          size: file.size,
          type: file.type
        }));
      }

      return res.json({ request });
    } else {
      // HANA
      const result = await query(
        `SELECT 
          R.*,
          T.TEMPLATE_NAME as template_name,
          T.TEMPLATE_DESCRIPTION as template_description,
          K.DISPLAY_NAME as keyword_display_name
        FROM EAR.ESM_REQUESTS R
        LEFT JOIN EAR.EAR_REQUEST_TEMPLATES T ON R.TEMPLATE_ID = T.ID
        LEFT JOIN EAR.EAR_KEYWORDS K ON T.KEYWORD_ID = K.ID
        WHERE R.ID = ?`,
        [id]
      );

      const rows = (result as any).rows || result;
      if (rows.length === 0) {
        return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
      }

      const request = rows[0];

      // 첨부파일 정보에서 base64 데이터 제거 (용량 때문)
      if (request.attachments) {
        const attachments = typeof request.attachments === 'string' 
          ? JSON.parse(request.attachments) 
          : request.attachments;
        request.attachments = attachments.map((file: any) => ({
          name: file.name,
          size: file.size,
          type: file.type
        }));
      }

      return res.json({ request });
    }

  } catch (error) {
    console.error('ESM 요청 상세 조회 오류:', error);
    res.status(500).json({ error: 'ESM 요청 상세 조회 중 오류가 발생했습니다.' });
  }
});

export default router;

