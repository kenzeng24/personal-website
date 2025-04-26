const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


let time = 0;
let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
const layerCount = 20;
const smoothedMouseByLayer = Array.from({ length: layerCount }, () => ({
    x: mouse.x,
    y: mouse.y
}));

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

function noise(x) {
  return Math.sin(x * 0.01) + Math.sin(x * 0.005 + 3) * 0.5;
}

function drawLayer(yBase, layerIndex, timeOffset, influence) {
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
        const offsetY = yBase + (influence.y - canvas.height / 2) * 0.1;
        const y = offsetY + noise(x + time * 2.0 + timeOffset) * (30 + influence.y * 0.02);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();

    const alpha = 0.08 + layerIndex * 0.015;
    // const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    // gradient.addColorStop(0, `rgba(234, 214, 238, ${alpha})`);
    // gradient.addColorStop(1, `rgba(160, 241, 234, ${alpha})`);
    // white 
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;

    ctx.fill();
}
function animate() {
ctx.clearRect(0, 0, canvas.width, canvas.height);

for (let i = 0; i < layerCount; i++) {
    const lagFactor = 0.02 + (i / layerCount) * 0.08; // back layers (i=0) move faster

    smoothedMouseByLayer[i].x += (mouse.x - smoothedMouseByLayer[i].x) * lagFactor;
    smoothedMouseByLayer[i].y += (mouse.y - smoothedMouseByLayer[i].y) * lagFactor;

    const y = canvas.height / 2 + i * 20;
    drawLayer(y, i, i * 50, smoothedMouseByLayer[i]);
}

time += 1;
requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
  setTimeout(() => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, 100);
});