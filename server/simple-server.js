import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/rag';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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

// 간단한 텍스트 추출 함수
async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'text/plain') {
      return fs.readFileSync(filePath, 'utf-8');
    } else {
      // PDF나 DOCX의 경우 간단한 메시지 반환
      return `[${mimeType} 파일 - 텍스트 추출 기능은 추가 패키지 설치 후 사용 가능]`;
    }
  } catch (error) {
    console.error('텍스트 추출 오류:', error);
    return '[텍스트 추출 실패]';
  }
}

// 파일 업로드 처리
app.post('/api/rag/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;

    console.log('파일 업로드 성공:', {
      originalName,
      mimeType,
      fileSize,
      filePath
    });

    // 텍스트 추출 시도
    const text = await extractTextFromFile(filePath, mimeType);
    const chunks = Math.ceil(text.length / 1000); // 간단한 청크 계산

    res.json({
      success: true,
      message: '파일이 성공적으로 업로드되었습니다.',
      file: {
        name: originalName,
        type: mimeType,
        size: fileSize,
        path: filePath
      },
      chunks: chunks,
      extractedText: text.substring(0, 200) + (text.length > 200 ? '...' : '')
    });

  } catch (error) {
    console.error('문서 업로드 오류:', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: '문서 처리 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
});

// 문서 목록 조회 (임시 데이터)
app.get('/api/rag/documents', (req, res) => {
  res.json({
    documents: [
      {
        id: '1',
        name: 'sample-document.pdf',
        file_type: 'application/pdf',
        file_size: 1024000,
        created_at: '2024-01-15 10:30:00',
        chunk_count: 15
      }
    ]
  });
});

// 문서 삭제
app.delete('/api/rag/document/:id', (req, res) => {
  const documentId = req.params.id;
  console.log('문서 삭제 요청:', documentId);
  
  res.json({ 
    success: true, 
    message: '문서가 성공적으로 삭제되었습니다.' 
  });
});

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 RAG Server running on port ${PORT}`);
  console.log('📝 파일 업로드 기능이 활성화되었습니다.');
  console.log('⚠️  데이터베이스 저장 기능은 PostgreSQL 설정 후 사용 가능합니다.');
});
