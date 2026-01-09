import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, DB_TYPE } from '../db';
import { OpenAI } from 'openai';
import { uploadToObjectStore, downloadFromObjectStore, deleteFromObjectStore, checkObjectStoreConnection } from '../utils/objectStore';
import { authenticateToken, requireAdmin } from '../middleware/auth';
// import { createClient } from 'redis'; // Redis 일시 비활성화

const router = express.Router();

// OpenAI 클라이언트를 lazy loading으로 변경
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Redis 클라이언트 설정 (일시 비활성화)
// let redisClient: any = null;
// let redisConnectionAttempted = false;
// let redisConnectionFailed = false;
// let redisReconnectInterval: NodeJS.Timeout | null = null;
// let lastConnectionAttempt = 0;

// const initRedis = async (forceReconnect = false) => {
//   const now = Date.now();
//   
//   // 20초 이내 재시도 방지 (강제 재연결 제외)
//   if (!forceReconnect && now - lastConnectionAttempt < 20000) {
//     return redisClient;
//   }
//   
//   lastConnectionAttempt = now;
//   
//   try {
//     // 기존 클라이언트가 있으면 정리
//     if (redisClient) {
//       try {
//         await redisClient.disconnect();
//       } catch (e) {
//         // 연결 해제 중 오류는 무시
//       }
//       redisClient = null;
//     }
//     
//     redisClient = createClient({
//       url: 'redis://localhost:6379',
//       socket: {
//         connectTimeout: 5000,
//         lazyConnect: true,
//         reconnectStrategy: (retries) => {
//           // 자동 재연결 비활성화 (수동으로 관리)
//           return false;
//         }
//       }
//     });
//     
//     // 에러 핸들러 설정
//     redisClient.on('error', (err: any) => {
//       console.log('Redis 연결 오류:', err.message);
//       redisConnectionFailed = true;
//       scheduleReconnect();
//     });
//     
//     redisClient.on('end', () => {
//       console.log('Redis 연결 종료');
//       redisConnectionFailed = true;
//       scheduleReconnect();
//     });
//     
//     await redisClient.connect();
//     console.log('Redis 연결 성공');
//     redisConnectionFailed = false;
//     redisConnectionAttempted = true;
//     
//     // 재연결 타이머 정리
//     if (redisReconnectInterval) {
//       clearInterval(redisReconnectInterval);
//       redisReconnectInterval = null;
//     }
//     
//     return redisClient;
//   } catch (error) {
//     console.log('Redis 연결 실패:', error instanceof Error ? error.message : '알 수 없는 오류');
//     redisConnectionFailed = true;
//     redisClient = null;
//     scheduleReconnect();
//     return null;
//   }
// };

// // 재연결 스케줄링
// const scheduleReconnect = () => {
//   if (redisReconnectInterval) {
//     return; // 이미 스케줄된 경우 무시
//   }
//   
//   redisReconnectInterval = setInterval(async () => {
//     if (redisConnectionFailed) {
//       console.log('Redis 재연결 시도...');
//       await initRedis(true);
//     }
//   }, 20000); // 20초마다 재시도
// };

// // Redis 연결 상태 확인
// const checkRedisConnection = async (): Promise<boolean> => {
//   try {
//     if (!redisClient || redisConnectionFailed) {
//       await initRedis();
//     }
//     
//     if (redisClient) {
//       await redisClient.ping();
//       return true;
//     }
//     return false;
//   } catch (error) {
//     redisConnectionFailed = true;
//     scheduleReconnect();
//     return false;
//   }
// };

// 임베딩 데이터를 벡터 형식으로 변환하는 함수
function convertEmbeddingToVector(embedding: any): string {
  if (typeof embedding === 'string') {
    try {
      // JSON 문자열인 경우 파싱
      const parsed = JSON.parse(embedding);
      if (Array.isArray(parsed)) {
        return `[${parsed.join(',')}]`;
      }
    } catch (error) {
      console.log('JSON 파싱 실패:', error);
    }
  } else if (Array.isArray(embedding)) {
    // 이미 배열인 경우
    return `[${embedding.join(',')}]`;
  }
  
  // 기본값으로 빈 벡터 반환
  return '[]';
}

// 파일명 인코딩 처리 함수
function decodeFileName(encodedName: string): string {
  console.log('원본 파일명 (raw):', encodedName);
  console.log('원본 파일명 (bytes):', Buffer.from(encodedName, 'binary').toString('hex'));
  
  try {
    // 방법 1: URL 디코딩
    const urlDecoded = decodeURIComponent(encodedName);
    console.log('URL 디코딩 결과:', urlDecoded);
    return urlDecoded;
  } catch (error) {
    console.log('URL 디코딩 실패:', error);
  }
  
  try {
    // 방법 2: latin1에서 UTF-8로 변환
    const latin1ToUtf8 = Buffer.from(encodedName, 'latin1').toString('utf8');
    console.log('latin1->UTF8 변환 결과:', latin1ToUtf8);
    return latin1ToUtf8;
  } catch (error) {
    console.log('latin1->UTF8 변환 실패:', error);
  }
  
  try {
    // 방법 3: binary에서 UTF-8로 변환
    const binaryToUtf8 = Buffer.from(encodedName, 'binary').toString('utf8');
    console.log('binary->UTF8 변환 결과:', binaryToUtf8);
    return binaryToUtf8;
  } catch (error) {
    console.log('binary->UTF8 변환 실패:', error);
  }
  
  // 모든 시도가 실패하면 원본 반환
  console.log('모든 디코딩 시도 실패, 원본 반환:', encodedName);
  return encodedName;
}

