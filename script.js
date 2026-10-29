const $ = (id) => document.getElementById(id);
const lockScreen = $("lockScreen"),
  siteContent = $("siteContent"),
  ambient = $("ambient");
const unlockForm = $("unlockForm"),
  passcode = $("passcode"),
  unlockError = $("unlockError");
let mirrorStream = null,
  mirrorTimer = null,
  secretTimer = null,
  giftTimer = null;
let secretOpened = false,
  giftFinished = false;
const completed = new Set();
const sections = [
  ...document.querySelectorAll(
    "#siteContent > .section, #siteContent > .photo-feature",
  ),
];
const sectionIds = sections.map((s) => s.id);
let started = false;
const requirements = {
  welcome: () => started,
  calendar: () => true,
  mirror: () => mirrorDone,
  wonders: () => true,
  sorryGallery: () => true,
  special: () => openedCards.size === 5,
  photoFeature: () => true,
  gallery: () => true,
  letter: () => letterOpened,
  cake: () => cakeDone,
  wish: () => wishMade && cakeDone,
  promises: () => promiseConfirmed,
  rest: () => restDone,
  gift: () => giftFinished,
  videos: () => true,
};
let mirrorDone = false,
  letterOpened = false,
  cakeDone = false,
  wishMade = false,
  promiseConfirmed = false,
  restDone = false;
const openedCards = new Set();
function addParticle() {
  const p = document.createElement("span");
  p.className = "particle";
  p.textContent = ["✦", "♡", "✧", "✨", "♥", "🎈", "🌸"][
    Math.floor(Math.random() * 5)
  ];
  p.style.left = `${Math.random() * 100}%`;
  p.style.fontSize = `${10 + Math.random() * 18}px`;
  p.style.animationDuration = `${9 + Math.random() * 9}s`;
  ambient.appendChild(p);
  window.setTimeout(() => p.remove(), 19000);
}
for (let i = 0; i < 18; i++) window.setTimeout(addParticle, i * 350);
const ambientTimer = window.setInterval(addParticle, 900);
function confettiBurst() {
  const emojis = ["✨", "💖", "🎉", "🌸", "⭐", "🎊"];
  for (let i = 0; i < 32; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = `${10 + Math.random() * 80}%`;
    p.style.bottom = `${Math.random() * 30}%`;
    p.style.fontSize = `${12 + Math.random() * 18}px`;
    p.style.animationDuration = `${3 + Math.random() * 3}s`;
    ambient.appendChild(p);
    window.setTimeout(() => p.remove(), 6500);
  }
}
function sectionComplete(id) {
  return completed.has(id);
}
function setActiveSection(index, animate = true) {
  pauseAllVideos();
  const targetIndex = Math.max(0, Math.min(index, sections.length - 1));
  sections.forEach((section, i) => {
    const active = i === targetIndex;
    section.classList.toggle("chapter-hidden", !active);
    section.setAttribute("aria-hidden", String(!active));
    if (active) {
      section.classList.remove("chapter-entering");
      if (animate) {
        void section.offsetWidth;
        section.classList.add("chapter-entering");
      }
    }
  });
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
  activeSectionIndex = targetIndex;
  const active = sections[targetIndex];
  if (active) {
    active.dataset.endSeen = active.dataset.endSeen || "false";
    updateNext(active);
    if (active.id === "videos") window.revealVideos?.();
  }
  checkSectionEnds();
}
let activeSectionIndex = 0;
function addNav() {
  sections.forEach((section, index) => {
    if (section.querySelector(".section-navigation")) return;
    const nav = document.createElement("div");
    nav.className = "section-navigation";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn subtle back-btn";
    back.textContent = "← Back";
    back.disabled = index === 0;
    back.addEventListener("click", () => setActiveSection(index - 1));
    nav.appendChild(back);
    if (index < sections.length - 1) {
      const next = document.createElement("button");
      next.type = "button";
      next.className = "btn primary next-btn hidden";
      next.innerHTML = '<span class="next-sparkle">✦</span> Next surprise →';
      next.addEventListener("click", () => {
        if (!completed.has(section.id)) return;
        // The cake chapter is revisited after the wish, so its Next skips the wish chapter.
        setActiveSection(index + (section.id === "cake" ? 2 : 1));
      });
      nav.appendChild(next);
    }
    section.appendChild(nav);
    section.dataset.navIndex = index;
    section.dataset.endSeen = "false";
  });
}
function updateNext(section) {
  const next = section.querySelector(".next-btn");
  if (!next) return;
  const id = section.id;
  const can =
    section.dataset.endSeen === "true" && (requirements[id]?.() ?? true);
  if (can) {
    completed.add(id);
    if (next.classList.contains("hidden")) {
      next.classList.remove("hidden");
      next.classList.add("next-unlock");
    }
  } else if (!completed.has(id)) {
    next.classList.add("hidden");
    next.classList.remove("next-unlock");
  }
}
function checkSectionEnds() {
  sections.forEach((s) => {
    if (s.classList.contains("chapter-hidden")) return;
    const rect = s.getBoundingClientRect();
    if (rect.bottom <= window.innerHeight + 12) {
      s.dataset.endSeen = "true";
      updateNext(s);
    }
  });
}
addNav();
// The gallery's extra-surprise button uses the existing chapter navigation system.
$("oneMoreSurpriseBtn")?.addEventListener("click", () =>
  setActiveSection(sectionIds.indexOf("special")),
);

