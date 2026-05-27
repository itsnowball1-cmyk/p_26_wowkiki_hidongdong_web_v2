# NAS 배포 (`/volume1/docker/hidongdong_web/`)

## 파일 구성
- `docker-compose.yml` — db + api + web 3 컨테이너 정의
- `Dockerfile.api` — Node + tsc 로 API 이미지 빌드
- `Dockerfile.web` — vite build → nginx 이미지 빌드
- `nginx.conf` — SPA fallback + `/api` → `api:4011` 프록시
- `.env.example` → `.env` 로 복사해 비밀번호 설정
- `db/init.sh` — dump 첫 줄(MariaDB 11.x sandbox-mode 디렉티브) 제거 후 import
- `db/dump.sql` — 운영 dump (사내 채널로 받아 직접 둘 것, git 미포함)
- `code/` — 소스 (rsync 로 동기화)

## 배포 절차
프로젝트 루트에서 (로컬 개발 머신):
```sh
# 1) 프론트 빌드 산출물 외 소스 코드 + 배포파일을 NAS 로 동기화
rsync -avz --delete \
  --exclude='node_modules' --exclude='dist' --exclude='dist-server' \
  --exclude='.env' --exclude='.git' \
  deploy/nas/ code/ \
  duckbest@nas.intellicode.kr:/volume1/docker/hidongdong_web/

# 2) NAS 에서 컨테이너 빌드 & 기동
ssh duckbest@nas.intellicode.kr \
  "cd /volume1/docker/hidongdong_web && /usr/local/bin/docker compose up -d --build"
```

## 첫 부팅
1. `.env` 가 NAS 에 없으면 만들기 (DB_PASSWORD 설정)
2. `db/dump.sql` 가 NAS 에 있는지 확인 (사내 채널로 받은 운영 dump)
3. `docker compose up -d --build` — db 컨테이너 첫 부팅에서 dump 자동 import (수십 초)
4. `docker compose ps` 로 모두 healthy/Up 확인
5. https://dev-hidongdong.intellicode.kr 접속

## DB 리셋
```sh
ssh duckbest@nas.intellicode.kr \
  "cd /volume1/docker/hidongdong_web && /usr/local/bin/docker compose down -v && /usr/local/bin/docker compose up -d --build"
```
