const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const TARGET_DIR = path.join(__dirname, '..', 'assets', 'payments');
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function hexToRgba(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return [
    (num >> 16) & 255,
    (num >> 8) & 255,
    num & 255,
    255
  ];
}

function createLogoCanvas(width, height) {
  const png = new PNG({ width, height });
  // Transparent background
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }
  return png;
}

function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  const currentA = png.data[idx + 3] / 255;
  const newA = a / 255;
  const outA = newA + currentA * (1 - newA);
  if (outA === 0) return;

  png.data[idx] = Math.round((r * newA + png.data[idx] * currentA * (1 - newA)) / outA);
  png.data[idx + 1] = Math.round((g * newA + png.data[idx + 1] * currentA * (1 - newA)) / outA);
  png.data[idx + 2] = Math.round((b * newA + png.data[idx + 2] * currentA * (1 - newA)) / outA);
  png.data[idx + 3] = Math.round(outA * 255);
}

function drawRoundedRect(png, x0, y0, w, h, radius, r, g, b, a = 255) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      let dx = 0;
      let dy = 0;
      if (x < x0 + radius) dx = x0 + radius - x;
      else if (x >= x0 + w - radius) dx = x - (x0 + w - radius - 1);

      if (y < y0 + radius) dy = y0 + radius - y;
      else if (y >= y0 + h - radius) dy = y - (y0 + h - radius - 1);

      if (dx > 0 && dy > 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius - 0.5) {
          setPixel(png, x, y, r, g, b, a);
        } else if (dist <= radius + 0.5) {
          const alphaFactor = Math.max(0, Math.min(1, radius + 0.5 - dist));
          setPixel(png, x, y, r, g, b, Math.round(a * alphaFactor));
        }
      } else {
        setPixel(png, x, y, r, g, b, a);
      }
    }
  }
}

function drawCircle(png, cx, cy, radius, r, g, b, a = 255) {
  const minX = Math.floor(cx - radius - 1);
  const maxX = Math.ceil(cx + radius + 1);
  const minY = Math.floor(cy - radius - 1);
  const maxY = Math.ceil(cy + radius + 1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius - 0.5) {
        setPixel(png, x, y, r, g, b, a);
      } else if (dist <= radius + 0.5) {
        const alpha = Math.max(0, Math.min(1, radius + 0.5 - dist));
        setPixel(png, x, y, r, g, b, Math.round(a * alpha));
      }
    }
  }
}

function drawRing(png, cx, cy, innerRadius, outerRadius, r, g, b, a = 255) {
  const minX = Math.floor(cx - outerRadius - 1);
  const maxX = Math.ceil(cx + outerRadius + 1);
  const minY = Math.floor(cy - outerRadius - 1);
  const maxY = Math.ceil(cy + outerRadius + 1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= innerRadius && dist <= outerRadius) {
        setPixel(png, x, y, r, g, b, a);
      }
    }
  }
}

// 1. Generate Vodacom M-Pesa Logo
function generateMpesaLogo() {
  const size = 256;
  const png = createLogoCanvas(size, size);
  const [bgR, bgG, bgB] = hexToRgba('#E60000'); // Vodacom Red
  
  // Card base
  drawRoundedRect(png, 8, 8, 240, 240, 48, bgR, bgG, bgB, 255);
  
  // Inner white badge
  drawRoundedRect(png, 24, 24, 208, 208, 36, 255, 255, 255, 255);
  
  // Inner M-PESA iconic red core
  drawCircle(png, 128, 100, 50, bgR, bgG, bgB, 255);
  // White central accent
  drawCircle(png, 128, 100, 24, 255, 255, 255, 255);
  // Red inner dot
  drawCircle(png, 128, 100, 12, bgR, bgG, bgB, 255);

  // M-Pesa bottom badge band
  drawRoundedRect(png, 40, 170, 176, 42, 12, bgR, bgG, bgB, 255);

  // Draw 'M - P E S A' white accent bars
  // M
  drawRoundedRect(png, 56, 178, 8, 26, 3, 255, 255, 255, 255);
  drawRoundedRect(png, 80, 178, 8, 26, 3, 255, 255, 255, 255);
  drawCircle(png, 72, 188, 6, 255, 255, 255, 255);
  // hyphen
  drawRoundedRect(png, 96, 189, 12, 5, 2, 255, 255, 255, 255);
  // P
  drawRoundedRect(png, 118, 178, 8, 26, 3, 255, 255, 255, 255);
  drawCircle(png, 132, 186, 10, 255, 255, 255, 255);
  drawCircle(png, 132, 186, 4, bgR, bgG, bgB, 255);
  // E
  drawRoundedRect(png, 150, 178, 8, 26, 3, 255, 255, 255, 255);
  drawRoundedRect(png, 150, 178, 18, 6, 2, 255, 255, 255, 255);
  drawRoundedRect(png, 150, 188, 14, 6, 2, 255, 255, 255, 255);
  drawRoundedRect(png, 150, 198, 18, 6, 2, 255, 255, 255, 255);
  // S & A bars
  drawRoundedRect(png, 176, 178, 22, 6, 2, 255, 255, 255, 255);
  drawRoundedRect(png, 176, 188, 22, 6, 2, 255, 255, 255, 255);
  drawRoundedRect(png, 176, 198, 22, 6, 2, 255, 255, 255, 255);

  const file = path.join(TARGET_DIR, 'mpesa.png');
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log('✓ Created:', file);
}

