# 메일 발송 모듈 (SAMKWANG-PROS)

## 개요

- **메일설정** (`MailSmtpSettings`): SMTP 호스트·포트·TLS·계정·암호화된 비밀번호·발신자. 단일 행 `id=default`.
- **메일발송메뉴** (`MailMenu`): 종류별 기본 제목·본문.
- **메일발송정보** (`MailSendRule`): 스케줄(DAILY 또는 CRON), 수신자(JSON 배열), 제목·본문, 선택적 `mailMenuId`.
- **발송 이력** (`MailSendLog`): 규칙별 성공/실패 로그.

## API (인증 필요, `/api` 접두사)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET/PUT | `/mail/smtp` | SMTP 설정 조회·저장 |
| POST | `/mail/smtp/test` | 테스트 메일 (`{ "to": "email" }`) |
| CRUD | `/mail/rules` | 발송 규칙 |
| GET | `/mail/rules/:id/logs` | 규칙별 로그 |
| CRUD | `/mail/menus` | 발송 메뉴(템플릿) |

## 스케줄·타임존

- **DAILY**: `dailyTime`은 `HH:mm`, 요일은 `dailyDaysMask` 비트(일=bit0 … 토=bit6). **Asia/Seoul** 기준으로 매분 평가합니다.
- **CRON**: [cron-parser](https://github.com/harrisiirak/cron-parser) v5 형식. **6필드**(초 분 시 일 월 요일)를 사용하며, **5필드** 입력 시 앞에 `0`(초)을 붙입니다.

## 스케줄러

- Nest `@nestjs/schedule`: 매분 `0 * * * * *`에 활성 규칙을 평가합니다.
- 동일 **UTC 분 슬롯**에 대해 `lastRunSlotUtc`로 중복 발송을 방지합니다(시도 후 성공/실패 모두 슬롯 소비).

## 암호화

- 환경 변수 `MAIL_ENCRYPTION_KEY`(임의 긴 문자열 권장). 비어 있으면 개발용 기본 문자열이 사용됩니다.
- SMTP 비밀번호는 **AES-256-GCM** 후 `passwordCipher`에 저장합니다.

## 운영 참고

- 프로덕션에서는 `MAIL_ENCRYPTION_KEY`를 반드시 설정하고, SMTP 자격 증명을 `.env`에 두지 말고 UI로만 저장하는 것을 권장합니다.
