// Gallery-only comparison: a project still chooses one authoritative source format.
(() => {
  const initial = new URL(location.href).searchParams.get('renderer');
  for (const control of document.querySelectorAll('[data-viz-preview-controls]')) {
    const section = control.closest('section');
    const buttons = [...control.querySelectorAll('[data-viz-preview-renderer]')];
    const views = [...section.querySelectorAll('[data-viz-preview-source]')];
    const key = `agent-kit-preview:${section.id}`;
    function select(value, persist = false) {
      const renderer = value === 'd2' ? 'd2' : 'mermaid';
      section.dataset.vizPreviewRenderer = renderer;
      for (const view of views) view.hidden = view.dataset.vizPreviewSource !== renderer;
      for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.vizPreviewRenderer === renderer));
      if (persist) {
        try { sessionStorage.setItem(key, renderer); } catch {}
      }
    }
    for (const button of buttons) button.addEventListener('click', () => select(button.dataset.vizPreviewRenderer, true));
    let saved = null;
    try { saved = sessionStorage.getItem(key); } catch {}
    select(saved || initial);
  }
  const url = new URL(location.href);
  url.searchParams.delete('renderer');
  history.replaceState(history.state, '', url);
})();
