import { query, DB_TYPE } from '../db';

/**
 * 출력보안 필터링 함수
 * 활성화된 패턴과 일치하는 문자열을 "■" 문자로 대체
 */
export async function filterOutputSecurity(text: string): Promise<string> {
  try {
    // 출력보안 설정이 활성화되어 있는지 확인
    let settingQuery;
    if (DB_TYPE === 'postgres') {
      settingQuery = `
        SELECT is_enabled
        FROM output_security_settings
        WHERE setting_type = 'output_security' AND setting_key = 'output_security' AND is_enabled = true
        LIMIT 1
      `;
    } else {
      settingQuery = `
        SELECT IS_ENABLED as is_enabled
        FROM EAR.output_security_settings
        WHERE SETTING_TYPE = 'output_security' AND SETTING_KEY = 'output_security' AND IS_ENABLED = true
        LIMIT 1
      `;
    }
    
    const settingResult = await query(settingQuery);
    const setting = (settingResult as any).rows?.[0] || settingResult?.[0];
    
    if (!setting || !setting.is_enabled) {
      return text; // 출력보안이 비활성화되어 있으면 원본 반환
    }
    
    // 활성화된 출력보안 패턴 조회
    let patternsQuery;
    if (DB_TYPE === 'postgres') {
      patternsQuery = `
        SELECT pattern
        FROM output_security_patterns
        WHERE is_active = true
      `;
    } else {
      patternsQuery = `
        SELECT PATTERN as pattern
        FROM EAR.output_security_patterns
        WHERE IS_ACTIVE = true
      `;
    }
    
    const patternsResult = await query(patternsQuery);
    const patterns = (patternsResult as any).rows || patternsResult;
    
    if (patterns.length === 0) {
      console.log('[출력보안] 활성화된 패턴이 없습니다.');
      return text; // 패턴이 없으면 원본 반환
    }
    
    console.log(`[출력보안] 활성화된 패턴 수: ${patterns.length}, 필터링 대상 텍스트 길이: ${text.length}`);
    let filteredText = text;
    
    // 각 패턴에 대해 필터링 수행
    for (const patternRow of patterns) {
      const pattern = patternRow.pattern;
      if (!pattern) continue;
      
      try {
        // 패턴에 백슬래시가 포함되어 있으면 정규식으로 처리
        // 단, 이스케이프된 특수문자(\d, \w 등)가 있으면 정규식으로 처리
        const hasRegexEscape = pattern.includes('\\d') || pattern.includes('\\w') || pattern.includes('\\s') || 
                               pattern.includes('\\D') || pattern.includes('\\W') || pattern.includes('\\S') ||
                               pattern.startsWith('^') || pattern.endsWith('$') || pattern.includes('.*') ||
                               pattern.includes('\\+') || pattern.includes('\\*') || pattern.includes('\\?');
        
        if (hasRegexEscape) {
          // 정규식 패턴인 경우 (백슬래시 이스케이프 포함)
          const regex = new RegExp(pattern, 'gi');
          const beforeLength = filteredText.length;
          filteredText = filteredText.replace(regex, (match) => {
            console.log(`[출력보안] 패턴 "${pattern}" 매칭: "${match}" -> "${'■'.repeat(match.length)}"`);
            return '■'.repeat(match.length);
          });
          if (filteredText.length !== beforeLength) {
            console.log(`[출력보안] 패턴 "${pattern}" 적용 완료`);
          }
        } else {
          // 일반 문자열 패턴인 경우
          // 백슬래시가 있으면 이스케이프 처리 (예: "111111\-111111" -> "111111-111111")
          let processedPattern = pattern;
          // 백슬래시로 이스케이프된 문자 처리 (예: \- -> -)
          processedPattern = processedPattern.replace(/\\(.)/g, '$1');
          
          // 나머지 특수문자 이스케이프
          const escapedPattern = processedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedPattern, 'gi');
          const beforeLength = filteredText.length;
          filteredText = filteredText.replace(regex, (match) => {
            console.log(`[출력보안] 패턴 "${pattern}" (처리 후: "${processedPattern}") 매칭: "${match}" -> "${'■'.repeat(match.length)}"`);
            return '■'.repeat(match.length);
          });
          if (filteredText.length !== beforeLength) {
            console.log(`[출력보안] 패턴 "${pattern}" 적용 완료`);
          }
        }
      } catch (regexError) {
        console.error(`출력보안 패턴 오류 (${pattern}):`, regexError);
        // 정규식 오류가 발생하면 일반 문자열로 처리
        let processedPattern = pattern.replace(/\\(.)/g, '$1'); // 백슬래시 이스케이프 제거
        const escapedPattern = processedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedPattern, 'gi');
        filteredText = filteredText.replace(regex, (match) => {
          return '■'.repeat(match.length);
        });
      }
    }
    
    return filteredText;
  } catch (error) {
    console.error('출력보안 필터링 오류:', error);
    return text; // 오류 발생 시 원본 반환
  }
}