// Smooth image slider: messages are secret until tapped, and photos can be chosen locally.
(function initSorrySlider() {
  const slider = $("sorrySlider");
  if (!slider) return;
  const track = $("sorrySliderTrack"),
    viewport = $("sorrySliderViewport");
  let slides = [...track.querySelectorAll(".sorry-photo-card")];
  const dots = $("sorrySliderDots"),
    count = $("sorrySliderCount");
  const prev = $("sorrySliderPrev"),
    next = $("sorrySliderNext");
  const finalMessage = $("fiveThingsMessage");
  let current = 0,
    touchStartX = 0;
  const viewed = new Set();
  function setupSlides() {
    slides.forEach((slide, index) => {
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", `${index + 1} of ${slides.length}`);
      const toggle = slide.querySelector(".slide-message-toggle");
      const message = slide.querySelector(".slide-message");
      if (toggle && message) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Reveal message 💌";
        message.classList.add("hidden");
        toggle.onclick = () => {
          const opening = message.classList.contains("hidden");
          message.classList.toggle("hidden", !opening);
          toggle.setAttribute("aria-expanded", String(opening));
          toggle.textContent = opening
            ? "Hide message ✨"
            : "Reveal message 💌";
          if (opening) {
            viewed.add(index);
            if (viewed.size === slides.length)
              finalMessage?.classList.remove("hidden");
          }
        };
      }
    });
    dots.replaceChildren();
    slides.forEach((slide, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.setAttribute("aria-label", `Show photo ${index + 1}`);
      dot.addEventListener("click", () => showSlide(index));
      dots.appendChild(dot);
    });
  }
  /* ---------- WebGL liquid-distortion transition between the photos ---------- */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fx = reduceMotion ? null : createSlideFx();
  let fxRun = null;
  function createSlideFx() {
    const canvas = document.createElement("canvas");
    canvas.className = "sorry-gl";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return null;
    const VS = "attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
    const FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D tA,tB;
uniform float prog;
uniform vec2 sA,sB;
uniform vec3 bg;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
vec4 pick(sampler2D t,vec2 c,vec2 s){
  vec2 q=(c-.5)*s+.5;
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) return vec4(bg,1.);
  return texture2D(t,q);
}
void main(){
  float n=noise(uv*vec2(3.,4.)+vec2(0.,prog*2.));
  float n2=noise(uv*vec2(4.,3.)+7.3);
  float amt=sin(prog*3.14159265);
  vec2 d=vec2(n-.5,n2-.5)*.55+vec2(sin(uv.y*13.+prog*6.)*.05,sin(uv.x*11.-prog*5.)*.04);
  vec4 a=pick(tA,uv+d*prog*(.6+amt),sA);
  vec4 b=pick(tB,uv-d*(1.-prog)*(.6+amt),sB);
  float x=mix(-.3,1.3,prog)+(n-.5)*.5;
  float f=smoothstep(0.,1.,x);
  gl_FragColor=mix(a,b,f);
}`;
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link failed");
    } catch (err) {
      return null;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    gl.uniform1i(U("tA"), 0);
    gl.uniform1i(U("tB"), 1);
    gl.uniform3f(U("bg"), 0.975, 0.905, 0.955);
    viewport.appendChild(canvas);
    const cache = new Map();
    function textureFor(img) {
      if (!img || !img.complete || !img.naturalWidth) return null;
      const key = img.currentSrc || img.src;
      if (cache.has(key)) return cache.get(key);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      } catch (err) {
        return null; // e.g. file:// images are blocked from WebGL: fall back to the plain slide
      }
      const entry = { tex, w: img.naturalWidth, h: img.naturalHeight };
      cache.set(key, entry);
      return entry;
    }
    return { canvas, gl, U, textureFor };
  }
  function stopFx() {
    if (!fx) return;
    if (fxRun) cancelAnimationFrame(fxRun);
    fxRun = null;
    fx.canvas.classList.remove("on");
    track.style.transition = "";
  }
  function glTransition(from, to) {
    if (!fx) return false;
    stopFx();
    const imgA = slides[from].querySelector("img");
    const imgB = slides[to].querySelector("img");
    const A = fx.textureFor(imgA);
    const B = fx.textureFor(imgB);
    if (!A || !B) return false;
    const { gl, canvas, U } = fx;
    track.style.transition = "none";
    track.style.transform = `translateX(-${to * 100}%)`;
    const vr = viewport.getBoundingClientRect();
    const ir = imgB.getBoundingClientRect();
    if (!ir.width || !ir.height) {
      track.style.transition = "";
      return true;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.left = `${ir.left - vr.left}px`;
    canvas.style.top = `${ir.top - vr.top}px`;
    canvas.style.width = `${ir.width}px`;
    canvas.style.height = `${ir.height}px`;
    canvas.width = Math.round(ir.width * dpr);
    canvas.height = Math.round(ir.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const ca = ir.width / ir.height;
    const contain = (t) => {
      const ia = t.w / t.h;
      return ia > ca ? [1, ia / ca] : [ca / ia, 1];
    };
    gl.uniform2f(U("sA"), ...contain(A));
    gl.uniform2f(U("sB"), ...contain(B));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, B.tex);
    const draw = (p) => {
      gl.uniform1f(U("prog"), p);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    draw(0);
    canvas.classList.add("on");
    const start = performance.now();
    const DURATION = 1150;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      draw(t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      if (t < 1) fxRun = requestAnimationFrame(tick);
      else stopFx();
    };
    fxRun = requestAnimationFrame(tick);
    return true;
  }
  function showSlide(index, animate = true) {
    const from = current;
    current = Math.max(0, Math.min(index, slides.length - 1));
    if (!(animate && from !== current && glTransition(from, current))) {
      stopFx();
      track.style.transform = `translateX(-${current * 100}%)`;
    }
    slides.forEach((slide, i) =>
      slide.setAttribute("aria-hidden", String(i !== current)),
    );
    [...dots.querySelectorAll(".slider-dot")].forEach((dot, i) => {
      dot.classList.toggle("is-active", i === current);
      if (i === current) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    count.textContent = `${current + 1} / ${slides.length}`;
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
  }
  prev.addEventListener("click", () => showSlide(current - 1));
  next.addEventListener("click", () => showSlide(current + 1));
  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(current - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(current + 1);
    }
  });
  viewport.addEventListener(
    "touchstart",
    (event) => {
      touchStartX = event.changedTouches[0].screenX;
    },
    { passive: true },
  );
  viewport.addEventListener(
    "touchend",
    (event) => {
      const delta = event.changedTouches[0].screenX - touchStartX;
      if (Math.abs(delta) > 45) showSlide(current + (delta < 0 ? 1 : -1));
    },
    { passive: true },
  );
  setupSlides();
  showSlide(0, false);
})();
const endObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const section = e.target.parentElement;
        section.dataset.endSeen = "true";
        updateNext(section);
      }
    }
  },
  { threshold: 0.01 },
);
sections.forEach((s) => {
  const sentinel = document.createElement("div");
  sentinel.className = "section-end-sentinel";
  sentinel.setAttribute("aria-hidden", "true");
  s.appendChild(sentinel);
  endObserver.observe(sentinel);
});
sections.forEach((section, index) => {
  section.classList.toggle("chapter-hidden", index !== 0);
  section.setAttribute("aria-hidden", String(index !== 0));
});
sections[0]?.classList.add("chapter-entering");
window.addEventListener("scroll", checkSectionEnds, { passive: true });
window.addEventListener("resize", checkSectionEnds);
function refreshSection(id) {
  const s = $(id);
  if (s) {
    updateNext(s);
    checkSectionEnds();
  }
}
unlockForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (passcode.value.trim() !== "3110") {
    unlockError.textContent =
      "Not quite, birthday detective! Try 31 October 💗";
    passcode.classList.remove("shake");
    void passcode.offsetWidth;
    passcode.classList.add("shake");
    passcode.value = "";
    passcode.focus();
    return;
  }
  unlockError.textContent = "";
  lockScreen.classList.add("hidden");
  siteContent.classList.remove("hidden");
  document.body.classList.add("unlocked");
  setActiveSection(0, false);
});
$("beginBtn").addEventListener("click", () => {
  started = true;
  completed.add("welcome");
  $("welcome").dataset.endSeen = "true";
  refreshSection("welcome");
  setActiveSection(1);
});
const calendarDates = $("calendarDates");
for (let i = 0; i < 4; i++)
  calendarDates.appendChild(document.createElement("span"));
for (let day = 1; day <= 31; day++) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = day;
  b.setAttribute("aria-label", `October ${day}, 2026`);
  if (day === 31) {
    b.className = "birthday-date";
    b.addEventListener("click", () => {
      $("calendarReveal").textContent =
        "The world got a little more beautiful on this day. ✨";
      completed.add("calendar");
      refreshSection("calendar");
    });
  }
  calendarDates.appendChild(b);
}
// Mirror: camera is time-boxed; fallback always offers a direct route to the message.
const mirrorFrame = $("mirrorFrame"),
  mirrorVideo = $("mirrorVideo"),
  mirrorFallbackPhoto = $("mirrorFallbackPhoto"),
  mirrorBtn = $("mirrorBtn"),
  mirrorStatus = $("mirrorStatus"),
  mirrorCountdown = $("mirrorCountdown"),
  mirrorSkip = $("mirrorSkipBtn");
function stopMirror() {
  if (mirrorTimer) {
    clearInterval(mirrorTimer);
    mirrorTimer = null;
  }
  if (mirrorStream) {
    mirrorStream.getTracks().forEach((t) => t.stop());
    mirrorStream = null;
  }
  mirrorVideo.pause();
  mirrorVideo.srcObject = null;
  mirrorVideo.classList.add("hidden");
  mirrorFrame
    .querySelector(".mirror-placeholder")
    .classList.toggle(
      "hidden",
      Boolean(
        mirrorFallbackPhoto &&
        !mirrorFallbackPhoto.classList.contains("hidden"),
      ),
    );
}
function revealMirrorMessage() {
  stopMirror();
  if (mirrorBtn.dataset.fallback !== "true")
    mirrorFrame.classList.add("mirror-away");
  mirrorCountdown.classList.add("hidden");
  mirrorBtn.classList.add("hidden");
  mirrorSkip.classList.add("hidden");
  $("mirrorReveal").classList.remove("hidden");
  mirrorStatus.textContent =
    "A little reminder: you are beautiful, exactly as you are. ✨";
  mirrorDone = true;
  completed.add("mirror");
  refreshSection("mirror");
}
mirrorSkip.addEventListener("click", revealMirrorMessage);
mirrorBtn.addEventListener("click", async () => {
  if (mirrorBtn.dataset.fallback === "true") {
    revealMirrorMessage();
    return;
  }
  mirrorBtn.disabled = true;
  mirrorSkip.classList.remove("hidden");
  mirrorBtn.textContent = "A little mirror magic... ✨";
  let stream;
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)
      throw new Error("Camera requires a secure context");
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "user" } },
      audio: false,
    });
    if (!stream) throw new Error("No stream");
    mirrorStream = stream;
    mirrorVideo.srcObject = stream;
    mirrorFrame.querySelector(".mirror-placeholder").classList.add("hidden");
    mirrorVideo.classList.remove("hidden");
    await mirrorVideo.play();
  } catch (err) {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    mirrorStatus.textContent =
      "Camera access is blocked or unavailable, so here is Puja’s photo instead. 💗";
    mirrorFrame.querySelector(".mirror-placeholder").classList.add("hidden");
    if (mirrorFallbackPhoto) mirrorFallbackPhoto.classList.remove("hidden");
    mirrorFrame.classList.add("mirror-fallback");
    mirrorBtn.textContent = "Show my message ✨";
    mirrorBtn.disabled = false;
    mirrorBtn.classList.remove("hidden");
    mirrorBtn.dataset.fallback = "true";
    return;
  }
  mirrorStatus.textContent = "Your reflection, just as you are. 💗";
  let left = 5;
  mirrorCountdown.textContent = `${left} seconds`;
  mirrorCountdown.classList.remove("hidden");
  mirrorBtn.classList.add("hidden");
  mirrorTimer = window.setInterval(() => {
    left--;
    if (left <= 0) {
      stopMirror();
      revealMirrorMessage();
    } else mirrorCountdown.textContent = `${left} seconds`;
  }, 1000);
});
// Card-by-card hidden messages.
document.querySelectorAll(".reveal-card").forEach((card, i) => {
  card.addEventListener("click", () => {
    const open = card.classList.toggle("is-open");
    card.setAttribute("aria-expanded", String(open));
    if (open) {
      openedCards.add(i);
      card.classList.add(`reveal-style-${i + 1}`);
    } else {
      card.classList.remove(`reveal-style-${i + 1}`);
    }
    updateNext($("special"));
  });
});
$("envelopeBtn").addEventListener("click", () => {
  const paper = $("letterPaper");
  const isOpen = !paper.classList.contains("hidden");
  paper.classList.toggle("hidden", isOpen);
  $("envelopeBtn").setAttribute("aria-expanded", String(!isOpen));
  $("envelopeBtn").innerHTML = isOpen
    ? '<span class="envelope-heart">♥</span><span>Tap to open your letter</span>'
    : '<span class="envelope-heart">💌</span><span>Your letter is open</span>';
  if (!isOpen) {
    letterOpened = true;
    completed.add("letter");
    paper.scrollIntoView({ behavior: "smooth", block: "center" });
    refreshSection("letter");
  }
});
// Cake flow: after her wish, every candle gets its own little "wow" moment.
// The flame goes out first, then a different surprise is revealed for each tap.
const cakeEl = document.querySelector(".cake");
const candles = [...document.querySelectorAll(".candle")];
let candlesOut = 0;
const candleSurprise = $("candleSurprise");
const candleSurpriseTitle = $("candleSurpriseTitle");
const candleSurpriseText = $("candleSurpriseText");
const candleSurpriseIcon = $("candleSurpriseIcon");
const candleSurpriseEyebrow = $("candleSurpriseEyebrow");
const candleSurpriseSignature = $("candleSurpriseSignature");
const surpriseVisual = $("surpriseVisual");
const candleSurpriseClose = $("candleSurpriseClose");
const candleSurpriseContinue = $("candleSurpriseContinue");

const candleSurprises = [
  {
    type: "stars",
    eyebrow: "Candle one · a little secret",
    icon: "🌟✨✨",
    title: "The first flame chose you.",
    text: "If I could bottle one beautiful moment from today, I would save the moment you smiled after seeing this.",
    signature: "— because your smile deserves its own little universe ♡",
  },
  {
    type: "flowers",
    eyebrow: "Candle two · flower shower",
    icon: "🌸🌹🌹",
    title: "A flower for every reason you are special.",
    text: "Some flowers bloom in gardens. Some bloom in someone's presence. You are the second kind.",
    signature: "— may something beautiful find you today 🌷",
  },
  {
    type: "heart",
    eyebrow: "Candle three · from the heart",
    icon: "💌",
    title: "Here is something I hope you remember.",
    text: "You never have to become someone else to deserve love, kindness, celebration, or beautiful things. You are already enough.",
    signature: "— exactly as you are, always ❤️",
  },
  {
    type: "moon",
    eyebrow: "Candle four · midnight magic",
    icon: "🌙🌕",
    title: "Even the moon has a message for you.",
    text: "On the days when everything feels quiet, remember that quiet does not mean forgotten. Some of the brightest things shine softly.",
    signature: "— keep your gentle light ✨",
  },
  {
    type: "crown",
    eyebrow: "Candle five · princess moment",
    icon: "👑",
    title: "Your crown was never missing.",
    text: "You did not need a birthday to be special. Today is simply an excuse to remind you that you have always been worth celebrating.",
    signature: "— now wear that invisible crown proudly 👑",
  },
  {
    type: "fireworks",
    eyebrow: "Candle six · the final secret",
    icon: "🎆",
    title: "Okay… this one is for the grand finale.",
    text: "Six flames, six little surprises—and somehow the best surprise is still you. Happy Birthday, my princess. ❤️",
    signature: "— make a wish, then make the year beautiful ✨",
  },
];

function updateCakeStage() {
  const ready = wishMade && !cakeDone;
  $("wishStartBtn").classList.toggle("hidden", wishMade);
  $("tapHint").classList.toggle("hidden", !ready);
  cakeEl.classList.toggle("tap-ready", ready);
  candles.forEach((c) => (c.disabled = !ready || c.classList.contains("out")));
}

function launchCandleParticles(type) {
  const symbols = {
    stars: ["✦", "✧", "⭐", "✨"],
    flowers: ["🌸", "🌷", "✿", "❀"],
    heart: ["♥", "♡", "💗", "💖"],
    moon: ["☾", "✦", "·", "🌙"],
    crown: ["♕", "👑", "✦", "💎"],
    fireworks: ["🎆", "🎇", "✨", "🎉", "💖"],
  }[type] || ["✨", "💗"];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement("span");
    p.className = `candle-particle candle-particle-${type}`;
    p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    p.style.left = `${10 + Math.random() * 80}%`;
    p.style.top = `${28 + Math.random() * 34}%`;
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 260}px`);
    p.style.setProperty("--dy", `${-80 - Math.random() * 190}px`);
    p.style.setProperty("--spin", `${-180 + Math.random() * 360}deg`);
    p.style.animationDelay = `${Math.random() * 120}ms`;
    candleSurprise.appendChild(p);
    window.setTimeout(() => p.remove(), 1800);
  }
}

