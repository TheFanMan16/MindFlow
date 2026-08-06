/**
 * Shareable session recap: a 1080x1920 (Instagram/TikTok story) branded card
 * rendered on a canvas and downloaded as a PNG. No network, no deps.
 */

const W = 1080;
const H = 1920;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function scoreColor(score) {
  if (score >= 80) return '#34d399';
  if (score >= 50) return '#fbbf24';
  return '#f87171';
}

/**
 * Render the recap card and trigger a PNG download.
 * All fields optional except score; missing ones are simply omitted.
 *
 * @param {Object} recap
 * @param {number} recap.score - recall score 0-100
 * @param {string} [recap.grade] - letter grade
 * @param {string} [recap.topicName]
 * @param {number} [recap.streak] - current day streak
 * @param {number} [recap.minutesFocused] - minutes in the focus session
 */
export function downloadRecapImage({ score, grade, topicName, streak, minutesFocused }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (weight, size) =>
    `${weight} ${size}px Inter, -apple-system, "Segoe UI", system-ui, sans-serif`;

  // Background: deep navy with a soft purple glow top-right
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0b14');
  bg.addColorStop(1, '#161028');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, 700);
  glow.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
  glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Brand
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = font(700, 64);
  ctx.fillText('MindFlow', W / 2, 220);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = font(500, 36);
  ctx.fillText('RECALL SESSION', W / 2, 300);

  // Topic
  if (topicName) {
    ctx.fillStyle = '#a78bfa';
    ctx.font = font(600, 56);
    const label = topicName.length > 26 ? `${topicName.slice(0, 25)}…` : topicName;
    ctx.fillText(label, W / 2, 470);
  }

  // Score ring
  const cx = W / 2;
  const cy = 900;
  const radius = 260;
  ctx.lineWidth = 40;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = scoreColor(score);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(0, Math.min(100, score))) / 100);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 220);
  ctx.fillText(String(Math.round(score)), cx, cy + 60);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = font(600, 48);
  ctx.fillText('% RECALLED', cx, cy + 150);
  if (grade) {
    ctx.fillStyle = scoreColor(score);
    ctx.font = font(700, 72);
    ctx.fillText(`Grade ${grade}`, cx, cy - 330);
  }

  // Stat chips
  const chips = [];
  if (streak > 0) chips.push(`🔥 ${streak}-day streak`);
  if (minutesFocused > 0) chips.push(`⏱ ${minutesFocused} min focused`);
  if (chips.length > 0) {
    const chipY = 1360;
    const chipH = 110;
    const gap = 40;
    ctx.font = font(600, 44);
    const widths = chips.map((c) => ctx.measureText(c).width + 90);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    let x = (W - total) / 2;
    chips.forEach((chip, i) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      roundRect(ctx, x, chipY, widths[i], chipH, 55);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 3;
      roundRect(ctx, x, chipY, widths[i], chipH, 55);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(chip, x + widths[i] / 2, chipY + 72);
      x += widths[i] + gap;
    });
  }

  // Date + tagline
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = font(500, 40);
  ctx.fillText(
    new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    W / 2,
    1610
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = font(600, 42);
  ctx.fillText('Study it once. Remember it on exam day.', W / 2, 1770);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mindflow-recap.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
