# NAS 개발(dev) 배포 (`/volume1/docker/hidongdong_web_dev/`)

운영(`hidongdong.wowkiki.kr` → 3011)과 같은 NAS 에 분리해서 띄우는 개발 환경.
도메인: **`dev-hidongdong.wowkiki.kr`** → 3012

## 운영과의 차이

| 항목 | 운영 | 개발(이 폴더) |
|---|---|---|
| 컨테이너 이름 | hidongdong-* | hidongdong-dev-* |
| web 포트 | 3011 | 3012 |
| api 포트 | 4011 | 4012 |
| DB 볼륨 | hidongdong-db-data | hidongdong-dev-db-data |
| 도메인 | hidongdong.wowkiki.kr | dev-hidongdong.wowkiki.kr |

## NAS 디렉터리 구조

```
/volume1/docker/hidongdong_web_dev/
├── docker-compose.yml      # 이 폴더에서 복사
├── Dockerfile.api          # deploy/nas/ 와 동일 (단일 출처)
├── Dockerfile.web          # deploy/nas/ 와 동일
├── nginx.conf              # deploy/nas/ 와 동일
├── .dockerignore           # deploy/nas/ 와 동일
├── .env                    # 이 폴더의 .env.example 복사 후 채움
├── code/                   # 프로젝트 code/ 동기화
└── db/
    ├── dump.sql            # 운영 dump (사내 채널 또는 mysqldump)
    ├── init.sh
    ├── schema-delta.sql
    └── tb_terms-*.sql
```

> Dockerfile/nginx.conf 는 운영과 단일 출처(`deploy/nas/`) — 배포 시 그쪽 파일을 같이 복사.

## DNS / SSL / 리버스 프록시 (운영과 동일 패턴)

1. **가비아 DNS**: `dev-hidongdong` 호스트 A 레코드 → `220.116.75.227`
2. **DSM 리버스 프록시**: `dev-hidongdong.wowkiki.kr:443` → `localhost:3012`
3. **DSM Let's Encrypt**: `dev-hidongdong.wowkiki.kr` 인증서 발급 후 위 프록시에 매핑

## 운영 명령

```sh
# 빌드 + 시작
ssh duckbest@nas.intellicode.kr "cd /volume1/docker/hidongdong_web_dev && /usr/local/bin/docker compose up -d --build"

# 재빌드만 (코드 갱신 후)
ssh duckbest@nas.intellicode.kr "cd /volume1/docker/hidongdong_web_dev && /usr/local/bin/docker compose up -d --build api web"

# DB 전체 리셋 (볼륨 wipe, dump 재 import)
ssh duckbest@nas.intellicode.kr "cd /volume1/docker/hidongdong_web_dev && /usr/local/bin/docker compose down -v && /usr/local/bin/docker compose up -d --build"
```

운영(`hidongdong_web/`)과 동시 실행되며 서로 영향 없음.