// 파일 업로드 설정 (메모리 스토리지 사용 - Object Store로 업로드)
const storage = multer.memoryStorage();

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

const upload = multer({ 
  storage: storage,
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
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB 제한
  }
});

// 문서 텍스트 추출 함수 (페이지 정보 포함) - Buffer 지원
async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<{ text: string; pageInfo?: any[] }> {
  try {
    if (mimeType === 'text/plain') {
      return { text: buffer.toString('utf-8') };
    } else if (mimeType === 'text/markdown') {
      // Markdown 파일 처리
      return { text: buffer.toString('utf-8') };
    } else if (mimeType === 'application/pdf') {
      // PDF 처리 - 페이지별 텍스트 추출
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      
      // 페이지별 텍스트 추출을 위한 추가 처리
      // pdf-parse는 전체 텍스트만 제공하므로, 페이지 구분을 위해 간단한 추정 사용
      const fullText = data.text;
      const pageCount = data.numpages;
      
      // 페이지별 텍스트를 추정 (실제로는 더 정교한 방법이 필요할 수 있음)
      const pageInfo: any[] = [];
      const textPerPage = Math.ceil(fullText.length / pageCount);
      
      for (let i = 0; i < pageCount; i++) {
        const start = i * textPerPage;
        const end = Math.min((i + 1) * textPerPage, fullText.length);
        const pageText = fullText.slice(start, end);
        
        pageInfo.push({
          pageNumber: i + 1,
          text: pageText,
          startChar: start,
          endChar: end
        });
      }
      
      return { text: fullText, pageInfo };
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // DOCX 처리
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: buffer });
      return { text: result.value };
    }
    throw new Error('지원하지 않는 파일 형식입니다.');
  } catch (error) {
    console.error('텍스트 추출 오류:', error);
    throw error;
  }
}

// 텍스트 정제 함수 - UTF8 인코딩 문제 해결
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    // null 바이트 제거
    .replace(/\0/g, '')
    // 기타 제어 문자 제거 (탭, 줄바꿈, 캐리지 리턴은 유지)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 연속된 공백을 하나로 정리
    .replace(/\s+/g, ' ')
    // 앞뒤 공백 제거
    .trim();
}

// 텍스트를 청크로 분할하는 함수 (파일 타입별 전략)
function splitTextIntoChunks(text: string, mimeType: string, pageInfo?: any[], chunkSize: number = 1000, overlap: number = 200): Array<{ content: string; pageNumber?: number }> {
  const chunks: Array<{ content: string; pageNumber?: number }> = [];
  
  // PDF 파일: 페이지별 chunking
  if (mimeType === 'application/pdf' && pageInfo && pageInfo.length > 0) {
    for (const page of pageInfo) {
      const pageText = page.text || '';
      if (pageText.trim().length > 0) {
        chunks.push({
          content: cleanText(pageText),
          pageNumber: page.pageNumber
        });
      }
    }
    return chunks;
  }
  
  // Markdown 파일: # 기준 섹션 단위 chunking
  if (mimeType === 'text/markdown') {
    const sections = text.split(/(?=^#{1,6}\s)/m);
    
    for (const section of sections) {
      if (section.trim().length > 0) {
        // 섹션이 너무 크면 다시 1000자 단위로 자르기
        if (section.length > chunkSize * 2) {
          const subChunks = splitTextIntoChunksBySize(section, chunkSize, overlap);
          chunks.push(...subChunks);
        } else {
          chunks.push({
            content: cleanText(section),
            pageNumber: undefined
          });
        }
      }
    }
    return chunks;
  }
  
  // TEXT 파일: 1000자 단위 chunking (기본 로직)
  return splitTextIntoChunksBySize(text, chunkSize, overlap);
}

// 사이즈 기반 청킹 (TEXT 파일용)
function splitTextIntoChunksBySize(text: string, chunkSize: number = 1000, overlap: number = 200): Array<{ content: string; pageNumber?: number }> {
  const chunks: Array<{ content: string; pageNumber?: number }> = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);
    
    // 문장 경계에서 자르기 시도
    if (end < text.length) {
      const lastSentenceEnd = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const cutPoint = Math.max(lastSentenceEnd, lastNewline);
      
      if (cutPoint > start + chunkSize * 0.5) {
        chunk = chunk.slice(0, cutPoint + 1);
        start = start + cutPoint + 1 - overlap;
      } else {
        start = end - overlap;
      }
    } else {
      start = end;
    }
    
    if (chunk.trim().length > 0) {
      chunks.push({
        content: cleanText(chunk),
        pageNumber: undefined
      });
    }
  }
  
  return chunks;
}

// OpenAI를 사용한 임베딩 생성
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log('임베딩 생성 시작:', text.substring(0, 100) + '...');
    
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });
    
    console.log('임베딩 생성 완료, 차원:', response.data[0].embedding.length);
    return response.data[0].embedding;
  } catch (error) {
    console.error('임베딩 생성 오류:', error);
    throw error;
  }
}

