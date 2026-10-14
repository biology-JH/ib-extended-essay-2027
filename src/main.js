const progressBar = document.querySelector('#reading-progress-bar');
const tocLinks = [...document.querySelectorAll('#toc-nav a, .mobile-toc a')];
const printButton = document.querySelector('#print-page');

if (printButton) {
  printButton.addEventListener('click', () => window.print());
}

// The source images remain large in the article; a keyboard-accessible link opens each original asset.
for (const image of document.querySelectorAll('.source-figure img')) {
  const link = document.createElement('a');
  link.className = 'image-link';
  link.href = image.currentSrc || image.src;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.setAttribute('aria-label', `Open full-size image: ${image.alt}`);
  image.parentNode.insertBefore(link, image);
  link.appendChild(image);
}

function updateProgress() {
  if (!progressBar) return;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const fraction = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
  progressBar.style.width = `${fraction * 100}%`;
}

window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();

const sections = [...new Set(tocLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean))];

if ('IntersectionObserver' in window && sections.length) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const current = `#${entry.target.id}`;
      for (const link of tocLinks) {
        const active = link.getAttribute('href') === current;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-20% 0px -68% 0px', threshold: 0 });

  sections.forEach((section) => observer.observe(section));
}
