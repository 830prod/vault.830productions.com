(() => {
  const DEFAULT_FILES = ['Example.html'];

  const loader = document.querySelector('.site-loader');
  const loaderQuip = document.querySelector('[data-loader-quip]');
  const revealNodes = document.querySelectorAll('.reveal');
  const yearNode = document.querySelector('[data-year]');
  const form = document.querySelector('[data-search-form]');
  const input = document.querySelector('[data-search-input]');
  const resultsMeta = document.querySelector('[data-results-meta]');
  const resultsList = document.querySelector('[data-results-list]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let vaultFiles = DEFAULT_FILES;

  const loaderShownAt = performance.now();
  const minimumLoaderTime = reduceMotion.matches ? 120 : 620;

  if (loaderQuip instanceof HTMLElement) {
    const quips = [
      'Unlocking the vault...',
      'Checking the access path...',
      'Indexing the good stuff...',
      'Finding the right room...'
    ];

    loaderQuip.textContent = quips[Math.floor(Math.random() * quips.length)];
  }

  window.addEventListener('load', () => {
    if (!(loader instanceof HTMLElement)) {
      return;
    }

    const elapsed = performance.now() - loaderShownAt;
    const remaining = Math.max(0, minimumLoaderTime - elapsed);

    window.setTimeout(() => {
      loader.classList.add('is-hidden');
      window.setTimeout(() => loader.remove(), reduceMotion.matches ? 80 : 500);
    }, remaining);
  });

  if ('IntersectionObserver' in window && revealNodes.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -48px 0px'
      }
    );

    revealNodes.forEach((node) => revealObserver.observe(node));
  } else {
    revealNodes.forEach((node) => node.classList.add('visible'));
  }

  if (yearNode instanceof HTMLElement) {
    yearNode.textContent = String(new Date().getFullYear());
  }

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);

  const normalize = (value) => String(value)
    .toLowerCase()
    .replace(/\.html?$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const titleFromPath = (path) => path
    .replace(/\.html?$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const scoreFile = (path, query) => {
    const terms = normalize(query).split(' ').filter(Boolean);

    if (terms.length === 0) {
      return 0;
    }

    const fileName = normalize(path);
    const title = normalize(titleFromPath(path));
    const haystack = `${fileName} ${title}`;

    return terms.reduce((score, term) => {
      if (fileName === term || title === term) {
        return score + 60;
      }

      if (fileName.includes(term)) {
        score += 28;
      }

      if (title.includes(term)) {
        score += 22;
      }

      return haystack.includes(term) ? score + 2 : score;
    }, 0);
  };

  const renderResults = (query) => {
    if (!(resultsMeta instanceof HTMLElement) || !(resultsList instanceof HTMLElement)) {
      return;
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      resultsMeta.textContent = `${vaultFiles.length} vault page${vaultFiles.length === 1 ? '' : 's'} available.`;
      resultsList.innerHTML = '<div class="empty-state">Enter a file name to search the vault.</div>';
      return;
    }

    const results = vaultFiles
      .map((path) => ({ path, title: titleFromPath(path), score: scoreFile(path, trimmedQuery) }))
      .filter((file) => file.score > 0)
      .sort((a, b) => b.score - a.score);

    resultsMeta.textContent = results.length === 1
      ? '1 possible match found.'
      : `${results.length} possible matches found.`;

    if (results.length === 0) {
      resultsList.innerHTML = '<div class="empty-state">No file matched that search.</div>';
      return;
    }

    resultsList.innerHTML = results.map((item) => `
        <article class="result-card">
          <div>
            <div class="result-title">
              <strong>${escapeHtml(item.title)}</strong>
              <span class="result-path">/${escapeHtml(item.path)}</span>
            </div>
            <p>Open the vault page for this file.</p>
          </div>
          <a class="result-open" href="${escapeHtml(item.path)}">Open Page</a>
        </article>
      `).join('');
  };

  const loadVaultFiles = async () => {
    try {
      const response = await fetch('vault-files.json', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Missing vault file list');
      }

      const files = await response.json();

      if (Array.isArray(files)) {
        vaultFiles = files
          .filter((file) => typeof file === 'string' && /\.html?$/i.test(file) && file.toLowerCase() !== 'index.html')
          .sort((a, b) => a.localeCompare(b));
      }
    } catch (error) {
      vaultFiles = DEFAULT_FILES;
    }

    if (input instanceof HTMLInputElement) {
      renderResults(input.value);
    }
  };

  if (input instanceof HTMLInputElement) {
    input.addEventListener('input', () => renderResults(input.value));
  }

  if (form instanceof HTMLFormElement && input instanceof HTMLInputElement) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderResults(input.value);

      if (resultsList instanceof HTMLElement) {
        resultsList.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
      }
    });
  }

  loadVaultFiles();
})();
