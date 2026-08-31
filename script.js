/* ============================================================
   MWESH SITE — script.js
   Pure client-side JS. No build step, no framework.
   If/when you plug in your own trained model, it will live in a
   separate Python service (e.g. FastAPI) and this file only ever
   talks to it over fetch() as JSON — that's the whole boundary,
   so JS and Python never "clash": they're two different runtimes
   that never touch except through that one HTTP call.
   ============================================================ */

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- POEMS ----------
   Add your real poems here. Each one renders with its own
   copyright line automatically. */
const POEMS = [
  {
    title: "Matatu Psalm",
    lines: [
      "The conductor calls the city like a hymn,",
      "Ngong Road, Rongai, one more inside —",
      "and I fold myself smaller than my father did,",
      "who folded smaller than his."
    ]
  },
  {
    title: "What the Elders Did Not Say",
    lines: [
      "They told us the river remembers everyone who drank from it.",
      "They did not tell us it also remembers who never came back."
    ]
  },
  {
    title: "Screen Light",
    lines: [
      "At 1am the laptop is the only fire in the house,",
      "and I am still, somehow, telling a story by it."
    ]
  }
];

function renderPoems(){
  const grid = document.getElementById('poem-grid');
  grid.innerHTML = POEMS.map(p => `
    <article class="poem-card">
      <h3>${escapeHTML(p.title)}</h3>
      <pre>${p.lines.map(escapeHTML).join('\n')}</pre>
      <p class="poem-rights">© ${new Date().getFullYear()} Emmanuel Mwendwa (Mweshimiwa / Mwesh)</p>
    </article>
  `).join('');
}
function escapeHTML(str){
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
renderPoems();

/* ---------- NOTIFY FORM (placeholder — wire to your own list) ---------- */
document.getElementById('notify-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const status = document.getElementById('notify-status');
  // TODO: replace with a real request to your mailing list / form backend
  status.textContent = "Thanks — you'll hear from us when The Heart is ready.";
  e.target.reset();
});

/* ============================================================
   WRITE WITH ME — collaborative stanza continuation
   ============================================================
   Calls your FastAPI backend's POST /continue endpoint (see the
   /backend folder). If that endpoint isn't reachable — not
   deployed yet, wrong URL, offline — it falls back to a tiny
   local pattern engine so the feature still works instead of
   silently breaking.
   ============================================================ */
const CONTINUE_API_URL = "https://your-model-api.example.com/continue"; // <-- set this once your backend is deployed

async function generateNextLine(history){
  try{
    const res = await fetch(CONTINUE_API_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ history }),
      signal: AbortSignal.timeout(8000)
    });
    if(!res.ok) throw new Error('bad response');
    const data = await res.json();
    if(data && typeof data.line === 'string' && data.line.trim()) return data.line.trim();
    throw new Error('empty response');
  } catch(err){
    return localFallbackLine(history);
  }
}

function localFallbackLine(history){
  const lastLine = history[history.length - 1] || "";
  const words = lastLine.trim().split(/\s+/).filter(Boolean);
  const echoWord = words[words.length - 1] || "silence";
  const templates = [
    `and even the ${echoWord} agreed to stay a little longer.`,
    `but no one had told the ${echoWord} it was allowed to leave.`,
    `so we let the ${echoWord} carry what we couldn't.`,
    `still, the ${echoWord} remembers the shape of the room.`,
    `and somewhere, a smaller version of that ${echoWord} is being born.`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

const collabThread = document.getElementById('collab-thread');
const collabInput = document.getElementById('collab-input');
const collabHistory = [];

function addCollabLine(text, who){
  const p = document.createElement('p');
  p.className = `collab-line ${who}`;
  p.textContent = text;
  collabThread.appendChild(p);
  collabThread.scrollTop = collabThread.scrollHeight;
}

document.getElementById('collab-send').addEventListener('click', async () => {
  const text = collabInput.value.trim();
  if(!text) return;
  addCollabLine(text, 'user');
  collabHistory.push(text);
  collabInput.value = '';
  collabInput.disabled = true;
  const next = await generateNextLine(collabHistory);
  addCollabLine(next, 'bot');
  collabHistory.push(next);
  collabInput.disabled = false;
  collabInput.focus();
});
collabInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    document.getElementById('collab-send').click();
  }
});

/* ============================================================
   RECITE — entirely client-side text-to-speech, tuned to sound
   like a reading rather than a screen-reader:
   - queues one utterance PER LINE (not one huge blob), so the
     engine takes a natural breath/pause between lines
   - lets the reader pick an actual voice, since the browser's
     default pick is often the flattest one installed
   - highlights the line currently being spoken
   ============================================================ */
const reciteInput = document.getElementById('recite-input');
const reciteRate = document.getElementById('recite-rate');
const recitePitch = document.getElementById('recite-pitch');
const reciteVoiceSelect = document.getElementById('recite-voice');
const poemDisplay = document.getElementById('poem-display');

let availableVoices = [];
let reciteQueue = [];
let reciteIndex = 0;
let isReciting = false;