// 문서 업로드 및 데이터베이스 저장
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  let objectStorePath = '';
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    const useRedis = req.body.useRedis === 'true';
    
    // Redis 선택 시 연결 상태 확인 (일시 비활성화)
    // if (useRedis) {
    //   const redisConnected = await checkRedisConnection();
    //   if (!redisConnected) {
    //     return res.status(400).json({ 
    //       error: 'Redis 서비스가 실행되지 않았습니다. localhost:6379에서 Redis 서비스를 시작해주세요.' 
    //     });
    //   }
    // }

    // 프론트엔드에서 별도로 전송한 파일명 사용 (우선순위)
    let originalName = req.body.originalName;
    
    // Base64로 인코딩된 파일명 디코딩
    if (originalName) {
      try {
        originalName = Buffer.from(originalName, 'base64').toString('utf8');
        // 파일명도 정제
        originalName = cleanText(originalName);
        console.log('Base64 디코딩된 파일명:', originalName);
      } catch (error) {
        console.log('Base64 디코딩 실패, 원본 사용:', originalName);
        // 디코딩 실패 시에도 정제 적용
        originalName = cleanText(originalName);
      }
    }
    
    // 별도 파일명이 없으면 multer에서 받은 파일명 디코딩 시도
    if (!originalName) {
      originalName = decodeFileName(req.file.originalname);
      // 파일명 정제
      originalName = cleanText(originalName);
    }
    
    let mimeType = req.file.mimetype;
    const fileSize = req.file.size;
    const fileBuffer = req.file.buffer;

    console.log('파일 업로드 시작:', {
      originalName,
      mimeType,
      fileSize
    });

    // MD 파일의 경우 mimetype이 올바르게 감지되지 않을 수 있으므로 수동 체크
    if (originalName.toLowerCase().endsWith('.md') && mimeType === 'application/octet-stream') {
      mimeType = 'text/markdown';
      console.log('MD 파일 감지, MIME 타입 변경:', mimeType);
    }

    // Object Store에 업로드할 파일명 생성
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const safeName = baseName.replace(/[^a-zA-Z0-9가-힣\s]/g, '_');
    const finalFileName = `${safeName}-${uniqueSuffix}${extension}`;

    // Object Store에 업로드
    try {
      objectStorePath = await uploadToObjectStore(finalFileName, fileBuffer, mimeType);
      console.log('Object Store 업로드 완료:', objectStorePath);
    } catch (error) {
      console.error('Object Store 업로드 실패:', error);
      throw new Error('Object Store 업로드에 실패했습니다.');
    }

    // 텍스트 추출
    let text = '';
    let pageInfo: any[] | undefined;
    try {
      const extractResult = await extractTextFromFile(fileBuffer, mimeType);
      text = extractResult.text;
      pageInfo = extractResult.pageInfo;
      // 텍스트 정제 (UTF8 인코딩 문제 해결)
      text = cleanText(text);
    } catch (error) {
      console.error('텍스트 추출 실패:', error);
      // 텍스트 추출 실패 시에도 파일 정보는 저장
      text = `[텍스트 추출 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}]`;
    }
    
    if (!text || text.trim().length === 0) {
      text = '[빈 문서]';
    }

    // 텍스트를 청크로 분할 (파일 타입별 전략)
    const chunks = splitTextIntoChunks(text, mimeType, pageInfo);
    
    // 문서 정보를 데이터베이스에 저장
    let documentId: number;
    if (DB_TYPE === 'postgres') {
      const documentResult: any = await query(
        'INSERT INTO rag_documents (name, file_path, file_type, file_size, text_content, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
        [originalName, objectStorePath, mimeType, fileSize, text]
      );
      documentId = documentResult.rows[0].id;
    } else {
      await query(
        'INSERT INTO EAR.RAG_DOCUMENTS (NAME, FILE_PATH, FILE_TYPE, FILE_SIZE, TEXT_CONTENT, CREATED_AT) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [originalName, objectStorePath, mimeType, fileSize, text]
      );
      const sel: any = await query('SELECT TOP 1 ID FROM EAR.RAG_DOCUMENTS ORDER BY ID DESC');
      documentId = sel.rows?.[0]?.id || sel[0]?.id;
    }
    
    // 각 청크에 대해 임베딩 생성 및 저장
    for (let i = 0; i < chunks.length; i++) {
      const chunkData = chunks[i];
      const chunk = chunkData.content;
      const pageNumber = chunkData.pageNumber;
      
      try {
        // 임베딩 생성
        const embedding = await generateEmbedding(chunk);
        
        // Redis 저장 로직 일시 비활성화, PostgreSQL만 사용
        // if (useRedis && redisClient) {
        //   // Redis에 저장
        //   const chunkKey = `rag:document:${documentId}:chunk:${i}`;
        //   const chunkData = {
        //     document_id: documentId,
        //     chunk_index: i,
        //     content: chunk,
        //     embedding: JSON.stringify(embedding),
        //     created_at: new Date().toISOString()
        //   };
        //   
        //   await redisClient.hSet(chunkKey, chunkData);
        //   console.log(`청크 ${i + 1}/${chunks.length} Redis 저장 완료`);
        // } else {
          // PostgreSQL에 저장
          if (DB_TYPE === 'postgres') {
            await query(
              'INSERT INTO rag_chunks (document_id, chunk_index, content, embedding, page_number, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
              [documentId, i, chunk, JSON.stringify(embedding), pageNumber]
            );
          } else {
            await query(
              'INSERT INTO EAR.RAG_CHUNKS (DOCUMENT_ID, CHUNK_INDEX, CONTENT, EMBEDDING, PAGE_NUMBER, CREATED_AT) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [documentId, i, chunk, JSON.stringify(embedding), pageNumber]
            );
          }
          console.log(`청크 ${i + 1}/${chunks.length} 저장 완료`);
        // }
      } catch (error) {
        console.error(`청크 ${i + 1} 임베딩 생성 실패:`, error);
        // 임베딩 생성 실패 시에도 청크는 저장 (임베딩 없이)
        // Redis 저장 로직 일시 비활성화
        // if (useRedis && redisClient) {
        //   const chunkKey = `rag:document:${documentId}:chunk:${i}`;
        //   const chunkData = {
        //     document_id: documentId,
        //     chunk_index: i,
        //     content: chunk,
        //     created_at: new Date().toISOString()
        //   };
        //   await redisClient.hSet(chunkKey, chunkData);
        // } else {
          if (DB_TYPE === 'postgres') {
            await query(
              'INSERT INTO rag_chunks (document_id, chunk_index, content, page_number, created_at) VALUES ($1, $2, $3, $4, NOW())',
              [documentId, i, chunk, pageNumber]
            );
          } else {
            await query(
              'INSERT INTO EAR.RAG_CHUNKS (DOCUMENT_ID, CHUNK_INDEX, CONTENT, PAGE_NUMBER, CREATED_AT) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [documentId, i, chunk, pageNumber]
            );
          }
        // }
      }
    }

    console.log('문서 저장 완료:', {
      documentId,
      chunks: chunks.length
    });

    res.json({
      success: true,
      documentId: documentId,
      chunks: chunks.length,
      storage: 'Object Store',
      message: `문서가 성공적으로 처리되었습니다.`
    });

  } catch (error) {
    console.error('문서 업로드 오류:', error);
    
    // 오류 발생 시 업로드된 파일 삭제 (Object Store에서)
    if (req.file && objectStorePath) {
      try {
        await deleteFromObjectStore(objectStorePath);
        console.log('Object Store에서 파일 삭제 완료');
      } catch (deleteError) {
        console.error('Object Store 파일 삭제 실패:', deleteError);
      }
    }
    
    res.status(500).json({ 
      error: '문서 처리 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
});

// 문서 목록 조회
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    if (DB_TYPE === 'postgres') {
      const result: any = await query(`
        SELECT 
          d.id,
          d.name,
          d.file_type,
          d.file_size,
          d.created_at,
          COUNT(c.id) as chunk_count
        FROM rag_documents d
        LEFT JOIN rag_chunks c ON d.id = c.document_id
        GROUP BY d.id, d.name, d.file_type, d.file_size, d.created_at
        ORDER BY d.created_at DESC
      `);
      return res.json({ documents: result.rows });
    } else {
      const result: any = await query(`
        SELECT 
          D.ID as id,
          D.NAME as name,
          D.FILE_TYPE as file_type,
          D.FILE_SIZE as file_size,
          D.CREATED_AT as created_at,
          (SELECT COUNT(*) FROM EAR.RAG_CHUNKS C WHERE C.DOCUMENT_ID = D.ID) as chunk_count
        FROM EAR.RAG_DOCUMENTS D
        ORDER BY D.CREATED_AT DESC`);
      return res.json({ documents: result.rows || result });
    }
  } catch (error) {
    console.error('문서 목록 조회 오류:', error);
    res.status(500).json({ error: '문서 목록을 조회할 수 없습니다.' });
  }
});

