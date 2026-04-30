// ── Background Canvas Animation ─────────────────────────────────────────────
(function () {
    const canvas = document.getElementById("bg-canvas");
    const ctx    = canvas.getContext("2d");

    const COLORS = ["#ff2d55", "#0a84ff", "#30d158", "#ffd60a"];
    const ORBS   = 12;

    let orbs = [];

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function randomOrb() {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        return {
            x:     Math.random() * canvas.width,
            y:     Math.random() * canvas.height,
            r:     80 + Math.random() * 140,
            dx:    (Math.random() - 0.5) * 0.5,
            dy:    (Math.random() - 0.5) * 0.5,
            color,
            alpha: 0.04 + Math.random() * 0.07,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: 0.005 + Math.random() * 0.01
        };
    }

    function init() {
        resize();
        orbs = Array.from({ length: ORBS }, randomOrb);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const o of orbs) {
            o.pulse += o.pulseSpeed;
            const r = o.r + Math.sin(o.pulse) * 20;

            const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
            grad.addColorStop(0,   hexAlpha(o.color, o.alpha));
            grad.addColorStop(1,   hexAlpha(o.color, 0));

            ctx.beginPath();
            ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            o.x += o.dx;
            o.y += o.dy;

            // Soft bounce off edges
            if (o.x < -r)              o.x = canvas.width  + r;
            if (o.x > canvas.width  + r) o.x = -r;
            if (o.y < -r)              o.y = canvas.height + r;
            if (o.y > canvas.height + r) o.y = -r;
        }

        requestAnimationFrame(draw);
    }

    function hexAlpha(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    window.addEventListener("resize", () => { resize(); });
    init();
    draw();

    // Expose so game can pulse orbs on flash
    window.pulseOrbs = function (color) {
        orbs.filter(o => o.color === color).forEach(o => {
            o.alpha = Math.min(o.alpha + 0.18, 0.35);
            setTimeout(() => { o.alpha = 0.04 + Math.random() * 0.07; }, 400);
        });
    };
}());

// ── Audio ──────────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const tones = { red: 261.63, blue: 329.63, green: 392.00, yellow: 523.25 };

function playTone(color, duration = 0.3) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = tones[color];
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playErrorSound() {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

// ── State ──────────────────────────────────────────────────────────────────
let gameSeq  = [];
let userSeq  = [];
let btns     = ["red", "blue", "green", "yellow"];
let started  = false;
let level    = 0;
let bestScore = 0;

// ── DOM refs ───────────────────────────────────────────────────────────────
const message      = document.getElementById("message");
const levelDisplay = document.getElementById("level-display");
const bestDisplay  = document.getElementById("best-display");
const gameWrapper  = document.querySelector(".game-wrapper");

// ── Start ──────────────────────────────────────────────────────────────────
document.addEventListener("keydown", startGame);
document.addEventListener("click",   startGame);

function startGame() {
    if (!started) {
        audioCtx.resume();
        started = true;
        levelUp();
    }
}

// ── Level up ───────────────────────────────────────────────────────────────
function levelUp() {
    userSeq = [];
    level++;
    levelDisplay.textContent = level;
    animatePop(levelDisplay);
    message.textContent = `Level ${level}`;

    const randColor = btns[Math.floor(Math.random() * btns.length)];
    gameSeq.push(randColor);
    playSequence();
}

// ── Play full sequence ─────────────────────────────────────────────────────
function playSequence() {
    document.body.classList.add("playing");
    let i = 0;
    const interval = setInterval(() => {
        flashBtn(gameSeq[i], true);
        i++;
        if (i >= gameSeq.length) {
            clearInterval(interval);
            setTimeout(() => document.body.classList.remove("playing"), 400);
        }
    }, 700);
}

// ── Flash helpers ──────────────────────────────────────────────────────────
function flashBtn(color, isGame = false) {
    const btn = document.getElementById(color);
    const cls = isGame ? "flash" : "userflash";
    playTone(color, isGame ? 0.35 : 0.2);
    btn.classList.add(cls);
    if (window.pulseOrbs) window.pulseOrbs(color);
    setTimeout(() => btn.classList.remove(cls), isGame ? 400 : 200);
}

// ── Check answer ───────────────────────────────────────────────────────────
function checkAns(idx) {
    if (userSeq[idx] !== gameSeq[idx]) {
        gameOver();
        return;
    }
    if (userSeq.length === gameSeq.length) {
        message.textContent = "✓ Correct! Next level…";
        setTimeout(levelUp, 1000);
    }
}

// ── Game over ──────────────────────────────────────────────────────────────
function gameOver() {
    playErrorSound();
    gameWrapper.classList.add("shake");
    setTimeout(() => gameWrapper.classList.remove("shake"), 500);

    if (level > bestScore) {
        bestScore = level;
        bestDisplay.textContent = bestScore;
        animatePop(bestDisplay);
    }

    message.innerHTML = `Game Over! Score: <strong style="color:var(--yellow)">${level}</strong> — Press any key`;
    reset();
}

// ── Reset ──────────────────────────────────────────────────────────────────
function reset() {
    started  = false;
    gameSeq  = [];
    userSeq  = [];
    level    = 0;
    levelDisplay.textContent = 0;
    document.body.classList.remove("playing");
}

// ── Button press ───────────────────────────────────────────────────────────
document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", function () {
        const color = this.id;
        flashBtn(color, false);
        userSeq.push(color);
        checkAns(userSeq.length - 1);
    });
});

// ── Pop animation helper ───────────────────────────────────────────────────
function animatePop(el) {
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    el.addEventListener("animationend", () => el.classList.remove("pop"), { once: true });
}
