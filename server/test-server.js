import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json());

// 간단한 테스트 라우트
app.post('/api/rag/upload', (req, res) => {
  console.log('RAG 업로드 요청 받음');
  res.json({
    success: true,
    message: '테스트 응답 - 서버가 정상 작동 중입니다',
    chunks: 1
  });
});

app.get('/api/rag/documents', (req, res) => {
  res.json({
    documents: [
      {
        id: '1',
        name: 'test-document.pdf',
        file_type: 'application/pdf',
        file_size: 1024000,
        created_at: '2024-01-15 10:30:00',
        chunk_count: 1
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 테스트 서버가 포트 ${PORT}에서 실행 중입니다`);
});