function showCandleSurprise(index) {
  const surprise = candleSurprises[index];
  if (!surprise) return;
  candleSurprise.className = `candle-surprise surprise-${surprise.type} is-visible`;
  candleSurprise.setAttribute("aria-hidden", "false");
  candleSurpriseEyebrow.textContent = surprise.eyebrow;
  candleSurpriseIcon.textContent = surprise.icon;
  candleSurpriseTitle.textContent = surprise.title;
  candleSurpriseText.textContent = surprise.text;
  candleSurpriseSignature.textContent = surprise.signature;
  surpriseVisual.innerHTML = "";
  if (surprise.type === "stars") {
    surpriseVisual.innerHTML = '<span>✦</span><span>✧</span><span>✦</span><span>·</span><span>✧</span>';
  } else if (surprise.type === "flowers") {
    surpriseVisual.innerHTML = '<span>🌸</span><span>🌷</span><span>🌸</span>';
  } else if (surprise.type === "heart") {
    surpriseVisual.innerHTML = '<span>♡</span><span>♥</span><span>♡</span>';
  } else if (surprise.type === "moon") {
    surpriseVisual.innerHTML = '<span>☾</span><span>✦</span><span>✧</span>';
  } else if (surprise.type === "crown") {
    surpriseVisual.innerHTML = '<span>✦</span><span>👑</span><span>✦</span>';
  } else {
    surpriseVisual.innerHTML = '<span>✦</span><span>🎆</span><span>✧</span><span>🎇</span><span>✦</span>';
  }
  launchCandleParticles(surprise.type);
  if (index === candleSurprises.length - 1) confettiBurst();
}

