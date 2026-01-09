-- EAR 요청목록 샘플 데이터
-- 먼저 기존 요청 데이터가 있다면 삭제 (선택사항)
-- DELETE FROM ear_requests;

-- 샘플 요청 데이터 삽입
INSERT INTO ear_requests (
    request_title,
    request_content,
    template_id,
    form_data,
    attachments,
    status,
    created_by,
    created_at,
    updated_at
) VALUES 
-- 방화벽 오픈 신청 샘플들
(
    '웹서버 HTTPS 포트 오픈 신청',
    '고객 포털 웹서버에 HTTPS 접근을 위한 443 포트 오픈이 필요합니다. SSL 인증서 적용 후 보안 연결을 위해 요청드립니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '방화벽 오픈 신청' LIMIT 1),
    '{"source_ip": "192.168.1.100", "dest_ip": "10.0.0.50", "port": 443, "protocol": "TCP", "start_date": "2024-01-15", "end_date": "2024-12-31", "target_system": "고객 포털 웹서버", "reason": "SSL 인증서 적용 후 보안 연결 필요", "service_name": "HTTPS 웹서비스"}',
    NULL,
    'approved',
    '김개발',
    '2024-01-10 09:30:00',
    '2024-01-10 14:20:00'
),
(
    '데이터베이스 서버 접근 포트 오픈',
    '개발팀에서 운영 데이터베이스에 접근하기 위한 3306 포트 오픈을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '방화벽 오픈 신청' LIMIT 1),
    '{"source_ip": "192.168.2.0/24", "dest_ip": "10.1.0.10", "port": 3306, "protocol": "TCP", "start_date": "2024-01-20", "end_date": "2024-06-30", "target_system": "운영 MySQL 서버", "reason": "개발팀 데이터베이스 접근 필요", "service_name": "MySQL 데이터베이스"}',
    NULL,
    'pending',
    '이운영',
    '2024-01-18 16:45:00',
    '2024-01-18 16:45:00'
),
(
    'FTP 서버 포트 오픈 신청',
    '파일 전송을 위한 FTP 서버 21번 포트 오픈을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '방화벽 오픈 신청' LIMIT 1),
    '{"source_ip": "192.168.3.50", "dest_ip": "10.2.0.20", "port": 21, "protocol": "TCP", "start_date": "2024-02-01", "end_date": "2024-08-31", "target_system": "FTP 파일서버", "reason": "외부 파트너사와 파일 교환 필요", "service_name": "FTP 파일전송"}',
    NULL,
    'rejected',
    '박파트너',
    '2024-01-25 11:15:00',
    '2024-01-26 09:30:00'
),

-- 시스템 접근 신청 샘플들
(
    '운영서버 SSH 접근 권한 신청',
    '시스템 점검 및 유지보수를 위한 운영서버 SSH 접근 권한을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '시스템 접근 신청' LIMIT 1),
    '{"target_system": "운영서버-01", "access_type": "SSH", "access_period": "1주일", "access_reason": "정기 시스템 점검 및 보안 패치 적용", "requested_by": "김시스템", "department": "인프라팀"}',
    NULL,
    'in_progress',
    '김시스템',
    '2024-01-12 08:00:00',
    '2024-01-12 10:15:00'
),
(
    '개발서버 RDP 접근 신청',
    '원격 데스크톱을 통한 개발서버 접근 권한을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '시스템 접근 신청' LIMIT 1),
    '{"target_system": "개발서버-03", "access_type": "RDP", "access_period": "1개월", "access_reason": "신규 프로젝트 개발 환경 구성", "requested_by": "최개발", "department": "개발팀"}',
    NULL,
    'approved',
    '최개발',
    '2024-01-08 14:30:00',
    '2024-01-09 09:00:00'
),

-- 계정 생성/변경 신청 샘플들
(
    '신입 직원 계정 생성 신청',
    '신규 입사한 개발팀 직원의 시스템 계정 생성을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '계정 생성/변경 신청' LIMIT 1),
    '{"request_type": "계정 생성", "user_name": "newdeveloper", "full_name": "신입개발자", "email": "newdev@company.com", "department": "개발팀", "roles": "개발자", "request_reason": "신규 입사자 계정 생성"}',
    NULL,
    'completed',
    '김관리자',
    '2024-01-05 10:00:00',
    '2024-01-05 15:30:00'
),
(
    '관리자 권한 추가 신청',
    '기존 사용자에게 관리자 권한을 추가로 부여하는 것을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '계정 생성/변경 신청' LIMIT 1),
    '{"request_type": "권한 추가", "user_name": "senior.dev", "full_name": "시니어개발자", "email": "senior@company.com", "department": "개발팀", "roles": "관리자", "request_reason": "프로젝트 리드 역할 수행을 위한 관리자 권한 필요"}',
    NULL,
    'pending',
    '이팀장',
    '2024-01-22 13:20:00',
    '2024-01-22 13:20:00'
),

