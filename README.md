# Daah_board_NEW — 매출 대시보드 (팀 메모 동기화)

엑셀 매출 데이터를 업로드해 분석하는 단일 HTML 대시보드.
팀별 메모를 Firebase Realtime Database로 동기화한다.

## 주요 파일

| 파일 | 설명 |
|---|---|
| `매출대시보드_팀동기화.html` | **최신 배포본** — Firebase 팀 메모 동기화 + 날짜별 메모 그룹 |
| `Firebase_팀메모동기화_설정가이드.md` | Firebase 프로젝트 생성·설정 가이드 |
| `sales_dashboard_범용.html` | 동기화 기능 추가 전 버전 |
| `sales_dashboard_v2.html` | 구버전 |
| `build_dashboard.py`, `main_script8.js`, `main_css.txt`, `html_out.txt` | 빌드/소스 자료 |

## 사용 방법

`매출대시보드_팀동기화.html`을 브라우저로 열고 엑셀 파일 업로드.
처음 열면 소속 팀 선택 → 메모가 자동으로 팀 저장소에 동기화됨.
