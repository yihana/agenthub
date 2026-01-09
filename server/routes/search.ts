import express from 'express';
import { searchDocuments } from '../rag';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 문서 검색 API
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { q: query, limit = 10, threshold = 0.5 } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '검색 쿼리가 필요합니다.' });
    }

    const results = await searchDocuments(query, parseInt(limit as string));

    // 유사도 임계값 필터링
    const filteredResults = results.filter((doc: any) => doc.similarity >= parseFloat(threshold as string));

    res.json({
      query,
      results: filteredResults,
      total: filteredResults.length,
      threshold: parseFloat(threshold as string)
    });

  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

// 문서 목록 조회
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // 실제 구현에서는 데이터베이스에서 문서 목록을 가져와야 함
    // 현재는 빈 배열 반환
    res.json({
      documents: [],
      total: 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

  } catch (error) {
    console.error('Documents list API error:', error);
    res.status(500).json({ error: '문서 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 특정 문서 조회
router.get('/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    // 실제 구현에서는 데이터베이스에서 특정 문서를 가져와야 함
    res.json({
      documentId: parseInt(documentId),
      message: '문서 조회 기능은 구현 예정입니다.'
    });

  } catch (error) {
    console.error('Document detail API error:', error);
    res.status(500).json({ error: '문서 조회 중 오류가 발생했습니다.' });
  }
});

export default router;
