// Shared script for top.html, left.html and right.html.
// Not every part has every element (e.g. the top banner has no CTA).
// GSAP simply skips selectors that find nothing; this line only hides the console warning.
gsap.config({ nullTargetWarn: false });

// ---------- 1. Clickout ----------
const clickTag = window.clickTag || 'https://example.com/landing';

document.querySelector('.ad').addEventListener('click', () => {
  window.open(clickTag, '_blank');
});

// ---------- 2. Reduced motion ----------
// If the user doesn't want motion, we do nothing: the HTML already shows the final state.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion) {
  hideEverything();
  waitForStart();
}

// ---------- 3. Start state (before the intro) ----------
function hideEverything() {
  // The product packs are part of the background image, so the background must end at
  // scale 1, otherwise the packs are not where the design wants them.
  gsap.set('.bg', { scale: 1.12 });
  // The logo sits at the top of a full-size layer, so we scale it around the logo's own centre.
  gsap.set('.logo', { opacity: 0, scale: 0.8, transformOrigin: '50% 125px' });
  gsap.set('.line', { opacity: 0, y: 20 });
  gsap.set('.box', { opacity: 0, y: 40 });
  gsap.set('.copy', { opacity: 0, y: 20 });
  gsap.set('.cta', { opacity: 0, scale: 0.6 });
}

// ---------- 4. Intro animation (about 4 seconds) ----------
// The numbers at the end of each line are start times in seconds.
// They are the same in all three parts, so the parts play together.
function playIntro() {
  const intro = gsap.timeline({ onComplete: playIdle });

  // Background (with the products) glides into place and eases to a stop.
  intro.to('.bg', { scale: 1, duration: 4, ease: 'power2.out' }, 0);
  intro.to('.logo', { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.7)' }, 0.5);
  intro.to('.line', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.4 }, 0.8);
  intro.to('.box', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 1.8);
  intro.to('.copy', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 2.2);
  intro.to('.cta', { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, 2.8);
}

// ---------- 5. After the intro: calm idle animation ----------
// Both animations have a fixed number of repeats, so they stop by themselves
// after about 24 seconds (about 28 seconds after the ad started).
function playIdle() {
  // Background slowly "breathes": 6s in, 6s out, 4 runs in total = 24s.
  // An even number of runs means it ends back at scale 1 (the design layout).
  gsap.to('.bg', { scale: 1.02, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: 3 });

  // Gentle CTA pulse every 4 seconds, 6 pulses in total = 24s.
  const pulse = gsap.timeline({ repeat: 5, repeatDelay: 3 });
  pulse.to('.cta', { scale: 1.05, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 });
}

// ---------- 6. When to start ----------
// Alone (production): start as soon as all images are loaded.
// Inside preview.html (URL has ?sync): wait for the "start" message from the preview,
// so all three parts start at exactly the same moment.
// A 5-second fallback makes sure the ad never stays empty.
function waitForStart() {
  let started = false;

  function start() {
    if (started) return;
    started = true;
    playIntro();
  }

  const isSynced = new URLSearchParams(location.search).has('sync');

  if (isSynced) {
    window.addEventListener('message', (event) => {
      if (event.data === 'fireplace-start') start();
    });
    setTimeout(start, 5000);
  } else {
    // Also wait for web fonts (top headline), so the text never animates in a fallback font.
    window.addEventListener('load', () => {
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
    });
  }
}
