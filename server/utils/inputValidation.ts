import { query, DB_TYPE } from '../db';

export interface Violation {
  type: string;
  key: string;
  name: string;
  message: string;
}

export async function validateInput(message: string): Promise<{ blocked: boolean; violations: Violation[] }> {
  const violations: Violation[] = [];
  
  // 개인정보 차단 검사
  let personalInfoQuery;
  if (DB_TYPE === 'postgres') {
    personalInfoQuery = `
      SELECT setting_type, setting_key, setting_name, pattern
      FROM input_security_settings
      WHERE setting_type = 'personal_info' AND is_enabled = true
    `;
  } else {
    personalInfoQuery = `
      SELECT SETTING_TYPE as setting_type, SETTING_KEY as setting_key, 
             SETTING_NAME as setting_name, PATTERN as pattern
      FROM EAR.input_security_settings
      WHERE SETTING_TYPE = 'personal_info' AND IS_ENABLED = true
    `;
  }
  
  const personalInfoResult = await query(personalInfoQuery);
  const personalInfoSettings = (personalInfoResult as any).rows || personalInfoResult;
  
  for (const setting of personalInfoSettings) {
    if (setting.pattern) {
      try {
        const regex = new RegExp(setting.pattern, 'gi');
        if (regex.test(message)) {
          violations.push({
            type: 'personal_info',
            key: setting.setting_key,
            name: setting.setting_name,
            message: `${setting.setting_name} 입력이 감지되어 차단되었습니다.`
          });
        }
      } catch (regexError) {
        console.error(`정규식 오류 (${setting.setting_key}):`, regexError);
      }
    }
  }
  
  // 욕설 차단 검사
  let profanitySettingQuery;
  if (DB_TYPE === 'postgres') {
    profanitySettingQuery = `
      SELECT setting_key, setting_name
      FROM input_security_settings
      WHERE setting_type = 'profanity' AND setting_key = 'profanity' AND is_enabled = true
    `;
  } else {
    profanitySettingQuery = `
      SELECT SETTING_KEY as setting_key, SETTING_NAME as setting_name
      FROM EAR.input_security_settings
      WHERE SETTING_TYPE = 'profanity' AND SETTING_KEY = 'profanity' AND IS_ENABLED = true
    `;
  }
  
  const profanitySettingResult = await query(profanitySettingQuery);
  const profanitySetting = (profanitySettingResult as any).rows || profanitySettingResult;
  
  if (profanitySetting.length > 0) {
    // 활성화된 욕설 패턴 조회
    let profanityPatternsQuery;
    if (DB_TYPE === 'postgres') {
      profanityPatternsQuery = `
        SELECT pattern
        FROM profanity_patterns
        WHERE is_active = true
      `;
    } else {
      profanityPatternsQuery = `
        SELECT PATTERN as pattern
        FROM EAR.profanity_patterns
        WHERE IS_ACTIVE = true
      `;
    }
    
    const profanityPatternsResult = await query(profanityPatternsQuery);
    const profanityPatterns = (profanityPatternsResult as any).rows || profanityPatternsResult;
    
    for (const patternRow of profanityPatterns) {
      const pattern = patternRow.pattern;
      if (pattern && message.toLowerCase().includes(pattern.toLowerCase())) {
        violations.push({
          type: 'profanity',
          key: 'profanity',
          name: profanitySetting[0].setting_name,
          message: '부적절한 언어 사용이 감지되어 차단되었습니다.'
        });
        break; // 첫 번째 욕설 발견 시 중단
      }
    }
  }
  
  return {
    blocked: violations.length > 0,
    violations
  };
}

