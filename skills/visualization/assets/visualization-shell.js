(() => {
  const root = document.documentElement;
  const shell = document.querySelector("[data-viz-shell]");
  if (!shell) return;

  const storageKey = "visualization-theme";
  const themeButtons = [...document.querySelectorAll("[data-viz-theme-value]")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const themeIcons = {
    auto: `<svg class="viz-theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.25"/><path class="viz-theme-icon__fill" d="M12 3.75a8.25 8.25 0 0 0 0 16.5z"/></svg>`,
    light: `<svg class="viz-theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.46 5.46l1.42 1.42M17.12 17.12l1.42 1.42M18.54 5.46l-1.42 1.42M6.88 17.12l-1.42 1.42"/></svg>`,
    dark: `<svg class="viz-theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.25 14.35A8.5 8.5 0 0 1 9.65 3.75 8.5 8.5 0 1 0 20.25 14.35Z"/></svg>`,
  };

  themeButtons.forEach((button) => {
    const value = button.dataset.vizThemeValue;
    const label = button.getAttribute("aria-label") || button.textContent.trim();
    button.setAttribute("aria-label", label);
    button.title ||= label;
    if (themeIcons[value]) button.innerHTML = themeIcons[value];
  });

  function readTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function writeTheme(theme) {
    try {
      if (theme === "auto") localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, theme);
    } catch {
      // Theme switching still works when storage is unavailable.
    }
  }

  function setTheme(theme) {
    const next = theme === "light" || theme === "dark" ? theme : "auto";
    root.dataset.vizTheme = next;
    writeTheme(next);
    themeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.vizThemeValue === next));
      button.closest(".viz-segmented").dataset.vizThemeCurrent = next;
    });
    window.dispatchEvent(new CustomEvent("viz-themechange", { detail: { theme: next } }));
  }

  function selectTheme(theme) {
    if (!document.startViewTransition || reduceMotion.matches) {
      setTheme(theme);
      return;
    }
    document.startViewTransition(() => setTheme(theme));
  }

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => selectTheme(button.dataset.vizThemeValue));
  });
  setTheme(readTheme());

  const menu = shell.querySelector("[data-viz-menu]");
  const menuToggle = shell.querySelector("[data-viz-menu-toggle]");
  const menuPanel = shell.querySelector("[data-viz-menu-panel]");
  const menuDismissers = [...shell.querySelectorAll("[data-viz-menu-dismiss]")];
  const menuClose = menuPanel?.querySelector("[data-viz-menu-dismiss]");
  const main = shell.querySelector(".viz-main");
  const mobileMenu = window.matchMedia("(max-width: 59.99rem)");
  let menuReturnFocus = null;

  function menuFocusables() {
    if (!menuPanel) return [];
    return [
      ...menuPanel.querySelectorAll(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ].filter((element) => !element.hidden);
  }

  function setMenu(open, restoreFocus = false) {
    if (!menu || !menuToggle || !menuPanel) return;
    const next = mobileMenu.matches && Boolean(open);
    if (next) menuReturnFocus = menuToggle;
    menu.dataset.open = String(next);
    menuToggle.setAttribute("aria-expanded", String(next));
    if (mobileMenu.matches) {
      menuPanel.setAttribute("aria-hidden", String(!next));
      menuPanel.toggleAttribute("aria-modal", next);
      if (next) menuPanel.setAttribute("role", "dialog");
      else menuPanel.removeAttribute("role");
    } else {
      menuPanel.removeAttribute("aria-hidden");
      menuPanel.removeAttribute("aria-modal");
      menuPanel.removeAttribute("role");
    }
    document.body.classList.toggle("viz-menu-open", next);
    if (main) main.inert = next;
    if (next) requestAnimationFrame(() => menuClose?.focus());
    if (!next && restoreFocus) (menuReturnFocus || menuToggle).focus();
  }

  menuToggle?.addEventListener("click", () => setMenu(menu?.dataset.open !== "true"));
  menuDismissers.forEach((control) => {
    control.addEventListener("click", () => setMenu(false, true));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu?.dataset.open === "true") setMenu(false, true);
    if (event.key !== "Tab" || menu?.dataset.open !== "true") return;
    const focusables = menuFocusables();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  mobileMenu.addEventListener("change", () => setMenu(false));
  setMenu(false);

  const navLinks = [...shell.querySelectorAll("[data-viz-nav] a[href^='#']")];
  const sections = navLinks
    .map((link) => document.querySelector(link.hash))
    .filter(Boolean);
  const mode = shell.dataset.vizNavigation || "switcher";

  function knownHash(hash) {
    return navLinks.some((link) => link.hash === hash) ? hash : navLinks[0]?.hash;
  }

  function select(hash, options = {}) {
    const activeHash = knownHash(hash);
    if (!activeHash) return;

    navLinks.forEach((link) => {
      if (link.hash === activeHash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });

    if (mode === "switcher") {
      sections.forEach((section) => {
        const active = `#${section.id}` === activeHash;
        section.hidden = !active;
        section.setAttribute("aria-hidden", String(!active));
      });
    }
    if (options.focus) {
      const section = document.querySelector(activeHash);
      if (section && !section.hasAttribute("tabindex")) section.tabIndex = -1;
      section?.focus({ preventScroll: true });
    }
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setMenu(false);
      select(link.hash, { focus: mode === "switcher" || mobileMenu.matches });
    });
  });

  window.addEventListener("hashchange", () => select(location.hash, { focus: mode === "switcher" }));
  select(location.hash);

  if (mode === "sidebar" && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        select(atEnd ? navLinks.at(-1)?.hash : `#${visible.target.id}`);
      },
      { rootMargin: "-12% 0px -72% 0px", threshold: [0, 0.25, 0.6] },
    );
    sections.forEach((section) => observer.observe(section));
  }
})();
