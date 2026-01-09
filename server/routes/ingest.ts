import express from 'express';
import multer from 'multer';
import path from 'path';
import { processDocument } from '../rag';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 파일 업로드 설정

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
  }
});

// 텍스트 파일 처리
const processTextFile = (buffer: Buffer, filename: string): { title: string; content: string } => {
  const content = buffer.toString('utf-8');
  const title = filename.replace(/\.[^/.]+$/, ''); // 확장자 제거
  
  return { title, content };
};

// PDF 파일 처리
const processPdfFile = async (buffer: Buffer, filename: string): Promise<{ title: string; content: string }> => {
  try {
    const data = await pdf(buffer);
    const title = filename.replace(/\.[^/.]+$/, '');
    
    return { title, content: data.text };
  } catch (error) {
    throw new Error('PDF 파일 처리 중 오류가 발생했습니다.');
  }
};

// DOCX 파일 처리
const processDocxFile = async (buffer: Buffer, filename: string): Promise<{ title: string; content: string }> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const title = filename.replace(/\.[^/.]+$/, '');
    
    return { title, content: result.value };
  } catch (error) {
    throw new Error('DOCX 파일 처리 중 오류가 발생했습니다.');
  }
};

// 파일 업로드 및 처리
router.post('/file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    const { buffer, originalname, mimetype } = req.file;
    let processedData: { title: string; content: string };

    // 파일 타입에 따른 처리
    switch (mimetype) {
      case 'text/plain':
      case 'text/markdown':
        processedData = processTextFile(buffer, originalname);
        break;
      
      case 'application/pdf':
        processedData = await processPdfFile(buffer, originalname);
        break;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        processedData = await processDocxFile(buffer, originalname);
        break;
      
      default:
        return res.status(400).json({ error: '지원하지 않는 파일 형식입니다.' });
    }

    // 문서 처리 및 저장
    const documentId = await processDocument(
      processedData.title,
      processedData.content,
      originalname,
      {
        filename: originalname,
        mimetype,
        uploadedAt: new Date().toISOString()
      }
    );

    res.json({
      success: true,
      documentId,
      title: processedData.title,
      message: '문서가 성공적으로 처리되었습니다.'
    });

  } catch (error) {
    console.error('File ingest error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.' 
    });
  }
});

// 텍스트 직접 입력
router.post('/text', authenticateToken, async (req, res) => {
  try {
    const { title, content, source, metadata } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }

    // 문서 처리 및 저장
    const documentId = await processDocument(
      title,
      content,
      source,
      {
        ...metadata,
        ingestedAt: new Date().toISOString()
      }
    );

    res.json({
      success: true,
      documentId,
      title,
      message: '텍스트가 성공적으로 처리되었습니다.'
    });

  } catch (error) {
    console.error('Text ingest error:', error);
    res.status(500).json({ error: '텍스트 처리 중 오류가 발생했습니다.' });
  }
});

// 처리 상태 조회
router.get('/status/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // 실제 구현에서는 문서 처리 상태를 추적하는 로직이 필요
    // 현재는 간단히 성공 상태만 반환
    res.json({
      documentId: parseInt(documentId),
      status: 'completed',
      message: '문서 처리가 완료되었습니다.'
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: '상태 조회 중 오류가 발생했습니다.' });
  }
});

export default router;

