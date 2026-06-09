# NAS 정적 파일 서버 — api.wowkiki.kr

`api.wowkiki.kr/dataCenter/...` 로 들어오는 음성·이미지 등 정적 파일을 NAS 가 서빙.
(AWS 3.36.33.248 의 nginx vhost `back-ssl` 의 `/dataCenter/` 역할 대체)

## NAS 디렉터리 구조

```
/volume1/docker/files_wowkiki/
├── docker-compose.yml
├── nginx.conf
└── dataCenter/        # AWS 에서 rsync 로 복제
    ├── data/idx_xxx/*.wav
    ├── UploadFiles/
    └── ...
```

## 포트
- 호스트 `3013` → 컨테이너 `80`

## DSM 리버스 프록시 (제어판 → 로그인 포털 → 고급 → 역방향 프록시)
| 항목 | 값 |
|---|---|
| 설명 | hidongdong-files |
| 원본 프로토콜 | HTTPS |
| 원본 호스트 이름 | `api.wowkiki.kr` |
| 원본 포트 | 443 |
| 대상 프로토콜 | HTTP |
| 대상 호스트 이름 | `localhost` |
| 대상 포트 | `3013` |

## SSL — Let's Encrypt
DSM 제어판 → 보안 → 인증서 → `api.wowkiki.kr` 단일 도메인 발급 후 위 역방향 프록시에 매핑.

> 가비아 DNS `api` 호스트가 NAS(220.116.75.227)를 가리키도록 변경된 뒤 Let's Encrypt HTTP-01 챌린지 가능.

## 운영 명령
```sh
ssh duckbest@nas.intellicode.kr "cd /volume1/docker/files_wowkiki && /usr/local/bin/docker compose up -d"
ssh duckbest@nas.intellicode.kr "cd /volume1/docker/files_wowkiki && /usr/local/bin/docker compose restart"

# AWS 와 재 동기화 (변경된 파일만)
ssh duckbest@nas.intellicode.kr "rsync -avz --partial -e 'ssh -i ~/.ssh/wowkiki_front.pem' wowkiki_front@3.36.33.248:/home/wowkiki_back/docker/html/dataCenter/ /volume1/docker/files_wowkiki/dataCenter/"
```