-- IT 장비 신청 샘플들
(
    '개발용 노트북 신청',
    '신규 프로젝트 참여를 위한 고성능 개발용 노트북을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = 'IT 장비 신청' LIMIT 1),
    '{"equipment_type": "노트북", "quantity": 1, "specification": "Intel i7, 16GB RAM, 512GB SSD, 고해상도 디스플레이", "business_justification": "모바일 앱 개발 프로젝트 참여를 위한 고성능 개발 환경 필요", "requested_by": "박모바일", "department": "개발팀", "budget_approval": "승인됨"}',
    NULL,
    'approved',
    '박모바일',
    '2024-01-15 11:45:00',
    '2024-01-16 09:15:00'
),
(
    '모니터 추가 신청',
    '멀티 모니터 환경 구성을 위한 추가 모니터를 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = 'IT 장비 신청' LIMIT 1),
    '{"equipment_type": "모니터", "quantity": 2, "specification": "27인치 4K UHD 모니터", "business_justification": "개발 효율성 향상을 위한 멀티 모니터 환경 구축", "requested_by": "정프론트", "department": "개발팀", "budget_approval": "승인 대기"}',
    NULL,
    'pending',
    '정프론트',
    '2024-01-20 16:30:00',
    '2024-01-20 16:30:00'
),
(
    '무선 키보드 마우스 세트 신청',
    '사무환경 개선을 위한 무선 키보드 마우스 세트를 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = 'IT 장비 신청' LIMIT 1),
    '{"equipment_type": "키보드", "quantity": 5, "specification": "무선 키보드 마우스 세트, 블루투스 연결", "business_justification": "사무환경 개선 및 작업 효율성 향상", "requested_by": "한사무", "department": "사무팀", "budget_approval": "승인됨"}',
    NULL,
    'in_progress',
    '한사무',
    '2024-01-17 14:00:00',
    '2024-01-18 10:30:00'
),

-- Firewall Access Request (영문) 샘플들
(
    'API Server Port Opening Request',
    'Third-party integration requires API server access through port 8080.',
    (SELECT id FROM ear_request_templates WHERE template_name = 'Firewall Access Request' LIMIT 1),
    '{"source_ip": "203.0.113.0/24", "dest_ip": "10.3.0.15", "port": 8080, "protocol": "TCP", "start_date": "2024-02-01", "end_date": "2024-12-31", "target_system": "API Gateway Server", "reason": "Third-party service integration", "service_name": "REST API Service"}',
    NULL,
    'approved',
    'John.Developer',
    '2024-01-28 10:15:00',
    '2024-01-29 08:45:00'
),
(
    'Database Backup Server Access',
    'Automated backup system requires access to database server for daily backups.',
    (SELECT id FROM ear_request_templates WHERE template_name = 'Firewall Access Request' LIMIT 1),
    '{"source_ip": "192.168.10.100", "dest_ip": "10.4.0.25", "port": 5432, "protocol": "TCP", "start_date": "2024-01-01", "end_date": "2024-12-31", "target_system": "PostgreSQL Database", "reason": "Automated daily backup process", "service_name": "Database Backup"}',
    NULL,
    'completed',
    'Sarah.Admin',
    '2024-01-03 07:00:00',
    '2024-01-03 09:30:00'
),

-- 추가 다양한 상태의 요청들
(
    'VPN 접근 권한 신청',
    '재택근무를 위한 VPN 접근 권한을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '시스템 접근 신청' LIMIT 1),
    '{"target_system": "VPN Gateway", "access_type": "VPN", "access_period": "영구", "access_reason": "재택근무 및 원격 접근 필요", "requested_by": "김재택", "department": "마케팅팀"}',
    NULL,
    'rejected',
    '김재택',
    '2024-01-30 12:00:00',
    '2024-01-31 14:20:00'
),
(
    '프린터 설치 신청',
    '사무실에 새로 설치된 프린터를 네트워크에 연결하기 위한 설정을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = 'IT 장비 신청' LIMIT 1),
    '{"equipment_type": "프린터", "quantity": 1, "specification": "레이저 프린터, 네트워크 연결 지원", "business_justification": "사무실 문서 출력 효율성 향상", "requested_by": "이사무", "department": "총무팀", "budget_approval": "승인됨"}',
    NULL,
    'completed',
    '이사무',
    '2024-01-14 15:45:00',
    '2024-01-15 11:00:00'
),
(
    '웹콘솔 접근 권한 신청',
    '서버 모니터링을 위한 웹콘솔 접근 권한을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '시스템 접근 신청' LIMIT 1),
    '{"target_system": "모니터링 서버", "access_type": "웹콘솔", "access_period": "1개월", "access_reason": "시스템 상태 모니터링 및 성능 분석", "requested_by": "박모니터", "department": "운영팀"}',
    NULL,
    'in_progress',
    '박모니터',
    '2024-01-25 09:30:00',
    '2024-01-25 11:15:00'
),
(
    '계정 비활성화 신청',
    '퇴사 예정 직원의 계정을 비활성화하는 것을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = '계정 생성/변경 신청' LIMIT 1),
    '{"request_type": "계정 삭제", "user_name": "leaving.employee", "full_name": "퇴사예정자", "email": "leaving@company.com", "department": "영업팀", "roles": "일반사용자", "request_reason": "퇴사 처리로 인한 계정 비활성화"}',
    NULL,
    'pending',
    '김퇴사',
    '2024-02-01 13:00:00',
    '2024-02-01 13:00:00'
),
(
    '데스크톱 PC 교체 신청',
    '노후화된 데스크톱 PC를 새로운 모델로 교체하는 것을 신청합니다.',
    (SELECT id FROM ear_request_templates WHERE template_name = 'IT 장비 신청' LIMIT 1),
    '{"equipment_type": "데스크톱", "quantity": 1, "specification": "Intel i5, 8GB RAM, 256GB SSD, Windows 11", "business_justification": "노후화된 하드웨어로 인한 작업 효율 저하", "requested_by": "최사무", "department": "회계팀", "budget_approval": "승인됨"}',
    NULL,
    'approved',
    '최사무',
    '2024-01-29 16:20:00',
    '2024-01-30 09:45:00'
);

-- 삽입된 데이터 확인
SELECT 
    r.id,
    r.request_title,
    r.status,
    r.created_by,
    r.created_at,
    t.template_name
FROM ear_requests r
LEFT JOIN ear_request_templates t ON r.template_id = t.id
ORDER BY r.created_at DESC;
