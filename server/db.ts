import dotenv from 'dotenv';

dotenv.config();

const localOnly = process.env.LOCAL_ONLY === 'true';
const rawDbType = (process.env.DB_TYPE || '').toLowerCase();

if (localOnly && rawDbType && rawDbType !== 'postgres') {
  console.warn(`LOCAL_ONLY=true 이므로 DB_TYPE(${process.env.DB_TYPE})을 postgres로 강제합니다.`);

}

const dbType = localOnly ? 'postgres' : (rawDbType || 'postgres');

if (dbType !== 'postgres' && dbType !== 'hana') {
  throw new Error(`Unsupported DB_TYPE: ${process.env.DB_TYPE}`);
}

// 데이터베이스 타입 결정
export const DB_TYPE = dbType;
console.log(`🔧 데이터베이스 타입: ${DB_TYPE}`);

// 동적으로 적절한 DB 모듈 로드
let dbModule: any;

if (DB_TYPE === 'postgres') {
  dbModule = require('./db-postgres');
} else if (DB_TYPE === 'hana') {
  dbModule = require('./db-hana');
} else {
  throw new Error(`지원하지 않는 데이터베이스 타입: ${DB_TYPE}`);
}

// 모든 export를 re-export
export const pool = dbModule.pool;
export const query = dbModule.query;
export const initializeDatabase = dbModule.initializeDatabase;

// db 객체 (하위 호환성)
export const db = {
  query: dbModule.query
};

// 채팅 히스토리 헬퍼 함수들
export async function insertChatHistory(sessionId: string, userId: string, userMessage: string, assistantResponse: string, sources?: any[], intentOptions?: any[]) {
  if (DB_TYPE === 'postgres') {
    const result = await query(
      'INSERT INTO chat_history (session_id, user_id, user_message, assistant_response, sources, intent_options, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id',
      [sessionId, userId, userMessage, assistantResponse, sources ? JSON.stringify(sources) : null, intentOptions ? JSON.stringify(intentOptions) : null]
    );
    return result.rows[0].id;
  } else {
    const result = await query(
      'INSERT INTO EAR.chat_history (SESSION_ID, USER_ID, USER_MESSAGE, ASSISTANT_RESPONSE, SOURCES, INTENT_OPTIONS, CREATED_AT) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [sessionId, userId, userMessage, assistantResponse, sources ? JSON.stringify(sources) : null, intentOptions ? JSON.stringify(intentOptions) : null]
    );
    // HANA는 RETURNING 지원 안함, 마지막 삽입 ID를 다른 방식으로 가져와야 함
    return 1; // 임시
  }
}

export async function getChatHistory(sessionId: string, userId?: string, limit?: number) {
  if (DB_TYPE === 'postgres') {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    if (userId) {
      const result = await query(
        `SELECT * FROM chat_history WHERE session_id = $1 AND user_id = $2 ORDER BY created_at ASC ${limitClause}`,
        [sessionId, userId]
      );
      return result.rows;
    } else {
      const result = await query(
        `SELECT * FROM chat_history WHERE session_id = $1 ORDER BY created_at ASC ${limitClause}`,
        [sessionId]
      );
      return result.rows;
    }
  } else {
    // HANA - TOP 구문 사용, UTC 시간을 한국 시간(UTC+9)으로 변환 (9시간 = 32400초)
    const limitValue = limit || 1000;
    if (userId) {
      const result = await query(
        `SELECT TOP ${limitValue} 
         ID as id, 
         SESSION_ID as session_id, 
         USER_ID as user_id, 
         USER_MESSAGE as user_message, 
         ASSISTANT_RESPONSE as assistant_response, 
         SOURCES as sources, 
         INTENT_OPTIONS as intent_options, 
         ADD_SECONDS(CREATED_AT, 32400) as created_at
         FROM EAR.chat_history 
         WHERE SESSION_ID = ? AND USER_ID = ?
         ORDER BY CREATED_AT ASC`,
        [sessionId, userId]
      );
      return result.rows;
    } else {
      const result = await query(
        `SELECT TOP ${limitValue} 
         ID as id, 
         SESSION_ID as session_id, 
         USER_ID as user_id, 
         USER_MESSAGE as user_message, 
         ASSISTANT_RESPONSE as assistant_response, 
         SOURCES as sources, 
         INTENT_OPTIONS as intent_options, 
         ADD_SECONDS(CREATED_AT, 32400) as created_at
         FROM EAR.chat_history 
         WHERE SESSION_ID = ? 
         ORDER BY CREATED_AT ASC`,
        [sessionId]
      );
      return result.rows;
    }
  }
}

