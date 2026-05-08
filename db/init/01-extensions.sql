-- SAMKWANG-PROS 데이터베이스 초기화
-- 이 디렉토리의 *.sql 파일은 PostgreSQL 컨테이너 최초 기동 시 실행됩니다.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