function closeCandleSurprise() {
  candleSurprise.classList.remove("is-visible");
  candleSurprise.setAttribute("aria-hidden", "true");
}

function finishCake() {
  cakeEl.classList.add("blown");
  $("cakeMessage").textContent =
    "All six flames are out. You found every hidden surprise. Let the birthday magic begin! 🎉";
  $("birthdayShout").classList.remove("hidden");
  cakeDone = true;
  completed.add("cake");
  updateCakeStage();
  confettiBurst();
  window.setTimeout(() => showCandleSurprise(5), 350);
  refreshSection("cake");
}

$("wishStartBtn").addEventListener("click", () => {
  const wishIndex = sectionIds.indexOf("wish");
  if (wishIndex !== -1) setActiveSection(wishIndex);
});

$("toBlowBtn").addEventListener("click", () => {
  updateCakeStage();
  setActiveSection(sectionIds.indexOf("cake"));
});

candles.forEach((candle, index) =>
  candle.addEventListener("click", () => {
    if (!wishMade || cakeDone || candle.classList.contains("out")) return;
    candle.classList.add("out");
    candle.disabled = true;
    candlesOut++;
    candle.classList.add("candle-just-blown");
    window.setTimeout(() => candle.classList.remove("candle-just-blown"), 700);
    showCandleSurprise(index);
    if (candlesOut === candles.length) finishCake();
  }),
);

candleSurpriseClose.addEventListener("click", closeCandleSurprise);
candleSurpriseContinue.addEventListener("click", closeCandleSurprise);
candleSurprise.querySelector(".candle-surprise-backdrop").addEventListener("click", closeCandleSurprise);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && candleSurprise.classList.contains("is-visible"))
    closeCandleSurprise();
});
$("wishBtn").addEventListener("click", () => {
  const raw = $("wishText").value.trim();
  if (!raw) {
    $("wishText").focus();
    $("wishText").placeholder =
      "Close your eyes and write one little wish first... ✨";
    return;
  }
  $("wishEcho").textContent = "“" + raw + "”";
  $("wishResponse").classList.remove("hidden");
  $("wishResponse").classList.add("wish-revealed");
  $("wishBtn").textContent = "Wish released into the stars ✨";
  $("wishBtn").disabled = true;
  $("wishText").readOnly = true;
  wishMade = true;
  updateCakeStage();
  confettiBurst();
  refreshSection("wish");
});
const promiseChecks = [...document.querySelectorAll(".promise-check")];
function updatePromises() {
  const count = promiseChecks.filter((c) => c.checked).length;
  $("promiseProgress").textContent = `${count} of 6 promises made`;
  promiseChecks.forEach((c) =>
    c.closest(".promise-card").classList.toggle("promise-selected", c.checked),
  );
  $("promiseBtn").disabled = count !== 6;
  if (count === 6) $("promiseBtn").classList.add("ready-glow");
  else $("promiseBtn").classList.remove("ready-glow");
}
promiseChecks.forEach((c) => c.addEventListener("change", updatePromises));
$("promiseBtn").addEventListener("click", () => {
  if (promiseChecks.some((c) => !c.checked)) return;
  $("promiseResponse").classList.remove("hidden");
  $("promiseBtn").disabled = true;
  promiseChecks.forEach((c) => (c.disabled = true));
  promiseConfirmed = true;
  completed.add("promises");
  refreshSection("promises");
  confettiBurst();
});
// Secret button lives only inside the final gift section and stays hidden until the full message is shown.
const secretDialog = $("secretDialog");
$("secretBtn").addEventListener("click", () => {
  if (!giftFinished) return;
  $("secretLoading").classList.remove("hidden");
  $("secretLoading").textContent = "Gathering a little courage...";
  $("loaderHeart").classList.remove("hidden");
  $("loaderDots").classList.remove("hidden");
  $("secretReveal").classList.add("hidden");
  secretDialog.showModal();
  clearTimeout(secretTimer);
  secretTimer = window.setTimeout(() => {
    $("secretLoading").classList.add("hidden");
    $("loaderHeart").classList.add("hidden");
    $("loaderDots").classList.add("hidden");
    $("secretReveal").classList.remove("hidden");
    secretOpened = true;
  }, 5000);
});
function closeSecret() {
  clearTimeout(secretTimer);
  secretDialog.close();
}
$("closeSecret").addEventListener("click", closeSecret);
secretDialog.addEventListener("click", (e) => {
  if (e.target === secretDialog) closeSecret();
});
$("giftBtn").addEventListener("click", () => {
  if (giftFinished) return;
  $("giftBtn").classList.add("open");
  $("giftBtn").disabled = true;
  // After the lid opens, the "Place the Birthday Crown" scene (crown.js) plays.
  // When she presses its Continue button, crown.js calls revealGiftMessage() below.
  giftTimer = window.setTimeout(() => {
    if (typeof window.openCrownScene === "function") window.openCrownScene();
    else revealGiftMessage();
  }, 650);
});
// The original final gift message + secret button reveal (unchanged behaviour).
function revealGiftMessage() {
  const message = $("giftMessage");
  message.classList.remove("hidden");
  message.classList.add("gift-message-reveal");
  requestAnimationFrame(initScratch);
  confettiBurst();
  const lines = [...message.children];
  lines.forEach((line, i) => {
    line.style.opacity = "0";
    line.style.animation = `giftLineIn .65s ${i * 0.7}s both`;
  });
  const total = lines.length * 700 + 700;
  giftTimer = window.setTimeout(() => {
    giftLinesDone = true;
    message.scrollIntoView({ behavior: "smooth", block: "center" });
    maybeFinishGift();
  }, total);
}
window.revealGiftMessage = revealGiftMessage;

