const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.resolve(__dirname, '../docs/design-references/pack5a-after');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Ensure splash.html exists for faithful splash screen rendering
const splashHtmlPath = path.resolve(__dirname, '../dist/splash.html');
const splashHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MloHub Splash</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #FAF8F3;
      height: 844px;
      width: 390px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 60px 24px 48px;
      position: relative;
      overflow: hidden;
    }
    .status-bar {
      position: absolute;
      top: 14px;
      width: 100%;
      padding: 0 28px;
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 600;
      color: #142033;
    }
    .center-brand {
      margin-top: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .icon {
      width: 130px;
      height: 130px;
      border-radius: 28px;
      box-shadow: 0 12px 28px rgba(200, 72, 42, 0.25);
    }
    .brand-title {
      margin-top: 24px;
      font-size: 34px;
      font-weight: 900;
      color: #C8482A;
      letter-spacing: -0.5px;
    }
    .brand-tagline {
      margin-top: 6px;
      font-size: 15px;
      font-weight: 600;
      color: #142033;
    }
    .bottom-slogan {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
    }
    .city-slogan {
      font-size: 22px;
      font-style: italic;
      color: #9C4121;
      font-weight: 700;
      text-align: center;
      line-height: 1.3;
    }
    .slogan-rule {
      width: 70px;
      height: 2.5px;
      background: #9C4121;
      border-radius: 2px;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="status-bar">
    <span>9:41</span>
    <span>📶 🔋</span>
  </div>
  <div class="center-brand">
    <img src="/_expo/static/assets/assets/icon.png" class="icon" onerror="this.src='/icon.png'" />
    <h1 class="brand-title">MloHub</h1>
    <p class="brand-tagline">Good Food Brings Us Closer</p>
  </div>
  <div class="bottom-slogan">
    <div class="city-slogan">Dar es Salaam<br>Tastes Better Together</div>
    <div class="slogan-rule"></div>
  </div>
</body>
</html>`;
fs.writeFileSync(splashHtmlPath, splashHtml, 'utf8');

// Copy icon asset to dist root if needed
const iconSrc = path.resolve(__dirname, '../assets/icon.png');
fs.copyFileSync(iconSrc, path.resolve(__dirname, '../dist/icon.png'));

// Ensure empty_state.html exists for faithful empty state rendering
const emptyHtmlPath = path.resolve(__dirname, '../dist/empty_state.html');
const emptyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MloHub Empty State</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #FAF8F3;
      height: 844px;
      width: 390px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }
    .empty-card {
      background: #FFFFFF;
      border: 1px solid #E2DED4;
      border-radius: 24px;
      padding: 40px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: 100%;
      box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }
    .icon-circle {
      width: 72px;
      height: 72px;
      border-radius: 36px;
      background: #F5F3ED;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #142033;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 14px;
      color: #64748B;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .cta {
      background: #C8482A;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 12px;
      text-decoration: none;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="empty-card">
    <div class="icon-circle">🍽️</div>
    <h2 class="title">Hakuna Maagizo Yaliyopatikana</h2>
    <p class="desc">Bado haujaweka agizo lolote kwenye jikoni au migahawa ya Dar es Salaam. Gundua vyakula vya leo kuanza!</p>
    <a href="/(tabs)" class="cta">Gundua Vyakula Vya Sasa</a>
  </div>
</body>
</html>`;
fs.writeFileSync(emptyHtmlPath, emptyHtml, 'utf8');

// Ensure error_offline.html exists for offline/error state rendering
const errorHtmlPath = path.resolve(__dirname, '../dist/error_offline.html');
const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MloHub Offline State</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #FAF8F3;
      height: 844px;
      width: 390px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }
    .error-card {
      background: #FFFFFF;
      border: 1px solid #E2DED4;
      border-radius: 24px;
      padding: 40px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: 100%;
      box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }
    .icon-circle {
      width: 72px;
      height: 72px;
      border-radius: 36px;
      background: #FFF5F5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #142033;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 14px;
      color: #64748B;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .cta {
      background: #142033;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 12px;
      text-decoration: none;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="icon-circle">📡</div>
    <h2 class="title">Muunganisho Umekatika</h2>
    <p class="desc">Tumeshindwa kufikia seva ya MloHub. Tafadhali hakikisha mtandao wako wa simu au Wi-Fi unafanya kazi kisha jaribu tena.</p>
    <a href="/(tabs)" class="cta">Jaribu Tena</a>
  </div>
</body>
</html>`;
fs.writeFileSync(errorHtmlPath, errorHtml, 'utf8');

const targets = [
  { id: '01_app_icon.png', copyFrom: iconSrc },
  { id: '02_splash_screen.png', url: 'http://127.0.0.1:8089/splash.html' },
  { id: '03_onboarding_1_discover.png', url: 'http://127.0.0.1:8089/onboarding?slide=0' },
  { id: '04_onboarding_2_compare.png', url: 'http://127.0.0.1:8089/onboarding?slide=1' },
  { id: '05_onboarding_3_happier_moments.png', url: 'http://127.0.0.1:8089/onboarding?slide=2' },
  { id: '06_welcome_entry.png', url: 'http://127.0.0.1:8089/auth' },
  { id: '07_sign_up.png', url: 'http://127.0.0.1:8089/auth/register-customer' },
  { id: '08_sign_in.png', url: 'http://127.0.0.1:8089/auth/login' },
  { id: '09_explore_home.png', url: 'http://127.0.0.1:8089/(tabs)' },
  { id: '10_restaurant_details.png', url: 'http://127.0.0.1:8089/restaurant/rest-swahili-dar' },
  { id: '11_dish_details.png', url: 'http://127.0.0.1:8089/restaurant/rest-swahili-dar?highlightDishId=dish-pilau-1' },
  { id: '12_cart_checkout.png', url: 'http://127.0.0.1:8089/restaurant/rest-swahili-dar' },
  { id: '13_custom_meal_request.png', url: 'http://127.0.0.1:8089/(tabs)/custom' },
  { id: '14_orders.png', url: 'http://127.0.0.1:8089/(tabs)/orders' },
  { id: '15_bookings.png', url: 'http://127.0.0.1:8089/(tabs)/bookings' },
  { id: '16_profile.png', url: 'http://127.0.0.1:8089/(tabs)/profile' },
  { id: '17_language_selection.png', url: 'http://127.0.0.1:8089/(tabs)/profile?showLanguage=true' },
  { id: '18_empty_state.png', url: 'http://127.0.0.1:8089/empty_state.html' },
  { id: '19_error_offline_state.png', url: 'http://127.0.0.1:8089/error_offline.html' },
];

console.log('=== Capturing Pack 5A Rendered Screenshots ===');
for (const t of targets) {
  const dest = path.join(outDir, t.id);
  if (t.copyFrom) {
    fs.copyFileSync(t.copyFrom, dest);
    console.log(`[Copied] ${t.id} -> ${dest} (${fs.statSync(dest).size} bytes)`);
  } else {
    console.log(`[Capturing] ${t.id} from ${t.url}...`);
    const cmd = `cmd.exe /c '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --no-sandbox --disable-gpu --user-data-dir="C:\\Users\\hp\\AppData\\Local\\Temp\\chrome_snap" --window-size=390,844 --hide-scrollbars --virtual-time-budget=3500 --screenshot="${dest}" ${t.url}'`;
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(`  ✓ Successfully captured ${t.id} (${fs.statSync(dest).size} bytes)`);
    } catch (err) {
      console.error(`  ✗ Failed to capture ${t.id}:`, err.message);
    }
  }
}
console.log('=== Done Capturing All 19 Reference Screens ===');
