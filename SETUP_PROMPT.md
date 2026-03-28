# Claude Usage Tool - 원클릭 셋업 프롬프트

아래 프롬프트를 Claude Code에 붙여넣으면 한방에 셋업됩니다.

---

## 새 PC 셋업 (텔레그램 없이)

```
이 프로젝트(claude-usage-tool)를 셋업해줘.

1. npm install 실행
2. TypeScript 빌드: npx tsc -p tsconfig.electron.json
3. macOS LaunchAgent 등록 (로그인 시 자동 실행):
   - start.sh 안의 node 경로를 현재 환경의 `which node` 경로로 수정
   - ~/Library/LaunchAgents/com.user.claude-usage-tool.plist 생성
   - Label: com.user.claude-usage-tool
   - ProgramArguments: /bin/bash <프로젝트경로>/start.sh
   - RunAtLoad: true
   - 로그: /tmp/claude-usage-tool.log
   - launchctl load로 등록
4. npm run electron:dev 로 앱 실행
```

---

## 맥미니 셋업 (텔레그램 포함)

```
이 프로젝트(claude-usage-tool)를 셋업해줘. 텔레그램 알림도 활성화해야 해.

1. npm install 실행
2. TypeScript 빌드: npx tsc -p tsconfig.electron.json
3. .env.local 파일 생성:
   TELEGRAM_BOT_TOKEN=<봇토큰>
   TELEGRAM_CHAT_ID=<챗ID>
   (봇토큰과 챗ID는 내가 알려줄게)
4. macOS LaunchAgent 등록 (로그인 시 자동 실행):
   - start.sh 안의 node 경로를 현재 환경의 `which node` 경로로 수정
   - ~/Library/LaunchAgents/com.user.claude-usage-tool.plist 생성
   - Label: com.user.claude-usage-tool
   - ProgramArguments: /bin/bash <프로젝트경로>/start.sh
   - RunAtLoad: true
   - 로그: /tmp/claude-usage-tool.log
   - launchctl load로 등록
5. 텔레그램 테스트 메시지 전송해서 연동 확인
6. npm run electron:dev 로 앱 실행
```

---

## 참고

- 텔레그램 설정(.env.local)은 .gitignore에 포함되어 git에 올라가지 않음
- 텔레그램 봇 토큰은 @BotFather에서 생성
- Chat ID는 봇에게 메시지 보낸 후 `https://api.telegram.org/bot<TOKEN>/getUpdates` 에서 확인
- 현재 세션 사용량이 10% 단위로 넘어갈 때마다 텔레그램 알림 발송