// 파일 경로로 문서 ID 조회 (로컬 경로 및 Object Store URL 지원)
router.post('/document-by-path', authenticateToken, async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: '파일 경로가 필요합니다.' });
    }
    
    console.log('문서 조회 요청, filePath:', filePath);
    
    // Object Store URL(s3://...)을 처리
    // s3://bucket-name/rag-documents/filename.ext 형식
    let searchPath = filePath;
    
    // s3:// URL인 경우 전체 경로로 조회
    // 로컬 파일 경로인 경우 파일명만 추출하여 조회 시도
    if (!filePath.startsWith('s3://')) {
      // 로컬 파일 경로인 경우 파일명만 추출
      const path = require('path');
      const fileName = path.basename(filePath);
      console.log('로컬 파일 경로로 인식, 파일명:', fileName);
      
      // 파일명으로 검색 (LIKE 사용)
      const result: any = DB_TYPE === 'postgres'
        ? await query('SELECT id FROM rag_documents WHERE file_path LIKE $1', [`%${fileName}%`])
        : await query('SELECT ID as id FROM EAR.RAG_DOCUMENTS WHERE FILE_PATH LIKE ?', [`%${fileName}%`]);
      
      if (result.rows && result.rows.length > 0) {
        return res.json({ documentId: result.rows[0].id });
      }
    }
    
    // 전체 경로로 조회
    const result: any = DB_TYPE === 'postgres'
      ? await query('SELECT id FROM rag_documents WHERE file_path = $1', [filePath])
      : await query('SELECT ID as id FROM EAR.RAG_DOCUMENTS WHERE FILE_PATH = ?', [filePath]);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
    }
    
    res.json({ documentId: result.rows[0].id });
  } catch (error) {
    console.error('문서 ID 조회 오류:', error);
    res.status(500).json({ error: '문서 ID를 조회할 수 없습니다.' });
  }
});