// 2. Generate Airtel Money Logo
function generateAirtelMoneyLogo() {
  const size = 256;
  const png = createLogoCanvas(size, size);
  const [bgR, bgG, bgB] = hexToRgba('#ED1B24'); // Airtel Red
  
  // Card base
  drawRoundedRect(png, 8, 8, 240, 240, 48, bgR, bgG, bgB, 255);
  
  // White circular emblem
  drawCircle(png, 128, 105, 65, 255, 255, 255, 255);
  // Inner iconic Airtel red curve
  drawCircle(png, 128, 105, 45, bgR, bgG, bgB, 255);
  drawCircle(png, 128, 95, 30, 255, 255, 255, 255);
  drawCircle(png, 128, 115, 20, bgR, bgG, bgB, 255);

  // Bottom "AIRTEL MONEY" White Card
  drawRoundedRect(png, 36, 182, 184, 40, 10, 255, 255, 255, 255);
  // Text bar in red
  drawRoundedRect(png, 52, 196, 40, 12, 4, bgR, bgG, bgB, 255);
  drawRoundedRect(png, 100, 196, 104, 12, 4, 30, 30, 30, 255);

  const file = path.join(TARGET_DIR, 'airtel-money.png');
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log('✓ Created:', file);
}

// 3. Generate Mixx by Yas (Tigo) Logo
function generateMixxByYasLogo() {
  const size = 256;
  const png = createLogoCanvas(size, size);
  const [bgR, bgG, bgB] = hexToRgba('#007A87'); // Yas Deep Teal
  const [cyanR, cyanG, cyanB] = hexToRgba('#00E5FF'); // Cyan
  const [goldR, goldG, goldB] = hexToRgba('#FFD700'); // Gold

  // Card base
  drawRoundedRect(png, 8, 8, 240, 240, 48, bgR, bgG, bgB, 255);

  // Concentric overlapping modern mixx rings
  drawCircle(png, 105, 100, 48, cyanR, cyanG, cyanB, 230);
  drawCircle(png, 151, 100, 48, goldR, goldG, goldB, 230);
  drawCircle(png, 128, 100, 28, 255, 255, 255, 255);
  drawCircle(png, 128, 100, 14, bgR, bgG, bgB, 255);

  // Bottom "MIXX BY YAS" banner
  drawRoundedRect(png, 36, 175, 184, 46, 14, 255, 255, 255, 255);
  drawRoundedRect(png, 50, 187, 60, 22, 6, bgR, bgG, bgB, 255);
  drawRoundedRect(png, 118, 192, 88, 14, 4, goldR, goldG, goldB, 255);

  const file = path.join(TARGET_DIR, 'mixx-by-yas.png');
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log('✓ Created:', file);
}

// 4. Generate HaloPesa Logo
function generateHaloPesaLogo() {
  const size = 256;
  const png = createLogoCanvas(size, size);
  const [bgR, bgG, bgB] = hexToRgba('#FF6600'); // Halotel Orange
  
  // Card base
  drawRoundedRect(png, 8, 8, 240, 240, 48, bgR, bgG, bgB, 255);

  // White circular emblem
  drawCircle(png, 128, 105, 58, 255, 255, 255, 255);
  
  // HaloPesa orange starburst petals
  drawCircle(png, 128, 80, 18, bgR, bgG, bgB, 255);
  drawCircle(png, 128, 130, 18, bgR, bgG, bgB, 255);
  drawCircle(png, 103, 105, 18, bgR, bgG, bgB, 255);
  drawCircle(png, 153, 105, 18, bgR, bgG, bgB, 255);
  drawCircle(png, 128, 105, 12, 255, 255, 255, 255);

  // Bottom "HALOPESA" white pill
  drawRoundedRect(png, 40, 182, 176, 42, 12, 255, 255, 255, 255);
  drawRoundedRect(png, 56, 194, 60, 18, 4, bgR, bgG, bgB, 255);
  drawRoundedRect(png, 124, 194, 76, 18, 4, 40, 40, 40, 255);

  const file = path.join(TARGET_DIR, 'halopesa.png');
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log('✓ Created:', file);
}

generateMpesaLogo();
generateAirtelMoneyLogo();
generateMixxByYasLogo();
generateHaloPesaLogo();

console.log('All 4 payment logos generated successfully in assets/payments/');