// The final buttons appear once the lines have shown AND the little promise has been scratched open.
let giftLinesDone = false,
  scratched = false;
function maybeFinishGift() {
  if (giftFinished || !giftLinesDone || !scratched) return;
  giftFinished = true;
  completed.add("gift");
  $("secretBtn").classList.remove("hidden");
  $("replayBtn").classList.remove("hidden");
  refreshSection("gift");
}

// Scratch card: a foil layer covers "A little promise, from my heart" until it is scratched away.
const scratchCard = $("scratchCard"),
  scratchCanvas = $("scratchCanvas"),
  sctx = scratchCanvas.getContext("2d", { willReadFrequently: true });
let scratching = false,
  lastPt = null,
  lastCheck = 0;
function paintFoil() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = scratchCard.clientWidth,
    h = scratchCard.clientHeight;
  if (!w || !h) return;
  scratchCanvas.width = Math.round(w * dpr);
  scratchCanvas.height = Math.round(h * dpr);
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.globalCompositeOperation = "source-over";
  const g = sctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#f7bfdc");
  g.addColorStop(0.32, "#f6e0ac");
  g.addColorStop(0.62, "#f3b3d3");
  g.addColorStop(1, "#e6c283");
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    sctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.45})`;
    sctx.beginPath();
    sctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.8 + 0.4, 0, 6.283);
    sctx.fill();
  }
  sctx.textAlign = "center";
  sctx.textBaseline = "middle";
  sctx.fillStyle = "rgba(122,38,86,.9)";
  sctx.font = `600 ${Math.min(30, Math.max(21, w / 20))}px "Playfair Display", serif`;
  sctx.fillText("Scratch here 🤍", w / 2, h / 2 - 12);
  sctx.font = '500 15px "DM Sans", sans-serif';
  sctx.fillStyle = "rgba(122,38,86,.75)";
  sctx.fillText("to open your little promise", w / 2, h / 2 + 22);
}
function initScratch() {
  scratched = false;
  scratching = false;
  lastPt = null;
  scratchCanvas.classList.remove("done", "gone");
  paintFoil();
}
function scratchedFraction() {
  const { width, height } = scratchCanvas;
  const data = sctx.getImageData(0, 0, width, height).data;
  const step = 6;
  let clear = 0,
    total = 0;
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      total++;
      if (data[(y * width + x) * 4 + 3] < 40) clear++;
    }
  return clear / total;
}
function revealScratch() {
  if (scratched) return;
  scratched = true;
  scratching = false;
  scratchCanvas.classList.add("done");
  window.setTimeout(() => scratchCanvas.classList.add("gone"), 1000);
  confettiBurst();
  maybeFinishGift();
}
function scratchAt(e) {
  const rect = scratchCanvas.getBoundingClientRect();
  const k = scratchCanvas.clientWidth / rect.width || 1;
  const x = (e.clientX - rect.left) * k,
    y = (e.clientY - rect.top) * k;
  sctx.globalCompositeOperation = "destination-out";
  sctx.lineCap = "round";
  sctx.lineJoin = "round";
  sctx.lineWidth = 40;
  sctx.beginPath();
  sctx.moveTo(lastPt ? lastPt.x : x, lastPt ? lastPt.y : y);
  sctx.lineTo(x + 0.01, y);
  sctx.stroke();
  lastPt = { x, y };
  const now = performance.now();
  if (now - lastCheck > 140) {
    lastCheck = now;
    if (scratchedFraction() > 0.5) revealScratch();
  }
}
scratchCanvas.addEventListener("pointerdown", (e) => {
  if (scratched) return;
  scratching = true;
  lastPt = null;
  scratchCanvas.setPointerCapture?.(e.pointerId);
  scratchAt(e);
  e.preventDefault();
});
scratchCanvas.addEventListener("pointermove", (e) => {
  if (scratching) scratchAt(e);
});
const endScratch = () => {
  if (!scratching) return;
  scratching = false;
  lastPt = null;
  if (!scratched && scratchedFraction() > 0.5) revealScratch();
};
scratchCanvas.addEventListener("pointerup", endScratch);
scratchCanvas.addEventListener("pointercancel", endScratch);
scratchCanvas.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    revealScratch();
  }
});
window.addEventListener("resize", () => {
  if (!scratched && !$("giftMessage").classList.contains("hidden")) paintFoil();
});
$("replayBtn").addEventListener("click", () => {
  stopMirror();
  clearTimeout(secretTimer);
  clearTimeout(giftTimer);
  window.resetCrownScene?.();
  if (secretDialog.open) secretDialog.close();
  completed.clear();
  openedCards.clear();
  started = false;
  document.querySelectorAll(".reveal-card").forEach((c) => {
    c.classList.remove("is-open");
    c.setAttribute("aria-expanded", "false");
    c.classList.remove(
      "reveal-style-1",
      "reveal-style-2",
      "reveal-style-3",
      "reveal-style-4",
      "reveal-style-5",
    );
  });
  document.querySelectorAll(".next-btn").forEach((b) => {
    b.classList.add("hidden");
    b.classList.remove("next-unlock");
  });
  sections.forEach((s) => (s.dataset.endSeen = "false"));
  mirrorDone = false;
  letterOpened = false;
  cakeDone = false;
  wishMade = false;
  promiseConfirmed = false;
  giftFinished = false;
  secretOpened = false;
  giftLinesDone = false;
  scratched = false;
  scratchCanvas.classList.remove("done", "gone");
  restDone = false;
  resetRest();
  mirrorBtn.classList.remove("hidden");
  mirrorBtn.disabled = false;
  mirrorBtn.textContent = "Look in the Mirror 🪞";
  delete mirrorBtn.dataset.fallback;
  mirrorSkip.classList.add("hidden");
  $("mirrorReveal").classList.add("hidden");
  $("mirrorCountdown").classList.add("hidden");
  $("mirrorStatus").textContent =
    "Your camera is only used for this five-second mirror moment.";
  $("mirrorFrame").classList.remove("mirror-away", "mirror-fallback");
  $("mirrorFallbackPhoto")?.classList.add("hidden");
  $("mirrorFrame")
    ?.querySelector(".mirror-placeholder")
    ?.classList.remove("hidden");
  $("envelopeBtn").setAttribute("aria-expanded", "false");
  $("envelopeBtn").innerHTML =
    '<span class="envelope-heart">♥</span><span>Tap to open your letter</span>';
  $("letterPaper").classList.add("hidden");
  cakeEl.classList.remove("blown");
  $("cakeMessage").textContent = "";
  $("birthdayShout").classList.add("hidden");
  candles.forEach((c) => c.classList.remove("out"));
  candlesOut = 0;
  updateCakeStage();
  promiseChecks.forEach((c) => {
    c.checked = false;
    c.disabled = false;
  });
  updatePromises();
  $("promiseResponse").classList.add("hidden");
  $("giftBtn").classList.remove("open");
  $("giftBtn").disabled = false;
  $("giftMessage").classList.add("hidden");
  $("giftMessage").classList.remove("gift-message-reveal");
  $("secretBtn").classList.add("hidden");
  $("replayBtn").classList.add("hidden");
  $("calendarReveal").textContent = "";
  $("wishText").value = "";
  $("wishText").readOnly = false;
  $("wishBtn").disabled = false;
  $("wishBtn").textContent = "Release my wish into the stars ✨";
  $("wishResponse").classList.add("hidden");
  $("wishResponse").classList.remove("wish-revealed");
  sections.forEach((section, index) => {
    section.dataset.endSeen = "false";
    section.classList.toggle("chapter-hidden", index !== 0);
    section.setAttribute("aria-hidden", String(index !== 0));
  });
  setActiveSection(0);
});
// Background music: starts after the correct unlock code (that tap allows audio), then the button pauses/plays.
const music = $("backgroundMusic"),
  musicToggle = $("musicToggle");
function setMusicLabel(text) {
  musicToggle.textContent = text;
}
async function startMusic() {
  try {
    music.volume = 0.8;
    await music.play();
    setMusicLabel("♫ Music: On");
  } catch (err) {
    // Autoplay blocked or file missing
    setMusicLabel(
      music.error ? "⚠ Music file not found" : "♫ Music: Off (tap to play)",
    );
  }
}
music.addEventListener("error", () => setMusicLabel("⚠ Music file not found"));
music.addEventListener("play", () => setMusicLabel("♫ Music: On"));
music.addEventListener("pause", () => setMusicLabel("♫ Music: Off"));
musicToggle.addEventListener("click", () => {
  if (music.paused) startMusic();
  else music.pause();
});
unlockForm.addEventListener("submit", () => {
  if (passcode.value.trim() === "3110") startMusic();
});
const feature = document.querySelector(".feature-photo"),
  bgProbe = new Image();
bgProbe.onload = () => {
  feature.style.backgroundImage = 'url("photos/puja-background.jpg")';
};
bgProbe.onerror = () => {
  feature.style.backgroundImage =
    "radial-gradient(circle at 50% 30%,#80527c,#21152e 65%)";
};
bgProbe.src = "photos/puja-background.jpg";
window.addEventListener("pagehide", stopMirror);
updatePromises();

// 30-second rest break: a gentle breathing pause with soft messages. "Next surprise" unlocks when it finishes.
const REST_SECONDS = 30,
  RING_LENGTH = 339.292;
const restBtn = $("restBtn"),
  restRing = $("restRing"),
  restTime = $("restTime"),
  breathText = $("breathText"),
  breathOrb = $("breathOrb"),
  restWhisper = $("restWhisper"),
  restDoneBox = $("restDoneBox");
const restWhispers = [
  "Close your eyes, or soften your gaze. 🌙",
  "Let your shoulders drop. You are safe here. 🌿",
  "Whatever is on your mind can wait a little while. ☁️",
  "You have done so much. You are allowed to rest. 💗",
  "Feel how strong you are, even in stillness. ✨",
  "One more gentle breath… you are doing beautifully. 🌷",
];
let restInterval = null,
  restStart = 0,
  lastWhisper = -1;
function setWhisper(text) {
  restWhisper.textContent = text;
  restWhisper.classList.remove("whisper-in");
  void restWhisper.offsetWidth;
  restWhisper.classList.add("whisper-in");
}
function resetRest() {
  clearInterval(restInterval);
  restInterval = null;
  lastWhisper = -1;
  restRing.style.strokeDashoffset = RING_LENGTH;
  breathOrb.classList.remove("inhale", "exhale");
  breathText.textContent = "Ready when you are";
  restTime.textContent = REST_SECONDS;
  restWhisper.textContent = "Take a moment. The whole world can wait. 🌷";
  restWhisper.classList.remove("whisper-in");
  restBtn.disabled = false;
  restBtn.classList.remove("hidden");
  restBtn.textContent = "Begin my 30-second rest 🌿";
  restDoneBox.classList.add("hidden");
}
function finishRest() {
  clearInterval(restInterval);
  restInterval = null;
  restRing.style.strokeDashoffset = 0;
  breathOrb.classList.remove("inhale", "exhale");
  breathText.textContent = "All done";
  restTime.textContent = "🌸";
  setWhisper("Beautifully done. 💗");
  restBtn.classList.add("hidden");
  restDoneBox.classList.remove("hidden");
  restDone = true;
  completed.add("rest");
  refreshSection("rest");
}
function restTick() {
  // If she leaves this chapter mid-rest, start over so the full 30 seconds is always enjoyed.
  if ($("rest").classList.contains("chapter-hidden")) {
    resetRest();
    return;
  }
  const elapsed = (Date.now() - restStart) / 1000;
  if (elapsed >= REST_SECONDS) {
    finishRest();
    return;
  }
  restTime.textContent = Math.ceil(REST_SECONDS - elapsed);
  restRing.style.strokeDashoffset = RING_LENGTH * (1 - elapsed / REST_SECONDS);
  const phase = Math.floor(elapsed / 5),
    inhale = phase % 2 === 0;
  breathText.textContent = inhale ? "Breathe in…" : "Breathe out…";
  breathOrb.classList.toggle("inhale", inhale);
  breathOrb.classList.toggle("exhale", !inhale);
  if (phase !== lastWhisper) {
    lastWhisper = phase;
    setWhisper(restWhispers[Math.min(phase, restWhispers.length - 1)]);
  }
}
restBtn.addEventListener("click", () => {
  if (restInterval || restDone) return;
  restBtn.disabled = true;
  restBtn.textContent = "Resting… 🌿";
  restStart = Date.now();
  lastWhisper = -1;
  restInterval = window.setInterval(restTick, 250);
  restTick();
});
resetRest();

// Two surprise videos: sound on, one plays at a time, background music pauses while a video plays.
const surpriseVideos = [...document.querySelectorAll(".video-card video")];
let musicResumeAfterVideo = false;
function pauseAllVideos() {
  surpriseVideos.forEach((v) => {
    if (!v.paused) v.pause();
  });
}
function maybeResumeMusic() {
  if (
    musicResumeAfterVideo &&
    surpriseVideos.every((v) => v.paused || v.ended)
  ) {
    musicResumeAfterVideo = false;
    startMusic();
  }
}
surpriseVideos.forEach((video) => {
  const card = video.closest(".video-card"),
    missing = card.querySelector(".video-missing");
  video.muted = false;
  video.volume = 1;
  const showMissing = () => {
    missing.classList.remove("hidden");
    video.classList.add("hidden");
  };
  video.querySelector("source")?.addEventListener("error", showMissing);
  video.addEventListener("error", showMissing);
  video.addEventListener("loadedmetadata", () => {
    missing.classList.add("hidden");
    video.classList.remove("hidden");
  });
  video.addEventListener("play", () => {
    surpriseVideos.forEach((o) => {
      if (o !== video && !o.paused) o.pause();
    });
    if (!music.paused) {
      musicResumeAfterVideo = true;
      music.pause();
    }
  });
  video.addEventListener("pause", maybeResumeMusic);
  video.addEventListener("ended", maybeResumeMusic);
});


/* =====================================================================
   FLOATING BACKGROUND DECOR — pastel balloons and little cakes that
   drift slowly upward behind the content (inside #ambient).
   Tweak: LIMIT (max on screen), the two intervals, sizes and durations.
   ===================================================================== */
(() => {
  const ambient = document.getElementById("ambient");
  if (!ambient) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["#ffb3cf", "#f7a3c6", "#dcc6ff", "#ffd2b0", "#ffc4d9", "#eab9f5"];
  const LIMIT = 14;

  const balloonSVG = (c) =>
    `<svg viewBox="0 0 40 64" aria-hidden="true"><ellipse cx="20" cy="20" rx="16" ry="19" fill="${c}"/>` +
    `<ellipse cx="13" cy="12" rx="3.6" ry="6" fill="#fff" opacity=".5" transform="rotate(-20 13 12)"/>` +
    `<path d="M20 39 l-3.2 4.4 h6.4z" fill="${c}"/><path d="M20 43 C15 50 25 54 20 63" stroke="#c98aa8" fill="none" stroke-width="1"/></svg>`;
  const CAKE =
    `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="40" width="50" height="17" rx="5" fill="#ffc6e1"/>` +
    `<rect x="13" y="26" width="38" height="16" rx="5" fill="#ffadd2"/>` +
    `<path d="M7 44 q6.2 6 12.5 0 t12.5 0 t12.5 0 t12.5 0" fill="none" stroke="#fff" stroke-width="3"/>` +
    `<rect x="29" y="14" width="6" height="13" rx="2" fill="#fff"/><path d="M32 5 q4.5 5.5 0 10 q-4.5 -4.5 0 -10z" fill="#ffd36e"/>` +
    `<circle cx="22" cy="34" r="2" fill="#fff"/><circle cx="42" cy="34" r="2" fill="#fff"/></svg>`;

  function make(kind, firstRun) {
    if (ambient.querySelectorAll(".floater").length >= LIMIT) return;
    const el = document.createElement("div");
    el.className = "floater";
    const w = kind === "cake" ? 44 + Math.random() * 24 : 38 + Math.random() * 32;
    const h = kind === "cake" ? w : w * 1.6;
    const dur = 24 + Math.random() * 16;
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.left = 2 + Math.random() * 92 + "%";
    el.style.animationDuration = dur + "s";
    if (firstRun) el.style.animationDelay = "-" + Math.random() * dur * 0.9 + "s";
    const inner = document.createElement("span");
    inner.style.animationDuration = 4 + Math.random() * 3 + "s";
    inner.innerHTML = kind === "cake" ? CAKE : balloonSVG(COLORS[Math.floor(Math.random() * COLORS.length)]);
    el.appendChild(inner);
    ambient.appendChild(el);
    setTimeout(() => el.remove(), (dur + 2) * 1000 + (firstRun ? 0 : 0));
  }

  if (reduce) {
    // Reduced motion: a few still decorations instead of drifting ones.
    [["balloon", 8, 22], ["cake", 86, 12], ["balloon", 78, 58], ["cake", 6, 66], ["balloon", 48, 80]].forEach(([k, x, y]) => {
      make(k, false);
      const el = ambient.lastElementChild;
      if (!el) return;
      el.style.animation = "none";
      el.style.opacity = ".55";
      el.style.left = x + "%";
      el.style.bottom = y + "%";
      el.firstElementChild.style.animation = "none";
    });
    return;
  }

  for (let i = 0; i < 6; i++) make("balloon", true);
  for (let i = 0; i < 2; i++) make("cake", true);
  setInterval(() => { if (!document.hidden) make("balloon", false); }, 2800);
  setInterval(() => { if (!document.hidden) make("cake", false); }, 10500);
})();


/* =====================================================================
   PLACE THE BIRTHDAY CROWN
   Opens after the gift box opens (see script.js -> giftBtn handler).
   When the person presses "Continue to Your Next Surprise →" the scene
   closes and the original final gift message is revealed.

   HOW TO ADJUST
   • Crown resting position on her head:  index.html -> <g id="csAnchor" transform="translate(200 262)">
       (x = left/right, y = up/down; bigger y = lower on the head)
   • Heights / distances / durations: edit the CROWN object just below.
   • Use your own artwork instead of the built-in SVG: fill in CROWN.images
       crown -> a transparent PNG/SVG of the crown (e.g. "assets/images/crown.png")
       hand  -> a transparent PNG/SVG of the LEFT hand pointing right, gripping at its
                tip; the right hand is mirrored automatically. Use x / y / width / height
                to place it (the pinch point is the 0,0 origin).
   ===================================================================== */
(() => {
  "use strict";

  const CROWN = {
    images: {
      crown: "", // e.g. "assets/images/crown.png"
      crownBox: { x: -58, y: -66, width: 116, height: 68 }, // crown image box (base-centre = 0,0)
      hand: "", // e.g. "assets/images/hand-left.png"
      handBox: { x: -230, y: -34, width: 240, height: 100 },
    },
    // Animation durations in milliseconds
    ms: {
      enter: 1700, // hands slide in from the screen sides
      grab: 350, // short pause once they hold the crown
      lower: 2600, // crown travels down to hover above her head
      place: 1300, // final gentle lowering onto her head
      holdAfter: 350, // pause after touching the head
      release: 1700, // hands open slightly, then leave the screen
      message: 1600, // wait for the message to fade in before the Continue button
    },
    startY: -215, // crown height when the hands arrive (more negative = higher)
    hoverY: -36, // height where the crown pauses above her head
    handOffX: 1700, // how far off-screen the hands start and finish
    openHandX: 22, // how far the hands open when letting go
    sparkles: 16, // golden sparkles when the crown touches her head
  };

  const $c = (id) => document.getElementById(id);
  const scene = $c("crownScene");
  if (!scene) return;
  const asm = $c("csAsm"), crown = $c("csCrown"), joy = $c("csJoy"), spark = $c("csSpark"), twinkle = $c("csTwinkle");
  const text = $c("csText"), floatBox = $c("csFloat"), placeBtn = $c("csPlaceBtn"), contBtn = $c("csContinueBtn"), hint = $c("csHint");
  const L = [...scene.querySelectorAll(".cs-L")], R = [...scene.querySelectorAll(".cs-R")], hands = [...L, ...R];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPEED = reduce ? 0.25 : 1;
  const NS = "http://www.w3.org/2000/svg";
  let state = "idle"; // idle -> ready -> playing -> done
  let heartTimer = null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SPEED));
  const run = (els, frames, ms, easing) =>
    Promise.all([].concat(els).map((el) =>
      el.animate(frames, { duration: Math.max(1, ms * SPEED), easing: easing || "ease-in-out", fill: "forwards" }).finished.catch(() => {})
    ));

  /* ---- optional custom artwork ---- */
  (function applyImages() {
    const im = CROWN.images;
    if (im.crown) {
      const img = scene.querySelector(".cs-crown-img");
      scene.querySelector(".cs-crown-art").setAttribute("display", "none");
      img.setAttribute("href", im.crown);
      Object.entries(im.crownBox).forEach(([k, v]) => img.setAttribute(k, v));
      img.removeAttribute("display");
    }
    if (im.hand) {
      scene.querySelectorAll(".cs-hand-back").forEach((g) => {
        g.querySelector("use").setAttribute("display", "none");
        const img = g.querySelector(".cs-hand-img");
        img.setAttribute("href", im.hand);
        Object.entries(im.handBox).forEach(([k, v]) => img.setAttribute(k, v));
        img.removeAttribute("display");
      });
      scene.querySelectorAll(".cs-hand-front").forEach((g) => g.setAttribute("display", "none"));
    }
  })();

  /* ---- reset to the starting picture ---- */
  function reset() {
    [asm, crown, joy, ...hands].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    asm.style.transform = `translateY(${CROWN.startY}px)`;
    crown.style.opacity = "0";
    crown.style.transform = "";
    L.forEach((e) => { e.style.display = ""; e.style.opacity = "0"; e.style.transform = `translateX(${-CROWN.handOffX}px)`; });
    R.forEach((e) => { e.style.display = ""; e.style.opacity = "0"; e.style.transform = `translateX(${CROWN.handOffX}px)`; });
    spark.replaceChildren();
    twinkle.replaceChildren();
    scene.classList.remove("lit");
    text.classList.remove("in");
    placeBtn.classList.remove("hidden");
    placeBtn.disabled = false;
    hint.classList.remove("hidden");
    contBtn.classList.add("hidden");
    state = "ready";
  }

  /* ---- effects ---- */
  function burst() {
    for (let i = 0; i < CROWN.sparkles; i++) {
      const t = document.createElementNS(NS, "text");
      t.textContent = ["✦", "✧", "✨", "♥"][i % 4];
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("fill", i % 3 ? "#e9b949" : "#ff8fb8");
      t.setAttribute("font-size", String(10 + Math.random() * 12));
      spark.appendChild(t);
      const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 70;
      const rot = Math.random() * 120 - 60;
      const done = () => t.remove();
      t.animate(
        [
          { transform: "translate(0px,0px) scale(.3)", opacity: 0 },
          { opacity: 1, offset: 0.25 },
          { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r * 0.7 - 20}px) scale(1.1) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: Math.max(1, (900 + Math.random() * 700) * SPEED), easing: "ease-out" }
      ).finished.then(done, done);
    }
  }
  function startTwinkle() {
    if (reduce) return;
    [[-46, -44], [50, -36], [-18, -66], [24, -64], [0, -30]].forEach(([x, y], i) => {
      const t = document.createElementNS(NS, "text");
      t.textContent = "✦";
      t.setAttribute("x", x); t.setAttribute("y", y);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("fill", "#f2c24b");
      t.setAttribute("font-size", "11");
      t.style.opacity = "0";
      twinkle.appendChild(t);
      t.animate([{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.4)" }],
        { duration: 2200, delay: i * 420, iterations: Infinity, easing: "ease-in-out" });
    });
  }
  function startHearts() {
    if (reduce) return;
    heartTimer = setInterval(() => {
      const h = document.createElement("span");
      h.className = "particle";
      h.textContent = ["💗", "♡", "💕", "✨"][Math.floor(Math.random() * 4)];
      h.style.left = Math.random() * 100 + "%";
      h.style.fontSize = 14 + Math.random() * 14 + "px";
      h.style.animationDuration = 7 + Math.random() * 4 + "s";
      floatBox.appendChild(h);
      setTimeout(() => h.remove(), 11500);
    }, 650);
  }
  const stopHearts = () => { clearInterval(heartTimer); heartTimer = null; };

  /* ---- the animation ---- */
  async function play() {
    if (state !== "ready") return; // prevents double-triggering
    state = "playing";
    placeBtn.disabled = true;
    placeBtn.classList.add("hidden");
    hint.classList.add("hidden");
    scene.classList.add("lit");
    const M = CROWN.ms, off = CROWN.handOffX;

    // 1. Hands enter from both sides while the crown appears between them
    await Promise.all([
      run(L, [{ transform: `translateX(${-off}px)`, opacity: 0 }, { transform: "translateX(0px)", opacity: 1 }], M.enter, "cubic-bezier(.2,.7,.2,1)"),
      run(R, [{ transform: `translateX(${off}px)`, opacity: 0 }, { transform: "translateX(0px)", opacity: 1 }], M.enter, "cubic-bezier(.2,.7,.2,1)"),
      run(crown, [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "scale(1)" }], M.enter * 0.8, "ease-out"),
    ]);
    await sleep(M.grab);

    // 2. Carry the crown down to hover just above her head
    await run(asm, [{ transform: `translateY(${CROWN.startY}px)` }, { transform: `translateY(${CROWN.hoverY}px)` }], M.lower, "cubic-bezier(.45,.05,.3,1)");
    await sleep(250);

    // 3. Gently lower it onto her head (sparkles at the moment of contact)
    setTimeout(burst, M.place * 0.7 * SPEED);
    await run(asm, [
      { transform: `translateY(${CROWN.hoverY}px)` },
      { transform: "translateY(4px)", offset: 0.72 },
      { transform: "translateY(0px)" },
    ], M.place, "ease-in-out");
    await sleep(M.holdAfter);
    startTwinkle();

    // 4. Hands open slightly, then slide away off-screen
    const leave = (sign) => [
      { transform: "translateX(0px)", opacity: 1 },
      { transform: `translateX(${sign * CROWN.openHandX}px)`, opacity: 1, offset: 0.2 },
      { transform: `translateX(${sign * off}px)`, opacity: 0 },
    ];
    const hop = run(joy, [{ transform: "translateY(0px)" }, { transform: "translateY(-9px)", offset: 0.3 }, { transform: "translateY(0px)", offset: 0.6 }, { transform: "translateY(-5px)", offset: 0.8 }, { transform: "translateY(0px)" }], 1100, "ease-out");
    await Promise.all([run(L, leave(-1), M.release, "ease-in"), run(R, leave(1), M.release, "ease-in"), hop]);
    hands.forEach((h) => { h.style.display = "none"; });

    // 5. Message fades in, then the Continue button appears
    text.classList.add("in");
    await sleep(M.message);
    contBtn.classList.remove("hidden");
    contBtn.focus({ preventScroll: true });
    state = "done";
  }

  /* ---- open / close ---- */
  function open() {
    if (state === "playing" || !scene.classList.contains("hidden")) return;
    reset();
    scene.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => scene.classList.add("show")));
    startHearts();
    placeBtn.focus({ preventScroll: true });
  }
  function close(immediate) {
    stopHearts();
    scene.classList.remove("show");
    document.body.style.overflow = "";
    const hide = () => { scene.classList.add("hidden"); floatBox.replaceChildren(); };
    immediate ? hide() : setTimeout(hide, 650);
  }

  placeBtn.addEventListener("click", play);
  contBtn.addEventListener("click", () => {
    if (state !== "done") return;
    state = "closed";
    close(false);
    if (typeof window.revealGiftMessage === "function") window.revealGiftMessage();
  });
  // keep keyboard focus inside the scene while it is open
  scene.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const b = [placeBtn, contBtn].find((x) => !x.classList.contains("hidden") && !x.disabled);
    if (b) b.focus();
  });

  window.openCrownScene = open;
  window.resetCrownScene = () => { close(true); state = "idle"; };
})();


/* =====================================================================
   VIDEO REVEAL — custom SVG heart mask
   Each video frame is clipped by an SVG <clipPath> whose heart grows from
   nothing until it covers the whole frame, then the mask is removed.
   Runs every time the videos chapter opens (see setActiveSection).
   ===================================================================== */
(() => {
  const frames = [...document.querySelectorAll(".video-frame")];
  if (!frames.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MAX_SCALE = 4.4,
    DURATION = 1500,
    STAGGER = 380;
  const heartTransform = (s) => `translate(.5 .5) scale(${s}) translate(-.5 -.45)`;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function reveal() {
    frames.forEach((frame, i) => {
      const path = document.getElementById(`videoHeartPath${i + 1}`);
      if (!path || reduce) return;
      if (frame._heartRaf) cancelAnimationFrame(frame._heartRaf);
      const clip = `url(#videoHeartClip${i + 1})`;
      path.setAttribute("transform", heartTransform(0.001));
      frame.style.clipPath = clip;
      frame.style.webkitClipPath = clip;
      const start = performance.now() + i * STAGGER;
      const tick = (now) => {
        const t = Math.max(0, Math.min(1, (now - start) / DURATION));
        path.setAttribute("transform", heartTransform(0.001 + easeOut(t) * MAX_SCALE));
        if (t < 1) frame._heartRaf = requestAnimationFrame(tick);
        else {
          frame.style.clipPath = "";
          frame.style.webkitClipPath = "";
          frame._heartRaf = null;
        }
      };
      frame._heartRaf = requestAnimationFrame(tick);
    });
  }
  window.revealVideos = reveal;
})();
