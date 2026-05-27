-- 로컬 개발용 스키마 보강.
-- 운영 dump(구 스키마) 위에 현재 코드(승인 워크플로우 등)가 요구하는 객체를 추가한다.
-- 정의 근거: code/server/api.ts 의 주석·사용처. 운영 DB 에는 아직 미반영된 스키마이며,
-- 정식 마이그레이션 DDL 확보 시 이 파일을 그것으로 교체할 것.

-- tb_member 보강 컬럼 (기존 운영 행은 모두 NULL → approval_status NULL = 정상 승인 취급)
ALTER TABLE tb_member
  ADD COLUMN approval_status VARCHAR(20) NULL DEFAULT NULL,
  ADD COLUMN license_file_nm VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN diag_days       VARCHAR(50)  NULL DEFAULT NULL;

-- 기관 테이블 (code/server/api.ts 주석의 DDL 그대로)
CREATE TABLE IF NOT EXISTS tb_institution (
  idx              INT PRIMARY KEY AUTO_INCREMENT,
  code             VARCHAR(20) UNIQUE NOT NULL,
  inst_type        VARCHAR(50),
  inst_name        VARCHAR(255),
  business_reg_num VARCHAR(50),
  address          VARCHAR(500),
  address_detail   VARCHAR(255),
  director_name    VARCHAR(100),
  other_requests   TEXT,
  doctor_sheets    VARCHAR(20),
  therapist_sheets VARCHAR(20),
  regist_date      DATETIME DEFAULT NOW()
);

-- 선택적 로그/부가 테이블(tb_login_log, tb_custom_log, tb_task_log, tb_activity_log,
-- tb_license_file, tb_sms_template)은 코드가 try/catch 로 부재를 허용하므로 생략.
-- 해당 화면이 필요해지면 정식 DDL 확보 후 추가.
