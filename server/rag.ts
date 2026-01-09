import { OpenAI } from 'openai';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { searchSimilarDocuments, insertDocument, insertEmbedding } from './db';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const embeddingModel = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 텍스트 분할기
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', ' ', ''],
});

// 시스템 프롬프트 (README.md에서 정의된 내용)
const SYSTEM_PROMPT = `당신은 사내 지식기반(RAG) 어시스턴트입니다. 답변은 한국어로 하며, 다음 원칙을 지킵니다.

1) 근거 우선: 검색/조회된 문서 근거(문서명, 섹션, 날짜)가 있으면 답변의 마지막에 [근거] 블록으로 제시합니다.
2) 일반 답변: 관련 문서가 없어도 일반적인 지식을 바탕으로 도움이 되는 답변을 제공합니다.
3) 민감정보 취급:
   - 개인식별정보(주민번호, 계좌, 상세 주소)·기밀 자료는 마스킹하거나 요약만 제공합니다.
   - 외부 반출 금지. 필요 시 내부 포털/티켓 링크만 안내합니다.
4) ITSM 연계:
   - 사용자가 "방화벽" 관련 문의를 하면, ITSM 사례 템플릿(방화벽 오픈 요청/확인 요청/정책 변경/진단 요청 등) 추천을 먼저 제시합니다.
   - 티켓 발행/갱신 시 필요한 필드(시스템명, 소스/목적지 IP, 포트/프로토콜, 기간, 사유, 승인자)를 빠짐없이 요구합니다.
5) 스타일:
   - 간결한 요약 → 상세 단계(순서도/체크리스트) → 근거 순서로 작성.
   - 코드/쿼리/명령어는 블록으로 제공하고 환경/주의사항을 함께 명시.
6) 최신성:
   - 날짜/버전이 중요한 사안(보안정책, 방화벽 룰, 표준 운영절차)은 반드시 날짜와 문서 버전을 표기합니다.`;

// 채팅 의도 감지 (DB 기반)
export const detectChatIntent = async (userInput: string, companyCode: string = 'SKN'): Promise<{
  matched: boolean;
  patternId?: number;
  responseMessage?: string;
  options?: any[];
  intentCategory?: string;
  displayType?: string;
} | null> => {
  const { query, DB_TYPE } = await import('./db');
  
  try {
    let patternsQuery;
    if (DB_TYPE === 'postgres') {
      patternsQuery = `
        SELECT id, pattern_type, pattern_value, response_message, intent_category, display_type
        FROM chat_intent_patterns
        WHERE is_active = true AND company_code = $1
        ORDER BY priority DESC, id ASC
      `;
    } else {
      patternsQuery = `
        SELECT ID as id, PATTERN_TYPE as pattern_type, PATTERN_VALUE as pattern_value, 
               RESPONSE_MESSAGE as response_message, INTENT_CATEGORY as intent_category, DISPLAY_TYPE as display_type
        FROM EAR.chat_intent_patterns
        WHERE IS_ACTIVE = true AND COMPANY_CODE = ?
        ORDER BY PRIORITY DESC, ID ASC
      `;
    }
    
    const patternsResult = await query(patternsQuery, [companyCode]);
    const patterns = (patternsResult as any).rows || patternsResult;
    
    for (const pattern of patterns) {
      let matched = false;
      
      if (pattern.pattern_type === 'keyword') {
        // 키워드 매칭 (대소문자 무시)
        const keywords = pattern.pattern_value.split(',').map((k: string) => k.trim());
        matched = keywords.some((keyword: string) => 
          userInput.toLowerCase().includes(keyword.toLowerCase())
        );
      } else if (pattern.pattern_type === 'regex') {
        // 정규식 매칭
        try {
          const regex = new RegExp(pattern.pattern_value, 'i');
          matched = regex.test(userInput);
        } catch (e) {
          console.error('Invalid regex pattern:', pattern.pattern_value);
        }
      }
      
      if (matched) {
        // 선택지 조회
        let optionsQuery;
        if (DB_TYPE === 'postgres') {
          optionsQuery = `
            SELECT id, option_title, option_description, action_type, action_data, icon_name
            FROM chat_intent_options
            WHERE intent_pattern_id = $1
            ORDER BY display_order ASC, id ASC
          `;
        } else {
          optionsQuery = `
            SELECT ID as id, OPTION_TITLE as option_title, OPTION_DESCRIPTION as option_description,
                   ACTION_TYPE as action_type, ACTION_DATA as action_data, ICON_NAME as icon_name
            FROM EAR.chat_intent_options
            WHERE INTENT_PATTERN_ID = ?
            ORDER BY DISPLAY_ORDER ASC, ID ASC
          `;
        }
        
        const optionsResult = await query(optionsQuery, [pattern.id]);
        const options = (optionsResult as any).rows || optionsResult;
        
        return {
          matched: true,
          patternId: pattern.id,
          responseMessage: pattern.response_message,
          intentCategory: pattern.intent_category,
          displayType: pattern.display_type || 'inline',
          options: options.map((opt: any) => ({
            id: opt.id,
            title: opt.option_title,
            description: opt.option_description,
            actionType: opt.action_type,
            actionData: typeof opt.action_data === 'string' ? JSON.parse(opt.action_data) : opt.action_data,
            iconName: opt.icon_name
          }))
        };
      }
    }
    
    return { matched: false };
  } catch (error) {
    console.error('Error detecting chat intent:', error);
    return { matched: false };
  }
};

