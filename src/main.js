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

const teacherRoom = document.querySelector('#teacher-resources');

if (teacherRoom) {
  const loginForm = teacherRoom.querySelector('#teacher-login-form');
  const passwordInput = teacherRoom.querySelector('#teacher-password');
  const loginButton = loginForm?.querySelector('button[type="submit"]');
  const status = teacherRoom.querySelector('#teacher-login-message');
  const lockedPanel = teacherRoom.querySelector('#teacher-locked');
  const unlockedPanel = teacherRoom.querySelector('#teacher-unlocked');
  const documentsHeading = teacherRoom.querySelector('#teacher-documents-heading');
  const signoutButton = teacherRoom.querySelector('#teacher-signout');

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const setAuthenticated = (authenticated) => {
    if (lockedPanel) lockedPanel.hidden = authenticated;
    if (unlockedPanel) unlockedPanel.hidden = !authenticated;
    if (authenticated) documentsHeading?.focus({ preventScroll: true });
  };

  const refreshTeacherSession = async () => {
    try {
      const response = await fetch('/api/teachers/auth', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        setStatus('Teacher access is temporarily unavailable. Please try again later.', true);
        return;
      }
      const data = await response.json();
      setAuthenticated(Boolean(data.authenticated));
    } catch {
      setStatus('Could not connect to teacher access. Check your connection and try again.', true);
    }
  };

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!passwordInput || !loginButton) return;

    loginButton.disabled = true;
    setStatus('Checking access…');

    try {
      const response = await fetch('/api/teachers/auth', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.value }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.authenticated) {
        setAuthenticated(true);
        setStatus('Access granted.');
      } else if (response.status === 401) {
        setAuthenticated(false);
        setStatus('That password did not match. Please try again.', true);
        passwordInput.focus();
      } else {
        setAuthenticated(false);
        setStatus(data.error || 'Teacher access is temporarily unavailable. Please try again later.', true);
      }
    } catch {
      setAuthenticated(false);
      setStatus('Could not connect to teacher access. Check your connection and try again.', true);
    } finally {
      passwordInput.value = '';
      loginButton.disabled = false;
    }
  });

  signoutButton?.addEventListener('click', async () => {
    signoutButton.disabled = true;
    try {
      const response = await fetch('/api/teachers/auth', {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Could not confirm sign-out.');
      setAuthenticated(false);
      setStatus('The resource area is locked again.');
      passwordInput?.focus();
    } catch {
      setAuthenticated(false);
      setStatus('The page is hidden, but sign-out could not be confirmed. Close this tab and try again.', true);
    } finally {
      signoutButton.disabled = false;
    }
  });

  refreshTeacherSession();
}
