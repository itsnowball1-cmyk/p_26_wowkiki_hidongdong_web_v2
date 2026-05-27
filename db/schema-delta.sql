-- 스키마=271833 / 데이터=271543 조합용.
-- 271543(구 스키마) 적재 후, 271833 추가분(tb_member 2컬럼 + 신규 5테이블)을 그대로 얹는다.
-- DDL 은 dump-wowkiki-202605271833.sql 에서 추출 (추측 아님).
SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE tb_member
  ADD COLUMN license_file_nm varchar(255) DEFAULT NULL,
  ADD COLUMN approval_status varchar(20) DEFAULT NULL;

DROP TABLE IF EXISTS `tb_institution`;
CREATE TABLE `tb_institution` (
  `idx` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `inst_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `inst_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `business_reg_num` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_detail` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `director_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `other_requests` text COLLATE utf8mb4_general_ci,
  `doctor_sheets` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `therapist_sheets` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `regist_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idx`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tb_approval_history`;
CREATE TABLE `tb_approval_history` (
  `idx` int NOT NULL AUTO_INCREMENT,
  `member_idx` int NOT NULL,
  `attempt_number` int NOT NULL,
  `source_file_nm` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_data` longtext COLLATE utf8mb4_general_ci,
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idx`),
  KEY `idx_member` (`member_idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tb_license_file`;
CREATE TABLE `tb_license_file` (
  `idx` int NOT NULL AUTO_INCREMENT,
  `member_idx` int NOT NULL,
  `source_file_nm` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_nm` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_data` longtext COLLATE utf8mb4_general_ci,
  `regist_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idx`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tb_sms_template`;
CREATE TABLE `tb_sms_template` (
  `idx` int NOT NULL AUTO_INCREMENT,
  `template_key` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `template_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `template_body` text COLLATE utf8mb4_general_ci NOT NULL,
  `update_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idx`),
  UNIQUE KEY `template_key` (`template_key`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tb_sms_verification`;
CREATE TABLE `tb_sms_verification` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(6) COLLATE utf8mb4_general_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `verified` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;
