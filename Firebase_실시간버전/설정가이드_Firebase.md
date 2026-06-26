# Firebase 실시간 동기화 — 설정 가이드 (354명 규모용)

이 폴더의 `매출대시보드_Firebase.html`은 메모/공지를 **Firebase 실시간 데이터베이스**에 저장하고,
**Firebase 인증(구글 로그인) + 보안 규칙**으로 보호합니다. 입력 즉시 모두에게 실시간 반영되고,
폴링이 없어 354명+ 규모에 적합합니다.

> 무료(Spark) 플랜은 동시접속 100개 제한이 있습니다. 업무시간 피크에 100을 넘기면
> 새 접속이 거부되니, 안정 운영하려면 나중에 Blaze(종량제)로 업그레이드하세요. (메모 용도라 비용은 적음)

---

## 1단계. Firebase 프로젝트 만들기
1. https://console.firebase.google.com → **프로젝트 추가** → 이름 입력(예: `sales-dashboard`) → 생성.

## 2단계. Realtime Database 만들기
1. 왼쪽 **빌드 → Realtime Database → 데이터베이스 만들기**.
2. 위치: **싱가포르(asia-southeast1)** 권장.
3. 보안 규칙: **잠금 모드로 시작** 선택(곧 3단계에서 교체).
4. 만들어지면 **데이터 탭 상단의 URL**(`https://....firebasedatabase.app`)을 메모해 두세요 → 6단계에서 사용.

## 3단계. 보안 규칙 게시
1. Realtime Database → **규칙(Rules)** 탭.
2. 이 폴더의 **`database.rules.json`** 내용을 통째로 붙여넣기 → **게시(Publish)**.
3. 이 규칙은 "**로그인했고 + 허용 명단(allowedEmails)에 있는 이메일**"만 읽기/쓰기를 허용합니다.

## 4단계. 구글 로그인 켜기
1. 왼쪽 **빌드 → Authentication → 시작하기**.
2. **Sign-in method → Google → 사용 설정** → 프로젝트 지원 이메일 선택 → 저장.

## 5단계. 승인된 도메인 추가 (중요)
1. **Authentication → Settings(설정) → 승인된 도메인(Authorized domains)**.
2. 대시보드가 열리는 주소를 추가: **`bbong112233-del.github.io`**
   (`localhost`는 기본 포함되어 로컬 테스트는 됩니다.)
   - 이게 없으면 구글 로그인 팝업이 "도메인 미승인"으로 막힙니다.

## 6단계. firebaseConfig를 HTML에 붙여넣기
1. 프로젝트 설정(⚙️) → **내 앱** → 웹앱이 없으면 **</> 웹 앱 추가** → 등록.
2. 표시되는 **firebaseConfig** 값을 `매출대시보드_Firebase.html` 상단의 `FIREBASE_CONFIG`에 채웁니다:
   ```js
   var FIREBASE_CONFIG = {
     apiKey: "AIza....",
     authDomain: "sales-dashboard-xxxx.firebaseapp.com",
     databaseURL: "https://sales-dashboard-xxxx-default-rtdb.firebasedatabase.app",
     projectId: "sales-dashboard-xxxx"
   };
   ```
   - `databaseURL`이 config에 안 보이면 2단계에서 메모한 데이터 탭 URL을 넣으세요. **이게 비어 있으면 동기화가 안 됩니다.**
   - 참고: `apiKey`는 비밀이 아니라 클라이언트에 넣는 게 정상입니다(공개 repo에 올라가도 안전). 보안은 인증+규칙이 담당합니다.

## 7단계. 허용 명단(allowedEmails) 등록 — 핵심
규칙이 `allowedEmails` 노드를 보고 접근을 허용합니다. 여기에 팀원 이메일을 등록해야 합니다.
**이메일의 점(.)은 콤마(,)로 바꿔 키로 저장**합니다(소문자).

대량 등록 방법:
1. 브라우저 콘솔(F12)에 팀 이메일 목록을 넣고 아래를 실행해 JSON 생성:
   ```js
   var emails = [
     "team-member-1@gmail.com",
     "team-member-2@gmail.com"
     // ... 팀원 전체
   ];
   var out = { allowedEmails: {} };
   emails.forEach(function(e){ out.allowedEmails[e.trim().toLowerCase().split('.').join(',')] = true; });
   console.log(JSON.stringify(out, null, 2));
   ```
2. 출력된 JSON 복사.
3. Realtime Database **데이터 탭 → 오른쪽 ⋮ → JSON 가져오기(Import JSON)** → 붙여넣기 → 가져오기.
   - 결과 예: `allowedEmails/team-member-2@gmail,com: true`
4. 팀원 추가/삭제는 이 `allowedEmails` 노드에서 항목을 더하거나 지우면 됩니다. **재배포 불필요(즉시 적용).**

## 8단계. 호스팅 + 사용
1. `FIREBASE_CONFIG`를 채운 `매출대시보드_Firebase.html`을 GitHub Pages(또는 https)로 올립니다.
   (5단계의 승인 도메인과 일치해야 함: `bbong112233-del.github.io`)
2. 접속 → 우하단 **☁️ 배지 클릭 → 🔑 Google 로그인** → 팀 선택.
3. 이제 메모를 쓰면 **같은 팀의 모든 사람 화면에 즉시(실시간) 반영**됩니다.

---

## 동작 요약
- 로그인: 구글 로그인(팝업) → Firebase 인증.
- 저장: 메모 변경 시 **변경된 항목만** Firebase에 즉시 업로드(동시 편집 안전).
- 수신: 실시간 리스너가 변경을 즉시 받아 화면 갱신(폴링 없음).
- 보안: 규칙이 "로그인 + 허용 이메일"만 허용. 시트/주소 노출 없음.

## 주의 / 한계
- **무료 동시접속 100 제한.** 피크에 넘으면 Blaze(종량제)로 업그레이드 필요.
- `apiKey` 등 config는 공개돼도 안전(보안은 규칙+인증). 단 **allowedEmails 명단(팀 이메일)** 은 DB 안에만 두고, 굳이 공개 repo 파일에 넣지 마세요.
- 실시간 리스너는 메모 노드 전체를 받아오므로, 데이터가 아주 커지면 트래픽이 늘 수 있습니다(2개월 자동삭제로 보통 문제없음). 필요 시 항목 단위 리스너로 최적화 가능.
- 정식 보안 감사가 아니라 구조 설계 기준입니다. 운영 전 실제 로그인/동기화를 꼭 테스트하세요.