// 문서 내용 조회
router.get('/document/:id', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.id;
    
    const result: any = DB_TYPE === 'postgres' ? await query(`
      SELECT 
        d.id,
        d.name,
        d.file_type,
        d.file_size,
        d.text_content,
        d.created_at
      FROM rag_documents d
      WHERE d.id = $1
    `, [documentId]) : await query(`
      SELECT 
        D.ID as id,
        D.NAME as name,
        D.FILE_TYPE as file_type,
        D.FILE_SIZE as file_size,
        D.TEXT_CONTENT as text_content,
        D.CREATED_AT as created_at
      FROM EAR.RAG_DOCUMENTS D
      WHERE D.ID = ?
    `, [documentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
    }
    
    const document = result.rows[0];
    
    // 청크 정보도 함께 조회
    const chunksResult: any = DB_TYPE === 'postgres' ? await query(`
      SELECT 
        c.id,
        c.chunk_index,
        c.content,
        c.created_at
      FROM rag_chunks c
      WHERE c.document_id = $1
      ORDER BY c.chunk_index
    `, [documentId]) : await query(`
      SELECT 
        C.ID as id,
        C.CHUNK_INDEX as chunk_index,
        C.CONTENT as content,
        C.CREATED_AT as created_at
      FROM EAR.RAG_CHUNKS C
      WHERE C.DOCUMENT_ID = ?
      ORDER BY C.CHUNK_INDEX
    `, [documentId]);
    
    res.json({ 
      document: {
        ...document,
        chunks: chunksResult.rows
      }
    });
  } catch (error) {
    console.error('문서 내용 조회 오류:', error);
    res.status(500).json({ error: '문서 내용을 조회할 수 없습니다.' });
  }
});

// 원본 파일 다운로드/뷰어
router.get('/download/:id', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.id;
    
    const result: any = DB_TYPE === 'postgres' ? await query(`
      SELECT 
        d.name,
        d.file_path,
        d.file_type
      FROM rag_documents d
      WHERE d.id = $1
    `, [documentId]) : await query(`
      SELECT 
        D.NAME as name,
        D.FILE_PATH as file_path,
        D.FILE_TYPE as file_type
      FROM EAR.RAG_DOCUMENTS D
      WHERE D.ID = ?
    `, [documentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
    }
    
    const document = result.rows[0];
    
    // Object Store에서 파일 다운로드
    let fileBuffer: Buffer;
    try {
      fileBuffer = await downloadFromObjectStore(document.file_path);
    } catch (error) {
      console.error('Object Store 다운로드 실패:', error);
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }
    
    // PDF 파일인 경우 브라우저에서 표시, 다른 파일은 다운로드
    if (document.file_type === 'application/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.name)}"`);
    } else {
      res.setHeader('Content-Type', document.file_type);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.name)}"`);
    }
    
    // 파일 전송
    res.send(fileBuffer);
    
  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    res.status(500).json({ error: '파일 다운로드 중 오류가 발생했습니다.' });
  }
});