export async function deleteChatSession(sessionId: string, userId?: string): Promise<number> {
  if (DB_TYPE === 'postgres') {
    if (userId) {
      const result = await query('DELETE FROM chat_history WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
      return result.rowCount || 0;
    } else {
      const result = await query('DELETE FROM chat_history WHERE session_id = $1', [sessionId]);
      return result.rowCount || 0;
    }
  } else {
    if (userId) {
      const result = await query('DELETE FROM EAR.chat_history WHERE SESSION_ID = ? AND USER_ID = ?', [sessionId, userId]);
      return result.rowCount || 0;
    } else {
      const result = await query('DELETE FROM EAR.chat_history WHERE SESSION_ID = ?', [sessionId]);
      return result.rowCount || 0;
    }
  }
}

export async function insertDocument(title: string, content: string, source?: string, metadata?: any) {
  if (DB_TYPE === 'postgres') {
    const result = await query(
      'INSERT INTO rag_documents (name, text_content, file_path, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id',
      [title, content, source]
    );
    return result.rows[0].id;
  } else {
    const result = await query(
      'INSERT INTO EAR.rag_documents (NAME, TEXT_CONTENT, FILE_PATH, CREATED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [title, content, source]
    );
    return 1; // 임시
  }
}

export async function insertEmbedding(documentId: number, chunkIndex: number, content: string, embedding: number[], metadata?: any) {
  if (DB_TYPE === 'postgres') {
    await query(
      'INSERT INTO rag_chunks (document_id, chunk_index, content, embedding, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
      [documentId, chunkIndex, content, JSON.stringify(embedding)]
    );
  } else {
    await query(
      'INSERT INTO EAR.rag_chunks (DOCUMENT_ID, CHUNK_INDEX, CONTENT, EMBEDDING, CREATED_AT) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [documentId, chunkIndex, content, JSON.stringify(embedding)]
    );
  }
}

export async function searchSimilarDocuments(embedding: number[], limit: number = 10, threshold: number = 0.3, searchQuery?: string) {
  if (DB_TYPE === 'postgres') {
    const result = await query(`
      SELECT 
        c.id,
        c.content as chunk_text,
        c.chunk_index,
        c.page_number,
        d.name as title,
        d.file_path as source,
        d.created_at,
        1 - (c.embedding <=> $1::vector) as similarity
      FROM rag_chunks c
      JOIN rag_documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> $1::vector) >= $2
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
    `, [JSON.stringify(embedding), threshold, limit]);
    
    return result.rows;
  } else {
    // HANA에서는 기본적인 텍스트 검색 사용
    if (!searchQuery) {
      console.warn('HANA DB에서는 검색 쿼리가 필요합니다.');
      return [];
    }
    
    console.log('HANA DB에서 텍스트 검색 수행:', searchQuery);
    
    const result = await query(`
      SELECT 
        ID as id,
        CONTENT as chunk_text,
        CHUNK_INDEX as chunk_index,
        PAGE_NUMBER as page_number,
        (SELECT NAME FROM EAR.rag_documents WHERE ID = DOCUMENT_ID) as title,
        (SELECT FILE_PATH FROM EAR.rag_documents WHERE ID = DOCUMENT_ID) as source,
        CREATED_AT as created_at,
        0.8 as similarity
      FROM EAR.rag_chunks
      WHERE CONTENT LIKE ?
      ORDER BY CREATED_AT DESC
      LIMIT ?
    `, [`%${searchQuery}%`, limit]);
    
    return result.rows || [];
  }
}