// 방화벽 키워드 감지 및 대응
export const detectFirewallIntent = (userInput: string): boolean => {
  const firewallKeywords = [
    '방화벽', 'firewall', '포트', 'port', 'IP', '프로토콜', 'protocol',
    '네트워크', 'network', '접속', '연결', '통신', '보안', 'security'
  ];
  
  return firewallKeywords.some(keyword => 
    userInput.toLowerCase().includes(keyword.toLowerCase())
  );
};

// 방화벽 ITSM 템플릿 생성
export const getFirewallTemplates = () => {
  return [
    {
      id: 'firewall-open',
      title: '방화벽 오픈 요청',
      description: '신규/임시/영구 방화벽 규칙 추가',
      fields: [
        { name: '시스템명', required: true, type: 'text' },
        { name: '소스 IP', required: true, type: 'text' },
        { name: '목적지 IP', required: true, type: 'text' },
        { name: '포트', required: true, type: 'text' },
        { name: '프로토콜', required: true, type: 'select', options: ['TCP', 'UDP', 'ICMP'] },
        { name: '기간', required: true, type: 'text' },
        { name: '사유', required: true, type: 'textarea' },
        { name: '승인자', required: true, type: 'text' }
      ]
    },
    {
      id: 'firewall-change',
      title: '방화벽 정책 변경',
      description: '기존 방화벽 규칙 수정',
      fields: [
        { name: '시스템명', required: true, type: 'text' },
        { name: '기존 규칙 ID', required: true, type: 'text' },
        { name: '변경 내용', required: true, type: 'textarea' },
        { name: '변경 사유', required: true, type: 'textarea' },
        { name: '승인자', required: true, type: 'text' }
      ]
    },
    {
      id: 'firewall-exception',
      title: '방화벽 예외 등록',
      description: 'Whitelist 등록',
      fields: [
        { name: '시스템명', required: true, type: 'text' },
        { name: '예외 IP/대역', required: true, type: 'text' },
        { name: '예외 포트', required: true, type: 'text' },
        { name: '예외 사유', required: true, type: 'textarea' },
        { name: '승인자', required: true, type: 'text' }
      ]
    },
    {
      id: 'firewall-troubleshoot',
      title: '방화벽 장애/진단 요청',
      description: '접속 불가/지연 문제 해결',
      fields: [
        { name: '시스템명', required: true, type: 'text' },
        { name: '문제 증상', required: true, type: 'textarea' },
        { name: '영향 범위', required: true, type: 'text' },
        { name: '발생 시간', required: true, type: 'datetime' },
        { name: '긴급도', required: true, type: 'select', options: ['긴급', '높음', '보통', '낮음'] }
      ]
    }
  ];
};

