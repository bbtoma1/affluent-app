# 웅덩이 트레이더 (MVP)

하락 구간(웅덩이)에서 규칙에 따라 1·2·3차 분할매수 구간을 알려 주는 모바일 웹앱(PWA).
점수 계산(`engine.js`)을 화면과 백테스트가 **같은 코드**로 공유하고, 모든 신호를 "아무 날 매수" 기준선과 비교합니다.
투자 권유가 아니며 수익을 보장하지 않습니다.

## 들어 있는 것
| 파일 | 역할 |
|---|---|
| `engine.js` | 지표·점수·차수·과열 중단·이벤트 연구·시뮬레이션. 브라우저/Node 공용 |
| `app.js`, `index.html`, `styles.css`, `sw.js` | 모바일 화면(오늘·종목·검증·내 계좌), 오프라인 열림 |
| `data/universe.json` | 종목 목록(여기서 추가/삭제) |
| `tools/update_data.py` | 야후 시세 수집. 접근 제한이면 우회 없이 중단하고 이전 데이터 유지 |
| `tools/backtest.js` | 기준선 비교, 표본 외(뒤 30%), 지수·섹터 ETF, 시뮬레이션 → `data/backtest.json` |
| `tools/test_engine.js` | 룩어헤드 금지 등 엔진 테스트 |
| `tools/collect_subs.py` | 유튜브 한국어 자막 수집(내 PC에서 실행, 이어받기·제한 시 5분 대기) |
| `tools/privacy_check.py` | 배포 전 이메일·키·경로 점검 |
| `.github/workflows/update-data.yml` | 자동 갱신·검증·배포 |

## 지금 상태
- `data/px` 는 **합성 데모 데이터**입니다(화면 확인용, 상단에 "데모" 표시). 첫 `update_data.py` 실행 시 실제 데이터로 교체됩니다.
- 유튜브 채널 규칙은 **아직 반영 전**입니다. 현재 점수는 낙폭·200일선 이격·주봉/일봉 RSI·MACD·VIX 기반의 기본 규칙입니다.

## 실행
```
node tools/test_engine.js                 # 엔진 테스트
python tools/update_data.py               # 실제 시세 받기(인터넷 필요)
node tools/backtest.js                    # 검증 결과 생성
python -m http.server 8000                # 로컬에서 열기 → http://localhost:8000
```

## 채널 규칙 반영(다음 단계)
1. `python tools/collect_subs.py <채널주소> subs` 로 자막 수집
2. 자막에서 뽑은 원칙을 `engine.js` 의 `E.LENS`(가중치·임계값)와 `parts()` 신호로 옮김
3. `node tools/backtest.js` 로 기준선 대비 확인. **결과가 나쁘면 나쁜 대로 기록**하고 규칙을 끼워 맞추지 않음
4. 채널이 늘면 `LENS` 를 채널별로 나눠 관점 전환(통합 점수) 추가

## GitHub Pages 배포(무료)
1. GitHub 가입 후 새 **공개** 저장소 생성, 이 폴더를 올림
2. Settings → Pages → Source 를 "GitHub Actions" 로 설정
3. Actions 탭에서 `update-data` 를 수동 실행 → 완료되면 주소(`https://<계정>.github.io/<저장소>/`) 확인
4. 휴대폰 브라우저로 열고 "홈 화면에 추가"
- 커밋 이메일은 noreply 주소를 쓰고, 계정·비밀은 코드에 넣지 마세요.
- 저장소 활동이 60일 없으면 예약 실행이 멈출 수 있습니다(Actions 탭에서 다시 켜기).

## 한계
- 과거 검증은 미래를 보장하지 않습니다. 합성 데이터 결과는 의미가 없습니다.
- 야후 차트는 비공식 경로라 막히거나 바뀔 수 있습니다(막히면 상단 칩이 표시).
- 거래비용·세금·슬리피지는 반영하지 않았습니다.
- 레버리지 ETF 환산, 적정가(현금흐름), 거물 거래, 자동 보정은 아직 없습니다.