// 문서 삭제
router.delete('/document/:id', requireAdmin, async (req, res) => {
  try {
    const documentId = req.params.id;
    
    console.log('문서 삭제 요청:', documentId, '타입:', typeof documentId);
    
    // documentId가 숫자인지 확인
    const numericId = parseInt(documentId);
    if (isNaN(numericId)) {
      return res.status(400).json({ error: '잘못된 문서 ID입니다.' });
    }
    
    // 문서와 관련된 청크들 삭제
    if (DB_TYPE === 'postgres') {
      await query('DELETE FROM rag_chunks WHERE document_id = $1', [numericId]);
    } else {
      await query('DELETE FROM EAR.RAG_CHUNKS WHERE DOCUMENT_ID = ?', [numericId]);
    }
    
    // 문서 정보 조회 (파일 경로 확인)
    const docResult: any = DB_TYPE === 'postgres'
      ? await query('SELECT file_path FROM rag_documents WHERE id = $1', [numericId])
      : await query('SELECT FILE_PATH as file_path FROM EAR.RAG_DOCUMENTS WHERE ID = ?', [numericId]);
    
    // 문서 삭제
    const result: any = DB_TYPE === 'postgres'
      ? await query('DELETE FROM rag_documents WHERE id = $1', [numericId])
      : await query('DELETE FROM EAR.RAG_DOCUMENTS WHERE ID = ?', [numericId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
    }
    
    // Object Store에서 파일 삭제
    if (docResult.rows.length > 0 && docResult.rows[0].file_path) {
      try {
        await deleteFromObjectStore(docResult.rows[0].file_path);
        console.log('Object Store에서 파일 삭제 완료');
      } catch (deleteError) {
        console.error('Object Store 파일 삭제 실패:', deleteError);
        // Object Store 삭제 실패해도 DB는 삭제되었으므로 계속 진행
      }
    }
    
    res.json({ 
      success: true, 
      message: '문서가 성공적으로 삭제되었습니다.' 
    });
  } catch (error) {
    console.error('문서 삭제 오류:', error);
    res.status(500).json({ error: '문서 삭제 중 오류가 발생했습니다.' });
  }
});

// 벡터 검색 API
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: '검색 쿼리가 필요합니다.' });
    }
    
    console.log('벡터 검색 시작:', query);
    
    // 먼저 임베딩이 있는 청크가 있는지 확인
    const embeddingCheck: any = DB_TYPE === 'postgres'
      ? await query('SELECT COUNT(*) as count FROM rag_chunks WHERE embedding IS NOT NULL')
      : await query('SELECT COUNT(*) as count FROM EAR.RAG_CHUNKS WHERE EMBEDDING IS NOT NULL');
    console.log('임베딩이 있는 청크 수:', (embeddingCheck as any).rows?.[0]?.count || (embeddingCheck as any)[0]?.count);
    
    const count = (embeddingCheck as any).rows?.[0]?.count || (embeddingCheck as any)[0]?.count;
    if (!count || count === 0) {
      return res.json({
        error: '임베딩이 생성된 청크가 없습니다. 문서를 다시 업로드해주세요.',
        results: [],
        query: query,
        total: 0
      });
    }
    
    // 검색 쿼리의 임베딩 생성
    const queryEmbedding = await generateEmbedding(query);
    console.log('질문 임베딩 생성 완료, 차원:', queryEmbedding.length);
    
    // 벡터 유사도 검색
    console.log('검색 쿼리 실행 전...');
    console.log('질문 임베딩 길이:', queryEmbedding.length);
    console.log('질문 임베딩 샘플:', queryEmbedding.slice(0, 5));
    
    // 임베딩을 벡터 형식으로 변환
    const queryVector = convertEmbeddingToVector(queryEmbedding);
    console.log('변환된 질문 벡터 샘플:', queryVector.substring(0, 100) + '...');
    
    let result: any;
    if (DB_TYPE === 'postgres') {
      result = await query(`
        SELECT 
          c.id,
          c.content,
          c.chunk_index,
          c.page_number,
          d.name as document_name,
          d.file_type,
          1 - (c.embedding <=> $1::vector) as similarity
        FROM rag_chunks c
        JOIN rag_documents d ON c.document_id = d.id
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> $1::vector
        LIMIT $2
      `, [queryVector, limit]);
    } else {
      // HANA: 임베딩은 NCLOB(JSON 배열). 코사인 유사도 사용자 정의 계산 (간단한 dot product/length 근사)
      // 파라미터 바인딩 길이 제약을 피하기 위해 상위 200차원만 사용
      const embeddingArray = JSON.parse(queryVector);
      const dims = embeddingArray.slice(0, 200);
      const params: any[] = dims;
      const sumSquares = dims.reduce((s: number, v: number) => s + v * v, 0);
      const norm = Math.sqrt(sumSquares) || 1;

      // 각 행의 임베딩을 파싱하여 dot product를 계산하는 SQL 구성
      const dotTerms = dims.map((_: any, idx: number) => {
        // JSON_ARRAYAT(TO_NVARCHAR(EMBEDDING), idx) 는 0-based 인덱스, 숫자로 캐스트
        return `TO_DOUBLE(JSON_QUERY(TO_NVARCHAR(EMBEDDING), '$[${idx}]')) * ?`;
      }).join(' + ');

      const sql = `
        SELECT TOP ${Number(limit)} 
          C.ID as id,
          C.CONTENT as content,
          C.CHUNK_INDEX as chunk_index,
          C.PAGE_NUMBER as page_number,
          D.NAME as document_name,
          D.FILE_TYPE as file_type,
          (${dotTerms}) / ${norm} as similarity
        FROM EAR.RAG_CHUNKS C
        JOIN EAR.RAG_DOCUMENTS D ON C.DOCUMENT_ID = D.ID
        WHERE C.EMBEDDING IS NOT NULL
        ORDER BY similarity DESC`;

      result = await query(sql, params);
    }
    
    console.log('검색 쿼리 실행 완료');
    console.log('원시 결과:', (result as any).rows || result);
    
    const rows = (result as any).rows || result;
    console.log('벡터 검색 완료, 결과 수:', rows.length);
    
    res.json({ 
      results: rows,
      query: query,
      total: rows.length
    });
  } catch (error) {
    console.error('벡터 검색 오류:', error);
    res.status(500).json({ error: '벡터 검색 중 오류가 발생했습니다.' });
  }
});

