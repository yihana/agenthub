// 채팅 관련 localStorage 정리 유틸리티
export const clearChatStorage = () => {
  try {
    // 채팅 세션 데이터 제거
    localStorage.removeItem('chatSessions');
    
    // 기타 채팅 관련 데이터가 있다면 여기에 추가
    // localStorage.removeItem('chatMessages');
    // localStorage.removeItem('chatSettings');
    
    console.log('채팅 관련 localStorage가 정리되었습니다.');
    return true;
  } catch (error) {
    console.error('localStorage 정리 중 오류:', error);
    return false;
  }
};

// 개발자 도구에서 사용할 수 있도록 전역에 등록
if (typeof window !== 'undefined') {
  (window as any).clearChatStorage = clearChatStorage;
}
