# AgentFlow AI

AgentFlow AI turns a natural-language goal into a practical, trackable workflow.

## MVP features
- Local planning mode with no API cost
- Optional OpenAI integration
- Automatic fallback to local planning when the API is unavailable or out of credits
- 5–8 task workflow generation
- Checklist and live progress
- Workflow statistics
- Recent workflow history stored in the browser
- Responsive mobile-first UI

## Run locally
```bash
npm install
npm start
```

Open http://127.0.0.1:3000

The app works without an API key. If an API key is present but the API cannot be used, AgentFlow automatically falls back to local demo mode.
