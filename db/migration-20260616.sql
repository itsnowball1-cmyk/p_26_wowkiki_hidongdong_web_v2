-- ============================================================
-- 와우키키 운영 DB 마이그레이션 스크립트
-- 생성일: 2026-06-16
-- 기준: 기존 운영 덤프(2026-05-27 이전) 대비 추가된 전체 변경사항
-- 주의: 기존 데이터는 절대 건드리지 않습니다.
--       각 구문은 이미 적용되어 있으면 안전하게 스킵됩니다.
-- ============================================================
-- [포함된 변경사항]
--   tb_member        : phone, nickname, approval_status, license_file_nm, diag_days 컬럼 추가
--   tb_support_file  : file_data 컬럼 추가 (파일 미리보기)
--   tb_board_file    : FILE_DATA 컬럼 추가 (파일 미리보기)
--   tb_support       : reply_memo 컬럼 추가 (CS 답변)
--   tb_institution   : 신규 테이블 (기관/의사 정보)
--   tb_approval_history : 신규 테이블 (승인 이력)
--   tb_license_file  : 신규 테이블 (면허 파일)
--   tb_sms_template  : 신규 테이블 + 기본 데이터 4건
--   tb_sms_verification : 신규 테이블 (전화번호 인증)
--   tb_terms         : 신규 테이블 (약관 관리)
-- ============================================================