// 디버깅용 데이터베이스 상태 확인 API
router.get('/debug', requireAdmin, async (req, res) => {
  try {
    console.log('디버깅 정보 조회 시작...');
    
    // pgvector 확장 확인 (PostgreSQL만)
    try {
      if (DB_TYPE === 'postgres') {
        const vectorCheck: any = await query('SELECT * FROM pg_extension WHERE extname = \'vector\'');
        console.log('pgvector 확장 상태:', vectorCheck.rows.length > 0 ? '설치됨' : '설치되지 않음');
      } else {
        console.log('pgvector 확장 상태: HANA DB 사용 중');
      }
    } catch (error: any) {
      console.log('pgvector 확장 확인 실패:', error.message);
    }
    
    // 벡터 컬럼 타입 확인 (PostgreSQL만)
    try {
      if (DB_TYPE === 'postgres') {
        const columnInfo: any = await query(`
          SELECT column_name, data_type, udt_name 
          FROM information_schema.columns 
          WHERE table_name = 'rag_chunks' AND column_name = 'embedding'
        `);
        console.log('embedding 컬럼 정보:', columnInfo.rows);
      } else {
        console.log('embedding 컬럼 정보: HANA DB - NCLOB 타입');
      }
    } catch (error: any) {
      console.log('컬럼 정보 확인 실패:', error.message);
    }
    
    // 총 문서 수
    const docCount: any = DB_TYPE === 'postgres'
      ? await query('SELECT COUNT(*) as count FROM rag_documents')
      : await query('SELECT COUNT(*) as count FROM EAR.RAG_DOCUMENTS');
    console.log('총 문서 수:', (docCount as any).rows?.[0]?.count || (docCount as any)[0]?.count);
    
    // 총 청크 수
    const chunkCount: any = DB_TYPE === 'postgres'
      ? await query('SELECT COUNT(*) as count FROM rag_chunks')
      : await query('SELECT COUNT(*) as count FROM EAR.RAG_CHUNKS');
    console.log('총 청크 수:', (chunkCount as any).rows?.[0]?.count || (chunkCount as any)[0]?.count);
    
    // 임베딩이 있는 청크 수
    const embeddingCount: any = DB_TYPE === 'postgres'
      ? await query('SELECT COUNT(*) as count FROM rag_chunks WHERE embedding IS NOT NULL')
      : await query('SELECT COUNT(*) as count FROM EAR.RAG_CHUNKS WHERE EMBEDDING IS NOT NULL');
    console.log('임베딩이 있는 청크 수:', (embeddingCount as any).rows?.[0]?.count || (embeddingCount as any)[0]?.count);
    
    // 임베딩 데이터 타입 확인 (PostgreSQL만)
    try {
      if (DB_TYPE === 'postgres') {
        const embeddingSample: any = await query(`
          SELECT id, pg_typeof(embedding) as embedding_type, 
                 CASE WHEN embedding IS NOT NULL THEN 'NOT NULL' ELSE 'NULL' END as null_status
          FROM rag_chunks 
          WHERE embedding IS NOT NULL 
          LIMIT 1
        `);
        console.log('임베딩 샘플 타입:', embeddingSample.rows);
      } else {
        console.log('임베딩 샘플 타입: HANA DB - NCLOB (JSON 배열)');
      }
    } catch (error: any) {
      console.log('임베딩 타입 확인 실패:', error.message);
    }
    
    // 최근 문서들
    const recentDocs: any = DB_TYPE === 'postgres' ? await query(`
      SELECT d.name, d.created_at, COUNT(c.id) as chunk_count, COUNT(c.embedding) as embedding_count
      FROM rag_documents d
      LEFT JOIN rag_chunks c ON d.id = c.document_id
      GROUP BY d.id, d.name, d.created_at
      ORDER BY d.created_at DESC
      LIMIT 5
    `) : await query(`
      SELECT TOP 5
        D.NAME as name, 
        D.CREATED_AT as created_at,
        (SELECT COUNT(*) FROM EAR.RAG_CHUNKS C WHERE C.DOCUMENT_ID = D.ID) as chunk_count,
        (SELECT COUNT(*) FROM EAR.RAG_CHUNKS C WHERE C.DOCUMENT_ID = D.ID AND C.EMBEDDING IS NOT NULL) as embedding_count
      FROM EAR.RAG_DOCUMENTS D
      ORDER BY D.CREATED_AT DESC
    `);
    
    console.log('최근 문서들:', (recentDocs as any).rows || recentDocs);
    
    // 샘플 청크 내용 확인
    const sampleChunks: any = DB_TYPE === 'postgres' ? await query(`
      SELECT c.id, c.content, c.embedding IS NOT NULL as has_embedding, d.name as doc_name
      FROM rag_chunks c
      JOIN rag_documents d ON c.document_id = d.id
      ORDER BY c.created_at DESC
      LIMIT 3
    `) : await query(`
      SELECT TOP 3
        C.ID as id, 
        C.CONTENT as content, 
        CASE WHEN C.EMBEDDING IS NOT NULL THEN 1 ELSE 0 END as has_embedding, 
        D.NAME as doc_name
      FROM EAR.RAG_CHUNKS C
      JOIN EAR.RAG_DOCUMENTS D ON C.DOCUMENT_ID = D.ID
      ORDER BY C.CREATED_AT DESC
    `);
    
    console.log('샘플 청크들:', (sampleChunks as any).rows || sampleChunks);
    
    res.json({
      documents: {
        total: (docCount as any).rows?.[0]?.count || (docCount as any)[0]?.count,
        recent: (recentDocs as any).rows || recentDocs
      },
      chunks: {
        total: (chunkCount as any).rows?.[0]?.count || (chunkCount as any)[0]?.count,
        withEmbedding: (embeddingCount as any).rows?.[0]?.count || (embeddingCount as any)[0]?.count
      },
      sampleChunks: (sampleChunks as any).rows || sampleChunks
    });
  } catch (error) {
    console.error('디버깅 정보 조회 오류:', error);
    res.status(500).json({ error: '디버깅 정보 조회 중 오류가 발생했습니다.' });
  }
});

