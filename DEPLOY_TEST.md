# My Wealth 테스트 배포

아이폰에서 Safari 홈 화면 추가로 앱처럼 테스트하기 위한 배포 메모입니다.

## 권장 흐름

1. Render 또는 비슷한 서비스에 `backend`를 Web Service로 배포합니다.
2. API 주소를 확인합니다.
   - 예: `https://my-wealth-api.onrender.com/api/v1`
3. `mobile`을 Static Site로 배포합니다.
4. Static Site 빌드 환경변수에 아래 값을 넣습니다.
   - `EXPO_PUBLIC_API_BASE_URL=https://배포된-api주소/api/v1`
5. 아이폰 Safari에서 웹앱 주소 접속 후 공유 버튼 → 홈 화면에 추가.

## Backend

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Environment variables:

```bash
SECRET_KEY=긴_랜덤_문자열
CORS_ORIGINS=*
```

테스트 단계에서는 SQLite를 그대로 써도 됩니다. 다만 무료 배포 서버에서는 재시작/재배포 때 DB 파일이 사라질 수 있으니, 실제 사용이 길어지면 PostgreSQL로 옮기는 것이 좋습니다.

## Web

Build command:

```bash
npm ci && npx expo export --platform web
```

Publish directory:

```bash
dist
```

Environment variables:

```bash
EXPO_PUBLIC_API_BASE_URL=https://배포된-api주소/api/v1
```

## Local Checks

```bash
cd mobile
npm run typecheck
npm run export:web
```

```bash
cd backend
../.venv/Scripts/python.exe -m compileall .
```
