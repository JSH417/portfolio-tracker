# 포트폴리오 트래커

한국 ETF · 달러RP · KRW 현금 포트폴리오 실시간 시각화 + 리밸런싱 플래너

## 기능

- **포트폴리오 대시보드**: FINVIZ식 트리맵 + 카테고리 도넛 차트
- **실시간 시세**: yfinance로 한국 ETF 현재가 자동 조회 (15분 캐시)
- **USD/KRW 환율**: 실시간 반영, KRW + USD 병렬 표시
- **리밸런싱 플래너**: 목표 비중 설정 → 이번 달 투자금 입력 → 매수 계획 자동 산출
- **매도 없는 리밸런싱**: 신규 자금으로만 부족분 채움 (세금 최소화)
- **모바일 지원**: 스마트폰 브라우저에서도 사용 가능

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Charts | Recharts (Treemap, PieChart) |
| Backend | Python FastAPI |
| 시세 | yfinance (`.KS` 한국 ETF) |
| 환율 | yfinance `USDKRW=X` |
| DB | SQLite (로컬) / Render 영구 디스크 (배포) |
| 배포 | Render (백엔드 웹서비스 + 프론트엔드 정적사이트) |

## 로컬 실행

### 백엔드
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API 문서: http://localhost:8000/docs

### 프론트엔드
```bash
cd frontend
npm install
npm run dev
```
앱: http://localhost:5173

## Render 배포

1. GitHub에 이 프로젝트를 push
2. [render.com](https://render.com) 에서 "New Blueprint"
3. `render.yaml` 이 있는 저장소 연결
4. 자동으로 백엔드 + 프론트엔드 두 서비스 생성

> 백엔드 URL이 확정된 후 `render.yaml`의 `VITE_API_URL` 값을 실제 URL로 수정하세요.

## 지원 자산 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `etf_kr` | 한국 ETF | 379800 (KODEX S&P500), 133690 (TIGER 나스닥100) |
| `dollar_rp` | 달러RP (USD 금액 입력) | $2,000 → 환율 자동 변환 |
| `cash_krw` | KRW 현금 | ₩500,000 |

## 자주 쓰는 한국 ETF 종목코드

| 종목코드 | ETF명 | 카테고리 |
|----------|-------|---------|
| 379800 | KODEX 미국S&P500TR | 주식 |
| 133690 | TIGER 미국나스닥100 | 주식 |
| 421433 | KODEX 미국배당다우존스 | 주식 |
| 148070 | KOSEF 국고채10년 | 채권 |
| 114820 | KODEX 국고채3년 | 채권 |
| 411060 | TIGER 금현물 | 금 |
