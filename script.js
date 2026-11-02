(() => {
  const DEFAULT_FILES = ['Example.html'];

  const yearNode = document.querySelector('[data-year]');
  const form = document.querySelector('[data-search-form]');
  const input = document.querySelector('[data-search-input]');
  const resultsMeta = document.querySelector('[data-results-meta]');
  const resultsList = document.querySelector('[data-results-list]');
  const suggestionsList = document.querySelector('[data-suggestions]');
  const MAX_SUGGESTIONS = 5;
  let vaultFiles = DEFAULT_FILES;
  let suggestions = [];
  let activeIndex = -1;

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
    .replace(/^.*vault\.830productions\.com\/?/, '')
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

    if (fileName === terms.join(' ')) {
      return 1000;
    }

    return terms.reduce((score, term) => {
      if (fileName.split(' ').includes(term)) {
        return score + 40;
      }

      return fileName.includes(term) ? score + 20 : score;
    }, 0);
  };

  const findMatches = (query) => vaultFiles
    .map((path) => ({ path, title: titleFromPath(path), score: scoreFile(path, query) }))
    .filter((file) => file.score > 0)
    .sort((a, b) => b.score - a.score);

  const renderResults = (query) => {
    if (!(resultsMeta instanceof HTMLElement) || !(resultsList instanceof HTMLElement)) {
      return [];
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      resultsMeta.textContent = 'Start typing to search the vault.';
      resultsList.innerHTML = '<div class="empty-state">Enter a file name to search the vault.</div>';
      return [];
    }

    const results = findMatches(trimmedQuery);

    resultsMeta.textContent = results.length === 1
      ? '1 match'
      : `${results.length} matches`;

    if (results.length === 0) {
      resultsList.innerHTML = '<div class="empty-state">No page matched that name. Check the link you were sent, or <a href="mailto:830productions@gmail.com">email the studio</a>.</div>';
      return results;
    }

    resultsList.innerHTML = results.map((item) => `
        <article class="result-card">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <span class="result-path">vault.830productions.com/${escapeHtml(item.path)}</span>
          </div>
          <a class="btn btn-primary" href="${encodeURI(item.path)}">Open page</a>
        </article>
      `).join('');

    return results;
  };

  const openPage = (path) => {
    window.location.href = encodeURI(path);
  };

  // Underline the part of the title the visitor has typed so far.
  const highlight = (title, query) => {
    const term = query.trim().split(/\s+/)[0];
    const index = term ? title.toLowerCase().indexOf(term.toLowerCase()) : -1;

    if (index < 0) {
      return escapeHtml(title);
    }

    return `${escapeHtml(title.slice(0, index))}<mark>${escapeHtml(title.slice(index, index + term.length))}</mark>${escapeHtml(title.slice(index + term.length))}`;
  };

  const setActive = (index) => {
    if (!(suggestionsList instanceof HTMLElement) || !(input instanceof HTMLInputElement)) {
      return;
    }

    activeIndex = index;

    suggestionsList.querySelectorAll('.suggestion').forEach((node, nodeIndex) => {
      node.setAttribute('aria-selected', String(nodeIndex === index));
    });

    if (index >= 0) {
      input.setAttribute('aria-activedescendant', `vault-suggestion-${index}`);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const hideSuggestions = () => {
    if (!(suggestionsList instanceof HTMLElement) || !(input instanceof HTMLInputElement)) {
      return;
    }

    suggestions = [];
    suggestionsList.hidden = true;
    suggestionsList.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  };

  const renderSuggestions = (query) => {
    if (!(suggestionsList instanceof HTMLElement) || !(input instanceof HTMLInputElement)) {
      return;
    }

    suggestions = query.trim() ? findMatches(query).slice(0, MAX_SUGGESTIONS) : [];

    if (suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    suggestionsList.innerHTML = suggestions.map((item, index) => `
        <li class="suggestion" id="vault-suggestion-${index}" role="option" aria-selected="false" data-index="${index}">
          <strong>${highlight(item.title, query)}</strong>
          <span>/${escapeHtml(item.path)}</span>
        </li>
      `).join('');

    suggestionsList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(0);
  };

  const syncQueryParam = (query) => {
    const url = new URL(window.location.href);

    if (query.trim()) {
      url.searchParams.set('q', query.trim());
    } else {
      url.searchParams.delete('q');
    }

    window.history.replaceState(null, '', url);
  };

  const loadVaultFiles = async () => {
    try {
      const response = await fetch('vault-files.json', { cache: 'no-cache' });

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

      if (document.activeElement === input) {
        renderSuggestions(input.value);
      }
    }
  };

  if (input instanceof HTMLInputElement) {
    const initialQuery = new URLSearchParams(window.location.search).get('q');

    if (initialQuery) {
      input.value = initialQuery;
    }

    input.addEventListener('input', () => {
      renderResults(input.value);
      renderSuggestions(input.value);
      syncQueryParam(input.value);
    });

    input.addEventListener('focus', () => renderSuggestions(input.value));

    input.addEventListener('keydown', (event) => {
      if (suggestions.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((activeIndex + 1) % suggestions.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((activeIndex - 1 + suggestions.length) % suggestions.length);
      } else if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        openPage(suggestions[activeIndex].path);
      } else if (event.key === 'Escape') {
        // Close the list only; keep what the visitor typed.
        event.preventDefault();
        hideSuggestions();
      }
    });

    // Close the list when focus leaves the search, but let a click on a suggestion land first.
    input.addEventListener('blur', () => window.setTimeout(hideSuggestions, 120));
  }

  if (suggestionsList instanceof HTMLElement) {
    suggestionsList.addEventListener('mousedown', (event) => {
      const option = event.target instanceof Element ? event.target.closest('.suggestion') : null;

      if (option instanceof HTMLElement) {
        event.preventDefault();
        openPage(suggestions[Number(option.dataset.index)].path);
      }
    });

    suggestionsList.addEventListener('mousemove', (event) => {
      const option = event.target instanceof Element ? event.target.closest('.suggestion') : null;

      if (option instanceof HTMLElement && Number(option.dataset.index) !== activeIndex) {
        setActive(Number(option.dataset.index));
      }
    });
  }

  if (form instanceof HTMLFormElement && input instanceof HTMLInputElement) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const results = renderResults(input.value);

      // The top match goes straight to its page.
      if (results.length > 0) {
        openPage(results[0].path);
        return;
      }

      if (resultsList instanceof HTMLElement) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        resultsList.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
      }
    });
  }

  loadVaultFiles();
})();