function pickBestDefaultVoice(voices){
  // Prefer voices that tend to sound less robotic: modern "Natural"/
  // "Neural" builds, Google's voices, then any English voice, then whatever exists.
  const englishVoices = voices.filter(v => v.lang && v.lang.startsWith('en'));
  const pool = englishVoices.length ? englishVoices : voices;
  const scored = pool.map(v => {
    const name = v.name.toLowerCase();
    let score = 0;
    if(name.includes('natural')) score += 3;
    if(name.includes('neural')) score += 3;
    if(name.includes('google')) score += 2;
    if(name.includes('online')) score += 1;
    if(v.localService === false) score += 1; // often higher-quality cloud voices
    return { v, score };
  });
  scored.sort((a,b) => b.score - a.score);
  return scored[0] ? scored[0].v : pool[0];
}

function populateVoiceList(){
  availableVoices = window.speechSynthesis.getVoices();
  if(!availableVoices.length) return;
  reciteVoiceSelect.innerHTML = availableVoices
    .map((v, i) => `<option value="${i}">${v.name} (${v.lang})</option>`)
    .join('');
  const best = pickBestDefaultVoice(availableVoices);
  const bestIndex = availableVoices.indexOf(best);
  if(bestIndex > -1) reciteVoiceSelect.value = String(bestIndex);
}
populateVoiceList();
if('onvoiceschanged' in window.speechSynthesis){
  window.speechSynthesis.onvoiceschanged = populateVoiceList;
}

function renderPoemDisplay(lines){
  poemDisplay.innerHTML = lines
    .map((line, i) => `<p class="p-line" data-i="${i}">${escapeHTML(line) || '&nbsp;'}</p>`)
    .join('');
}

function pauseForLine(line){
  const trimmed = line.trim();
  if(!trimmed) return 500; // stanza break
  const last = trimmed[trimmed.length - 1];
  if(last === '.' || last === '!' || last === '?') return 420;
  if(last === ',' || last === ';' || last === ':') return 260;
  return 160;
}

function speakLine(){
  if(reciteIndex >= reciteQueue.length){
    isReciting = false;
    return;
  }
  const line = reciteQueue[reciteIndex];
  const allLines = poemDisplay.querySelectorAll('.p-line');
  allLines.forEach((el, i) => {
    el.classList.toggle('active', i === reciteIndex);
    el.classList.toggle('done', i < reciteIndex);
  });

  if(!line.trim()){
    reciteIndex++;
    setTimeout(speakLine, 500); // longer pause on blank lines, like a stanza break
    return;
  }

  const utterance = new SpeechSynthesisUtterance(line.trim());
  const chosen = availableVoices[parseInt(reciteVoiceSelect.value, 10)];
  if(chosen) utterance.voice = chosen;
  // small human-like variance so every line doesn't land at the exact same
  // rate/pitch — real readers drift slightly line to line
  const jitterRate = (Math.random() - 0.5) * 0.06;
  const jitterPitch = (Math.random() - 0.5) * 0.08;
  utterance.rate = Math.max(0.4, parseFloat(reciteRate.value) + jitterRate);
  utterance.pitch = Math.max(0.5, parseFloat(recitePitch.value) + jitterPitch);
  utterance.onend = () => {
    reciteIndex++;
    setTimeout(speakLine, pauseForLine(line));
  };
  utterance.onerror = () => { reciteIndex++; speakLine(); };
  window.speechSynthesis.speak(utterance);
}

document.getElementById('recite-play').addEventListener('click', () => {
  const text = reciteInput.value.trim();
  if(!text) return;
  window.speechSynthesis.cancel();
  reciteQueue = text.split('\n');
  reciteIndex = 0;
  isReciting = true;
  renderPoemDisplay(reciteQueue);
  speakLine();
});
document.getElementById('recite-stop').addEventListener('click', () => {
  window.speechSynthesis.cancel();
  isReciting = false;
  poemDisplay.querySelectorAll('.p-line.active').forEach(el => el.classList.remove('active'));
});

/* ---------- mobile nav toggle ---------- */
const navToggle = document.getElementById('nav-toggle');
const navLinksWrap = document.getElementById('nav-links');
navToggle.addEventListener('click', () => {
  const open = navLinksWrap.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});
navLinksWrap.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinksWrap.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ---------- scroll progress bar ---------- */
const scrollProgress = document.getElementById('scroll-progress');
function updateScrollProgress(){
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  scrollProgress.style.width = pct + '%';
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });
updateScrollProgress();

/* ---------- scroll reveal ---------- */
const revealItems = document.querySelectorAll('.reveal');
if('IntersectionObserver' in window && revealItems.length){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealItems.forEach(el => io.observe(el));
} else {
  revealItems.forEach(el => el.classList.add('in-view'));
}

/* ---------- nav active-link scroll spy ---------- */
const navLinks = document.querySelectorAll('.topnav a[href^="#"]');
const navTargets = Array.from(navLinks)
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);
if('IntersectionObserver' in window && navTargets.length){
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const link = document.querySelector(`.topnav a[href="#${entry.target.id}"]`);
      if(!link) return;
      if(entry.isIntersecting) link.classList.add('active');
      else link.classList.remove('active');
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  navTargets.forEach(t => spy.observe(t));
}