// 문서 임베딩 생성
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await embeddingModel.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

// 문서 처리 및 저장
export const processDocument = async (
  title: string,
  content: string,
  source?: string,
  metadata?: any
): Promise<number> => {
  try {
    // 문서를 청크로 분할
    const docs = await textSplitter.splitDocuments([
      new Document({ pageContent: content, metadata: { title, source, ...metadata } })
    ]);

    // 문서 저장
    const documentId = await insertDocument(title, content, source, metadata);

    // 각 청크에 대해 임베딩 생성 및 저장
    for (let i = 0; i < docs.length; i++) {
      const chunk = docs[i];
      const embedding = await generateEmbedding(chunk.pageContent);
      
      await insertEmbedding(
        documentId,
        i,
        chunk.pageContent,
        embedding,
        chunk.metadata
      );
    }

    console.log(`✅ Document processed: ${title} (${docs.length} chunks)`);
    return documentId;
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
};

// RAG 검색 및 답변 생성
export const generateRAGResponse = async (
  userQuestion: string,
  sessionId?: string
): Promise<{ response: string; sources: any[] }> => {
  try {
    console.log('RAG 응답 생성 시작:', userQuestion);
    
    // 사용자 질문에 대한 임베딩 생성
    const questionEmbedding = await generateEmbedding(userQuestion);
    console.log('질문 임베딩 생성 완료, 차원:', questionEmbedding.length);

    // 유사한 문서 검색 (임계값을 낮춤)
    const similarDocs = await searchSimilarDocuments(questionEmbedding, 5, 0.3, userQuestion);
    
    console.log('검색된 유사 문서 수:', similarDocs.length);
    if (similarDocs.length > 0) {
      console.log('첫 번째 유사 문서:', similarDocs[0]);
    }

    // 컨텍스트 구성
    const context = similarDocs.map((doc: any) => ({
      content: doc.chunk_text,
      title: doc.title,
      source: doc.source,
      similarity: doc.similarity,
      created_at: doc.created_at
    }));

    // 근거 정보 구성
    const sources = similarDocs.map((doc: any) => ({
      title: doc.title,
      source: doc.source,
      similarity: Math.round(doc.similarity * 100),
      created_at: doc.created_at,
      page_number: doc.page_number
    }));

    // RAG 프롬프트 구성
    let ragPrompt: string;
    
    if (context.length > 0) {
      // 관련 문서가 있는 경우
      ragPrompt = `[목표]
사용자 질문에 대해 아래 컨텍스트를 우선적으로 참고하여 답변을 작성하라.

[사용자 질문]
${userQuestion}

[컨텍스트(검색결과)]
${context.map((c: any) => `제목: ${c.title}\n내용: ${c.content}\n유사도: ${Math.round(c.similarity * 100)}%\n`).join('\n')}

[요구사항]
- 컨텍스트 정보를 우선적으로 활용하되, 일반적인 지식도 함께 제공.
- 핵심 요약 → 상세 설명 → [근거] 순으로 작성.
- 관련 문서가 있으면 근거를 명시하고, 없으면 일반 지식으로 답변.`;
    } else {
      // 관련 문서가 없는 경우 - 일반적인 답변 제공
      ragPrompt = `[목표]
사용자 질문에 대해 일반적인 지식을 바탕으로 도움이 되는 답변을 제공하라.

[사용자 질문]
${userQuestion}

[요구사항]
- 일반적인 지식과 경험을 바탕으로 도움이 되는 답변을 제공.
- 명확하고 이해하기 쉬운 설명을 제공.
- 필요시 추가 정보나 참고 자료를 제안.`;
    }

    // LLM 호출
    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: ragPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const response = completion.choices[0].message.content || '답변을 생성할 수 없습니다.';

    return { response, sources };
  } catch (error) {
    console.error('Error generating RAG response:', error);
    throw error;
  }
};

// RAG 스트리밍 검색 및 답변 생성
export const generateRAGResponseStream = async function* (
  userQuestion: string,
  sessionId?: string
): AsyncGenerator<{ type: 'chunk' | 'sources' | 'done'; data: any }, void, unknown> {
  try {
    console.log('RAG 스트리밍 응답 생성 시작:', userQuestion);
    
    // 사용자 질문에 대한 임베딩 생성
    const questionEmbedding = await generateEmbedding(userQuestion);
    console.log('질문 임베딩 생성 완료, 차원:', questionEmbedding.length);

    // 유사한 문서 검색 (임계값을 낮춤)
    const similarDocs = await searchSimilarDocuments(questionEmbedding, 5, 0.3, userQuestion);
    
    console.log('검색된 유사 문서 수:', similarDocs.length);
    if (similarDocs.length > 0) {
      console.log('첫 번째 유사 문서:', similarDocs[0]);
    }

    // 컨텍스트 구성
    const context = similarDocs.map((doc: any) => ({
      content: doc.chunk_text,
      title: doc.title,
      source: doc.source,
      similarity: doc.similarity,
      created_at: doc.created_at
    }));

    // 근거 정보 구성
    const sources = similarDocs.map((doc: any) => ({
      title: doc.title,
      source: doc.source,
      similarity: Math.round(doc.similarity * 100),
      created_at: doc.created_at,
      page_number: doc.page_number
    }));

    // RAG 프롬프트 구성
    let ragPrompt: string;
    
    if (context.length > 0) {
      // 관련 문서가 있는 경우
      ragPrompt = `[목표]
사용자 질문에 대해 아래 컨텍스트를 우선적으로 참고하여 답변을 작성하라.

[사용자 질문]
${userQuestion}

[컨텍스트(검색결과)]
${context.map((c: any) => `제목: ${c.title}\n내용: ${c.content}\n유사도: ${Math.round(c.similarity * 100)}%\n`).join('\n')}

[요구사항]
- 컨텍스트 정보를 우선적으로 활용하되, 일반적인 지식도 함께 제공.
- 핵심 요약 → 상세 설명 → [근거] 순으로 작성.
- 관련 문서가 있으면 근거를 명시하고, 없으면 일반 지식으로 답변.`;
    } else {
      // 관련 문서가 없는 경우 - 일반적인 답변 제공
      ragPrompt = `[목표]
사용자 질문에 대해 일반적인 지식을 바탕으로 도움이 되는 답변을 제공하라.

[사용자 질문]
${userQuestion}

[요구사항]
- 일반적인 지식과 경험을 바탕으로 도움이 되는 답변을 제공.
- 명확하고 이해하기 쉬운 설명을 제공.
- 필요시 추가 정보나 참고 자료를 제안.`;
    }

    // 스트리밍 LLM 호출
    const stream = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: ragPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      stream: true,
    });

    let fullResponse = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        yield { type: 'chunk', data: content };
      }
    }

    // 근거 정보 전송
    yield { type: 'sources', data: sources };
    
    // 완료 신호
    yield { type: 'done', data: { response: fullResponse, sources } };

  } catch (error) {
    console.error('Error generating RAG response stream:', error);
    throw error;
  }
};

// 문서 검색 (디버그용)
export const searchDocuments = async (
  query: string,
  limit: number = 10
): Promise<any[]> => {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const results = await searchSimilarDocuments(queryEmbedding, limit, 0.5);
    return results;
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
};
