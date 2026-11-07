// Desktop gate: this is not a desktop experience. QR + link to the phone.

export function isMobile() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const touchMac = navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform); // iPadOS
  return coarse && (ua || touchMac);
}

// The vendored qrcode-generator is a classic script that defines a global `qrcode`.
function loadQrcode() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = new URL('../vendor/qrcode-generator/qrcode.js', import.meta.url).href;
    el.onload = () => resolve(window.qrcode);
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

export async function showGate() {
  const gate = document.getElementById('gate');
  const url = location.href.split('?')[0];
  document.getElementById('gate-url').textContent = url;
  gate.classList.remove('hidden');
  try {
    const qrcode = await loadQrcode();
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const el = document.getElementById('qr');
    el.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2 });
    const svg = el.querySelector('svg');
    // recolor to the palette
    svg.querySelectorAll('path, rect').forEach(p => {
      const f = p.getAttribute('fill');
      if (f === 'black' || f === '#000000') p.setAttribute('fill', '#4ff2e4');
      else p.setAttribute('fill', 'transparent');
    });
  } catch {
    document.getElementById('qr').textContent = 'open the link on your phone';
  }
}
