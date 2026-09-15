// 검증 스위트 공용 설정. 경로를 한 곳에만 두어 어느 PC에서도 돌게 한다.
const path = require('path');
const fs   = require('fs');
const { chromium } = require('playwright');

const PORT    = process.env.TEST_PORT || 8899;
const URL     = `http://localhost:${PORT}/tests/.fixture/test_dash.html`;
const FIXTURE = path.resolve(__dirname, '.fixture', 'sample.xlsx');

// Playwright 가 기본 경로에서 브라우저를 못 찾는 환경이 있어, 흔한 위치를 되짚는다.
function findChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH,
                 path.join(process.env.HOME || '', '.cache', 'ms-playwright'),
                 path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')].filter(Boolean);
  const bins = ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'];
  for (const root of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(root).filter(d => /^chromium-\d+$/.test(d)); } catch (e) { continue; }
    for (const d of dirs) for (const b of bins) {
      const p = path.join(root, d, b);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function launch() {
  try { return await chromium.launch(); }
  catch (e) {
    const exe = findChromium();
    if (!exe) throw new Error(
      'Chromium 을 찾지 못했습니다. `npx playwright install chromium` 을 실행하거나 ' +
      'PW_CHROMIUM 환경변수로 실행 파일 경로를 지정하세요.\n원인: ' + e.message.split('\n')[0]);
    return chromium.launch({ executablePath: exe });
  }
}

module.exports = { launch, URL, FIXTURE, PORT };
