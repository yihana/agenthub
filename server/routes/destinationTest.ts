import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';

const router = express.Router();

// axios를 동적으로 import (타입 오류 방지) - 직접 URL 입력 시에만 사용
const axios = require('axios');

// Destination 호출 테스트 API
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      destinationName,  // Destination 이름 (선택사항)
      url,              // 직접 URL 입력 (선택사항)
      method = 'get', 
      path = '',  // Path는 선택사항 (비어있으면 Destination URL 그대로 사용)
      authType = 'none',
      basicAuth,
      oauth2
    } = req.body;

    let finalUrl: string;
    let destination: any = null;
    let headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Destination 이름이 제공된 경우, @sap-cloud-sdk/http-client 사용
    if (destinationName) {
      console.log('==============================')
      console.log('Destination 이름:', destinationName);
      console.log('==============================')
      try {
        // Path 설정 (비어있으면 '/' 사용)
        const requestPath = (!path || path.trim() === '') ? '/' : path;
        console.log('==============================')
        console.log('requestPath:', requestPath);
        console.log('==============================')
        // HTTP 메서드 설정
        const httpMethod = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' |  'patch'; 

        //호출전 값 확인
        console.log('==============================')
        console.log('호출전 값 확인 requestBody:', {
          destinationName,
          method: httpMethod,
          url: requestPath,
          ...(req.body.data && { data: req.body.data })
        });
        console.log('==============================')

        // executeHttpRequest를 사용하여 Destination 호출
        const response = await executeHttpRequest(
          { destinationName },
          {
            method: httpMethod,
            url: requestPath,
            ...(req.body.data && { data: req.body.data })
          }
        );

        console.log('==============================')
        console.log('destination service 호출결과 response:', response);
        console.log('==============================')

        // 응답 데이터와 헤더를 포함하여 반환
        return res.json({
          success: true,
          data: {
            status: response.status,
            statusText: response.statusText || 'OK',
            headers: response.headers || {},
            data: response.data,
          }
        });
      } catch (error: any) {
        // Destination 호출 실패 시 상세 에러 정보 반환
        return res.status(500).json({
          success: false,
          error: error.message || 'Destination 호출 중 오류가 발생했습니다.',
          details: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers,
            data: error.response.data,
          } : undefined
        });
      }
    } else if (url) {
      // 직접 URL 입력한 경우
      console.log('==============================')
      console.log('Private Link 가 아닌 다이렉트 URL:', url);
      console.log('==============================')
      if (!path || path.trim() === '') {
        finalUrl = url;
      } else {
        finalUrl = path.startsWith('/') ? `${url}${path}` : `${url}/${path}`;
      }

      // 사용자가 입력한 인증 정보 사용
      if (authType === 'basic' && basicAuth?.username && basicAuth?.password) {
        const credentials = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      } else if (authType === 'oauth2' && oauth2?.tokenUrl && oauth2?.clientId && oauth2?.clientSecret) {
        try {
          const tokenResponse = await axios.post(
            oauth2.tokenUrl,
            'grant_type=client_credentials',
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              auth: {
                username: oauth2.clientId,
                password: oauth2.clientSecret
              }
            }
          );
          headers['Authorization'] = `Bearer ${tokenResponse.data.access_token}`;
        } catch (tokenError: any) {
          console.warn('OAuth2 토큰 가져오기 실패:', tokenError.message);
          return res.status(500).json({
            success: false,
            error: `OAuth2 토큰 가져오기 실패: ${tokenError.message}`,
            details: tokenError.response ? {
              status: tokenError.response.status,
              statusText: tokenError.response.statusText,
              data: tokenError.response.data,
            } : undefined
          });
        }
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'destinationName 또는 url 중 하나는 필수입니다.' 
      });
    }

    try {
      // HTTP 요청 보내기
      const httpMethod = method.toLowerCase();
      let response;
      
      if (httpMethod === 'get') {
        response = await axios.get(finalUrl, { headers, timeout: 30000 });
      } else if (httpMethod === 'post') {
        response = await axios.post(finalUrl, req.body.data || {}, { headers, timeout: 30000 });
      } else if (httpMethod === 'put') {
        response = await axios.put(finalUrl, req.body.data || {}, { headers, timeout: 30000 });
      } else if (httpMethod === 'delete') {
        response = await axios.delete(finalUrl, { headers, timeout: 30000 });
      } else if (httpMethod === 'patch') {
        response = await axios.patch(finalUrl, req.body.data || {}, { headers, timeout: 30000 });
      } else {
        throw new Error(`지원하지 않는 HTTP 메서드: ${method}`);
      }

      // 응답 데이터와 헤더를 포함하여 반환
      return res.json({
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
        }
      });
    } catch (error: any) {
      // Destination 호출 실패 시 상세 에러 정보 반환
      return res.status(500).json({
        success: false,
        error: error.message || 'API 호출 중 오류가 발생했습니다.',
        details: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data,
        } : undefined
      });
    }
  } catch (error: any) {
    console.error('Destination 테스트 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '서버 오류가 발생했습니다.'
    });
  }
});

export default router;

