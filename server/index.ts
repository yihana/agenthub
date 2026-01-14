import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import chatRoutes from './routes/chat';
import chatIntentRoutes from './routes/chatIntent';
import ingestRoutes from './routes/ingest';
import searchRoutes from './routes/search';
import ragRoutes from './routes/rag';
import earRoutes from './routes/ear';
import esmRoutes from './routes/esm';
import improvementRoutes from './routes/improvement';
import processRoutes from './routes/process';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import loginHistoryRoutes from './routes/loginHistory';
import interfaceAutomationRoutes from './routes/interfaceAutomation';
import ipWhitelistRoutes from './routes/ipWhitelist';
import menuRoutes from './routes/menus';
import groupMenuMappingsRoutes from './routes/groupMenuMappings';
import inputSecurityRoutes from './routes/inputSecurity';
import outputSecurityRoutes from './routes/outputSecurity';
import chatHistoryRoutes from './routes/chatHistory';
import c4cRoutes from './routes/c4c';
import agentRoutes from './routes/agent';
import privacyPolicyRoutes from './routes/privacyPolicy';
import promptManagementRoutes from './routes/promptManagement';
import destinationTestRoutes from './routes/destinationTest';
import ragAgentsRoutes from './routes/ragAgents';
import agentManagementRoutes from './routes/agents';
import jobRoutes from './routes/jobs';
import { initializeDatabase } from './db';
import { ipWhitelistMiddleware } from './middleware/ipWhitelist';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;

// 정적 파일 제공 (IP 제한 에러 페이지용)
app.use('/static', express.static(path.join(__dirname, 'views')));

// 요청 로깅 (디버깅용)
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';

app.use((req, res, next) => {
  // /api/auth/callback 요청은 상세 로깅 (디버그 모드에서만)
  if (req.path === '/api/auth/callback' && DEBUG_AUTH) {
    console.log('[요청 로그] /api/auth/callback 요청 도달:', {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: {
        host: req.headers.host,
        'x-forwarded-host': req.headers['x-forwarded-host'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'user-agent': req.headers['user-agent']
      },
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// IP 화이트리스트 미들웨어 적용 (모든 요청에 대해)
// 비동기 미들웨어를 위한 래퍼 함수
app.use((req, res, next) => {
  ipWhitelistMiddleware(req, res, next).catch(next);
});

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 파일 업로드를 위한 인코딩 설정
app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // multipart/form-data 요청의 경우 인코딩 처리
  }
  next();
});

// 라우트
app.use('/api/chat', chatRoutes);
app.use('/api/chat-intent', chatIntentRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/ear', earRoutes);
app.use('/api/esm', esmRoutes);
app.use('/api/improvement', improvementRoutes);
app.use('/api/process', processRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/login-history', loginHistoryRoutes);
app.use('/api/interface-automation', interfaceAutomationRoutes);
app.use('/api/ip-whitelist', ipWhitelistRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/group-menu-mappings', groupMenuMappingsRoutes);
app.use('/api/input-security', inputSecurityRoutes);
app.use('/api/output-security', outputSecurityRoutes);
app.use('/api/chat-history', chatHistoryRoutes);
app.use('/api/c4c', c4cRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/privacy-policy', privacyPolicyRoutes);
app.use('/api/prompt-management', promptManagementRoutes);
app.use('/api/rag-agents', ragAgentsRoutes);
app.use('/api/destination-test', destinationTestRoutes);
app.use('/api/agents', agentManagementRoutes);
app.use('/api/jobs', jobRoutes);

// 프로덕션 환경에서 정적 파일 제공
if (process.env.NODE_ENV === 'production') {
  const webDistPath = path.join(__dirname, '../../web/dist');
  app.use(express.static(webDistPath));
  
  // SPA를 위한 fallback - 모든 비-API 라우트를 index.html로 리다이렉트
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(webDistPath, 'index.html'));
    }
  });
}

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 에러 핸들링
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 서버 시작
async function startServer() {
  try {
    // 데이터베이스 초기화
    await initializeDatabase();
    
    // 서버 시작
    app.listen(PORT, () => {
      console.log(`🚀 RAG Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

startServer();
