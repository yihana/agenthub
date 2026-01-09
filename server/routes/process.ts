import express from 'express';
import { OpenAI } from 'openai';
import { query, DB_TYPE } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 프로세스 데이터 조회
router.get('/process-data', authenticateToken, async (req, res) => {
  try {
    // 실제 구현에서는 데이터베이스에서 프로세스 데이터를 조회
    const processData = {
      nodes: [
        {
          id: '1',
          type: 'processNode',
          position: { x: 100, y: 100 },
          data: {
            label: 'Invoice 접수',
            step: 'INVOICE_RECEIVED',
            status: 'completed',
            kpi: { count: 150, avgTime: '2시간', successRate: '98%' },
            backlog: 3,
            recentItems: ['INV-2024-001', 'INV-2024-002', 'INV-2024-003'],
            errors: [],
            permissions: ['view', 'edit', 'approve']
          }
        },
        // ... 다른 노드들
      ],
      edges: [
        {
          id: 'e1-2',
          source: '1',
          target: '2',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        },
        // ... 다른 엣지들
      ]
    };

    res.json(processData);
  } catch (error) {
    console.error('프로세스 데이터 조회 오류:', error);
    res.status(500).json({ error: '프로세스 데이터를 조회할 수 없습니다.' });
  }
});

// AI 질의 처리
router.post('/ai-query', authenticateToken, async (req, res) => {
  try {
    const { query, selectedNode, processData } = req.body;

    // RAG를 통한 컨텍스트 검색
    const context = await searchProcessContext(query);
    
    // AI 응답 생성
    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 ERP 프로세스 관리 AI 어시스턴트입니다. 
          사용자의 질문에 대해 프로세스 데이터를 분석하고 적절한 액션을 제안합니다.
          
          현재 프로세스 상태:
          ${JSON.stringify(processData, null, 2)}
          
          선택된 노드: ${selectedNode ? JSON.stringify(selectedNode, null, 2) : '없음'}
          
          컨텍스트 정보:
          ${context}
          
          응답 형식:
          1. 질문에 대한 분석 및 답변
          2. 필요한 경우 액션 제안 (approve, reject, escalate 등)
          3. 개선 방안 제안
          
          액션이 필요한 경우 다음 형식으로 응답하세요:
          ACTION: [액션타입]
          TARGET: [대상노드ID]
          REASON: [사유]`
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message.content;
    
    // 액션 파싱
    let action = null;
    if (response && response.includes('ACTION:')) {
      const actionMatch = response.match(/ACTION:\s*(\w+)/);
      const targetMatch = response.match(/TARGET:\s*(\w+)/);
      const reasonMatch = response.match(/REASON:\s*(.+)/);
      
      if (actionMatch && targetMatch) {
        action = {
          type: actionMatch[1].toLowerCase(),
          targetNodeId: targetMatch[1],
          reason: reasonMatch ? reasonMatch[1] : '',
          timestamp: new Date().toISOString()
        };
      }
    }

    res.json({
      response: response,
      action: action
    });

  } catch (error) {
    console.error('AI 질의 처리 오류:', error);
    res.status(500).json({ 
      error: 'AI 질의를 처리할 수 없습니다.',
      response: '죄송합니다. 현재 서비스에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
    });
  }
});

// 프로세스 상태 업데이트
router.post('/update-status', authenticateToken, async (req, res) => {
  try {
    const { nodeId, status, userId, reason } = req.body;

    // 실제 구현에서는 데이터베이스에 상태 업데이트 기록
    console.log(`노드 ${nodeId} 상태를 ${status}로 업데이트`, {
      userId,
      reason,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      message: '상태가 업데이트되었습니다.',
      nodeId,
      status
    });

  } catch (error) {
    console.error('상태 업데이트 오류:', error);
    res.status(500).json({ error: '상태를 업데이트할 수 없습니다.' });
  }
});

// Invoice 데이터 조회
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    // 실제 구현에서는 데이터베이스에서 Invoice 데이터를 조회
    const invoices = [
      {
        id: 'INV-2024-001',
        invoiceNumber: 'INV-2024-001',
        vendor: 'ABC 공급업체',
        amount: 1500000,
        currency: 'KRW',
        dueDate: '2024-02-15',
        status: 'completed',
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
        items: [
          {
            id: '1',
            description: '소프트웨어 라이선스',
            quantity: 1,
            unitPrice: 1500000,
            totalPrice: 1500000
          }
        ]
      },
      {
        id: 'INV-2024-002',
        invoiceNumber: 'INV-2024-002',
        vendor: 'XYZ 물류회사',
        amount: 850000,
        currency: 'KRW',
        dueDate: '2024-02-20',
        status: 'in_progress',
        createdAt: '2024-01-18T10:30:00Z',
        updatedAt: '2024-01-22T11:15:00Z',
        items: [
          {
            id: '2',
            description: '운송 서비스',
            quantity: 5,
            unitPrice: 170000,
            totalPrice: 850000
          }
        ]
      }
    ];

    res.json(invoices);
  } catch (error) {
    console.error('Invoice 데이터 조회 오류:', error);
    res.status(500).json({ error: 'Invoice 데이터를 조회할 수 없습니다.' });
  }
});

// 프로세스 컨텍스트 검색 (RAG)
async function searchProcessContext(searchQuery: string): Promise<string> {
  try {
    // 실제 구현에서는 벡터 검색을 통해 관련 문서를 찾음
    // 현재는 간단한 텍스트 검색으로 대체
    let searchResults: any;
    if (DB_TYPE === 'postgres') {
      searchResults = await query(
        `SELECT text_content as content, name as title, created_at
         FROM rag_documents 
         WHERE text_content ILIKE $1 OR name ILIKE $1
         ORDER BY created_at DESC
         LIMIT 3`,
        [`%${searchQuery}%`]
      );
    } else {
      const like = `%${String(searchQuery).toUpperCase()}%`;
      searchResults = await query(
        `SELECT TEXT_CONTENT as content, NAME as title, CREATED_AT as created_at
         FROM EAR.RAG_DOCUMENTS
         WHERE UPPER(TEXT_CONTENT) LIKE ? OR UPPER(NAME) LIKE ?
         ORDER BY CREATED_AT DESC
         LIMIT 3`,
        [like, like]
      );
    }

    const rows = (searchResults as any).rows || searchResults;
    if (!rows || rows.length === 0) {
      return '관련 프로세스 문서를 찾을 수 없습니다.';
    }

    return rows
      .map((row: any) => `문서: ${row.title || '제목 없음'}\n내용: ${row.content?.substring(0, 500)}...`)
      .join('\n\n');
  } catch (error) {
    console.error('프로세스 컨텍스트 검색 오류:', error);
    return '컨텍스트 검색 중 오류가 발생했습니다.';
  }
}

export default router;