-- ① 신규 테이블: tb_institution
CREATE TABLE IF NOT EXISTS `tb_institution` (
  `idx`              int          NOT NULL AUTO_INCREMENT,
  `code`             varchar(20)  NOT NULL,
  `inst_type`        varchar(50)      NULL DEFAULT NULL,
  `inst_name`        varchar(255)     NULL DEFAULT NULL,
  `business_reg_num` varchar(50)      NULL DEFAULT NULL,
  `address`          varchar(500)     NULL DEFAULT NULL,
  `address_detail`   varchar(255)     NULL DEFAULT NULL,
  `director_name`    varchar(100)     NULL DEFAULT NULL,
  `other_requests`   text             NULL,
  `doctor_sheets`    varchar(20)      NULL DEFAULT NULL,
  `therapist_sheets` varchar(20)      NULL DEFAULT NULL,
  `regist_date`      datetime             DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idx`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ② 신규 테이블: tb_approval_history
CREATE TABLE IF NOT EXISTS `tb_approval_history` (
  `idx`           int          NOT NULL AUTO_INCREMENT,
  `member_idx`    int          NOT NULL,
  `attempt_number` int         NOT NULL,
  `source_file_nm` varchar(500)    NULL DEFAULT NULL,
  `file_data`     longtext         NULL,
  `submitted_at`  datetime             DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idx`),
  KEY `idx_member` (`member_idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ③ 신규 테이블: tb_license_file
CREATE TABLE IF NOT EXISTS `tb_license_file` (
  `idx`           int          NOT NULL AUTO_INCREMENT,
  `member_idx`    int          NOT NULL,
  `source_file_nm` varchar(255)    NULL DEFAULT NULL,
  `file_nm`       varchar(255)     NULL DEFAULT NULL,
  `file_data`     longtext         NULL,
  `regist_date`   datetime             DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ④ 신규 테이블: tb_sms_template
CREATE TABLE IF NOT EXISTS `tb_sms_template` (
  `idx`           int          NOT NULL AUTO_INCREMENT,
  `template_key`  varchar(50)  NOT NULL,
  `template_name` varchar(100) NOT NULL,
  `template_body` text         NOT NULL,
  `update_date`   datetime             DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idx`),
  UNIQUE KEY `template_key` (`template_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- tb_sms_template 기본 데이터 (중복 무시)
INSERT IGNORE INTO `tb_sms_template` (`template_key`, `template_name`, `template_body`) VALUES
  ('approve',         '의사/기관 승인 알림', '[와우키키] {name}님, {inst_name} 회원가입이 승인되었습니다.'),
  ('reject',          '의사/기관 반려 알림', '[와우키키] {name}님, {inst_name} 회원가입이 반려되었습니다. 사유: {reject_reason}'),
  ('teacher_approve', '치료사 승인 알림',    '[와우키키] {name}님, 치료사 회원가입이 승인되었습니다.'),
  ('teacher_reject',  '치료사 반려 알림',    '[와우키키] {name}님, 치료사 회원가입이 반려되었습니다. 사유: {reject_reason}');

-- ⑤ 신규 테이블: tb_sms_verification
CREATE TABLE IF NOT EXISTS `tb_sms_verification` (
  `id`         int          NOT NULL AUTO_INCREMENT,
  `phone`      varchar(20)  NOT NULL,
  `code`       varchar(6)   NOT NULL,
  `expires_at` datetime     NOT NULL,
  `verified`   tinyint(1)       DEFAULT '0',
  `created_at` datetime         DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ⑥ 신규 테이블: tb_terms
CREATE TABLE IF NOT EXISTS `tb_terms` (
  `terms_idx`   int          NOT NULL AUTO_INCREMENT,
  `terms_type`  varchar(30)  NOT NULL COMMENT 'privacy / service / marketing 등',
  `terms_title` varchar(200) NOT NULL,
  `terms_body`  longtext     NOT NULL,
  `use_yn`      char(1)      NOT NULL DEFAULT 'Y',
  `regist_date` datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_date` datetime         NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`terms_idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ⑦ tb_member 컬럼 추가
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tb_member' AND COLUMN_NAME='phone');
SET @s = IF(@c=0, 'ALTER TABLE tb_member ADD COLUMN phone varchar(15) DEFAULT NULL', 'SELECT "tb_member.phone: skip"');
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tb_member' AND COLUMN_NAME='nickname');
SET @s = IF(@c=0, 'ALTER TABLE tb_member ADD COLUMN nickname varchar(50) DEFAULT NULL', 'SELECT "tb_member.nickname: skip"');
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tb_member' AND COLUMN_NAME='approval_status');
SET @s = IF(@c=0, 'ALTER TABLE tb_member ADD COLUMN approval_status varchar(20) DEFAULT NULL', 'SELECT "tb_member.approval_status: skip"');
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tb_member' AND COLUMN_NAME='license_file_nm');
SET @s = IF(@c=0, 'ALTER TABLE tb_member ADD COLUMN license_file_nm varchar(255) DEFAULT NULL', 'SELECT "tb_member.license_file_nm: skip"');
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tb_member' AND COLUMN_NAME='diag_days');
SET @s = IF(@c=0, 'ALTER TABLE tb_member ADD COLUMN diag_days varchar(50) DEFAULT NULL', 'SELECT "tb_member.diag_days: skip"');
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ⑧ tb_support_file 에 file_data 컬럼 추가
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tb_support_file' AND COLUMN_NAME='file_data');
SET @s = IF(@c=0, 'ALTER TABLE tb_support_file ADD COLUMN file_data LONGTEXT DEFAULT NULL', 'SELECT "tb_support_file.file_data: skip"');
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ⑨ tb_board_file 에 FILE_DATA 컬럼 추가
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tb_board_file' AND COLUMN_NAME='FILE_DATA');
SET @s = IF(@c=0, 'ALTER TABLE tb_board_file ADD COLUMN FILE_DATA LONGTEXT DEFAULT NULL', 'SELECT "tb_board_file.FILE_DATA: skip"');
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ⑩ tb_support 에 reply_memo 컬럼 추가
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tb_support' AND COLUMN_NAME='reply_memo');
SET @s = IF(@c=0, 'ALTER TABLE tb_support ADD COLUMN reply_memo text DEFAULT NULL', 'SELECT "tb_support.reply_memo: skip"');
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- 완료. "skip" 메시지는 이미 적용된 항목이므로 정상입니다.
-- ============================================================