// 기존 청크에 임베딩 생성 API
router.post('/generate-embeddings', requireAdmin, async (req, res) => {
  try {
    console.log('기존 청크에 임베딩 생성 시작...');
    
    // 임베딩이 없는 청크들 조회
    const chunksWithoutEmbedding: any = DB_TYPE === 'postgres' ? await query(`
      SELECT c.id, c.content, c.document_id, c.chunk_index
      FROM rag_chunks c
      WHERE c.embedding IS NULL
      ORDER BY c.id
    `) : await query(`
      SELECT C.ID as id, C.CONTENT as content, C.DOCUMENT_ID as document_id, C.CHUNK_INDEX as chunk_index
      FROM EAR.RAG_CHUNKS C
      WHERE C.EMBEDDING IS NULL
      ORDER BY C.ID
    `);
    
    console.log('임베딩이 없는 청크 수:', (chunksWithoutEmbedding as any).rows?.length || (chunksWithoutEmbedding as any).length);
    
    if ((chunksWithoutEmbedding as any).rows?.length === 0 || (chunksWithoutEmbedding as any).length === 0) {
      return res.json({
        message: '모든 청크에 임베딩이 이미 생성되어 있습니다.',
        processed: 0
      });
    }
    
    let processed = 0;
    let failed = 0;
    
    const chunks = (chunksWithoutEmbedding as any).rows || chunksWithoutEmbedding;
    
    for (const chunk of chunks) {
      try {
        console.log(`청크 ${chunk.id} 임베딩 생성 중...`);
        
        // 임베딩 생성
        const embedding = await generateEmbedding(chunk.content);
        
        // 데이터베이스에 임베딩 저장
        if (DB_TYPE === 'postgres') {
          await query(
            'UPDATE rag_chunks SET embedding = $1 WHERE id = $2',
            [JSON.stringify(embedding), chunk.id]
          );
        } else {
          await query(
            'UPDATE EAR.RAG_CHUNKS SET EMBEDDING = ? WHERE ID = ?',
            [JSON.stringify(embedding), chunk.id]
          );
        }
        
        processed++;
        console.log(`청크 ${chunk.id} 임베딩 생성 완료`);
        
        // API 호출 제한을 고려하여 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`청크 ${chunk.id} 임베딩 생성 실패:`, error);
        failed++;
      }
    }
    
    console.log(`임베딩 생성 완료: 성공 ${processed}개, 실패 ${failed}개`);
    
    res.json({
      message: '임베딩 생성 완료',
      processed: processed,
      failed: failed,
      total: chunks.length
    });
    
  } catch (error) {
    console.error('임베딩 생성 오류:', error);
    res.status(500).json({ error: '임베딩 생성 중 오류가 발생했습니다.' });
  }
});

// 임베딩 데이터 형식 변환 API
router.post('/fix-embeddings', requireAdmin, async (req, res) => {
  try {
    console.log('임베딩 데이터 형식 변환 시작...');
    
    // 모든 임베딩 데이터 조회
    const allEmbeddings: any = DB_TYPE === 'postgres' ? await query(`
      SELECT id, embedding, content
      FROM rag_chunks 
      WHERE embedding IS NOT NULL
      ORDER BY id
    `) : await query(`
      SELECT ID as id, EMBEDDING as embedding, CONTENT as content
      FROM EAR.RAG_CHUNKS 
      WHERE EMBEDDING IS NOT NULL
      ORDER BY ID
    `);
    
    console.log('변환할 임베딩 수:', (allEmbeddings as any).rows?.length || (allEmbeddings as any).length);
    
    let converted = 0;
    let failed = 0;
    
    const embeddings = (allEmbeddings as any).rows || allEmbeddings;
    
    for (const row of embeddings) {
      try {
        let embeddingData = row.embedding;
        
        // 이미 올바른 형식인지 확인
        if (typeof embeddingData === 'string' && embeddingData.startsWith('[') && embeddingData.endsWith(']')) {
          console.log(`청크 ${row.id}: 이미 올바른 형식`);
          continue;
        }
        
        // JSON 문자열인 경우 파싱
        if (typeof embeddingData === 'string') {
          try {
            embeddingData = JSON.parse(embeddingData);
          } catch (error) {
            console.log(`청크 ${row.id}: JSON 파싱 실패, 건너뜀`);
            failed++;
            continue;
          }
        }
        
        // 배열인 경우 벡터 형식으로 변환
        if (Array.isArray(embeddingData)) {
          const vectorFormat = `[${embeddingData.join(',')}]`;
          
          // 데이터베이스 업데이트
          if (DB_TYPE === 'postgres') {
            await query(
              'UPDATE rag_chunks SET embedding = $1 WHERE id = $2',
              [vectorFormat, row.id]
            );
          } else {
            await query(
              'UPDATE EAR.RAG_CHUNKS SET EMBEDDING = ? WHERE ID = ?',
              [vectorFormat, row.id]
            );
          }
          
          converted++;
          console.log(`청크 ${row.id}: 변환 완료`);
        } else {
          console.log(`청크 ${row.id}: 배열이 아님, 건너뜀`);
          failed++;
        }
        
      } catch (error) {
        console.error(`청크 ${row.id} 변환 실패:`, error);
        failed++;
      }
    }
    
    console.log(`임베딩 변환 완료: 성공 ${converted}개, 실패 ${failed}개`);
    
    res.json({
      message: '임베딩 데이터 형식 변환 완료',
      converted: converted,
      failed: failed,
      total: embeddings.length
    });
    
  } catch (error) {
    console.error('임베딩 변환 오류:', error);
    res.status(500).json({ error: '임베딩 변환 중 오류가 발생했습니다.' });
  }
});

// Redis 연결 상태 확인 API (일시 비활성화)
router.get('/redis-status', requireAdmin, async (req, res) => {
  try {
    // const connected = await checkRedisConnection();
    // res.json({ connected });
    res.json({ connected: false }); // Redis 비활성화 상태 반환
  } catch (error) {
    // 에러 로그는 이미 checkRedisConnection에서 처리됨
    res.json({ connected: false });
  }
});

// 데이터베이스 연결 상태 확인 API
router.get('/db-status', requireAdmin, async (req, res) => {
  try {
    const testQuery = DB_TYPE === 'postgres' ? 'SELECT 1' : 'SELECT 1 FROM DUMMY';
    await query(testQuery);
    res.json({ connected: true, dbType: DB_TYPE });
  } catch (error) {
    res.json({ connected: false, dbType: DB_TYPE });
  }
});

export default router;