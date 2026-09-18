// visualization-shell revision 4
const root = document.documentElement;
const diagrams = [...document.querySelectorAll("[data-viz-mermaid]")];
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
const compactState = new WeakMap();
// Natural width of each rendered SVG. Fixed until the next render, so it is parsed once.
const naturalWidths = new WeakMap();
// A diagram slightly wider than its container is fitted instead of scrolled, but only while its
// 13px labels stay at or above 11px, the smallest text size the visual system uses anywhere.
// Anything wider keeps its natural size and scrolls locally.
const MAX_FIT_OVERFLOW = 1.18;
const mermaidModule = import("https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.esm.min.mjs");
const renderStage = document.createElement("div");
let renderVersion = 0;
let scheduled = false;
let initialPositioned = false;
const revealTimeout = window.setTimeout(() => finishInitialPositioning(), 5000);

renderStage.className = "viz-mermaid__stage";
renderStage.setAttribute("aria-hidden", "true");
if (diagrams.length) document.body.append(renderStage);

const roleThemeCss = `
  .node.external rect, .node.external polygon, .node.external path {
    fill: var(--viz-external-bg) !important;
    stroke: var(--viz-external-line) !important;
  }
  .node.system rect, .node.system polygon, .node.system path {
    fill: var(--viz-system-bg) !important;
    stroke: var(--viz-system-line) !important;
  }
  .node.interface rect, .node.interface polygon, .node.interface path {
    fill: var(--viz-interface-bg) !important;
    stroke: var(--viz-interface-line) !important;
  }
  .node.domain rect, .node.domain polygon, .node.domain path {
    fill: var(--viz-domain-bg) !important;
    stroke: var(--viz-domain-line) !important;
  }
  .node.data rect, .node.data polygon, .node.data path {
    fill: var(--viz-data-bg) !important;
    stroke: var(--viz-data-line) !important;
  }
  .node.risk rect, .node.risk polygon, .node.risk path {
    fill: var(--viz-risk-bg) !important;
    stroke: var(--viz-risk-line) !important;
  }
`;

function token(name) {
  return getComputedStyle(root).getPropertyValue(`--viz-${name}`).trim();
}

function effectiveTheme() {
  const selected = root.dataset.vizTheme;
  if (selected === "dark" || selected === "light") return selected;
  return prefersDark.matches ? "dark" : "light";
}

function themeVariables() {
  return {
    darkMode: effectiveTheme() === "dark",
    background: token("bg"),
    primaryColor: token("surface-subtle"),
    primaryTextColor: token("text"),
    primaryBorderColor: token("border-strong"),
    secondaryColor: token("system-bg"),
    secondaryTextColor: token("text"),
    secondaryBorderColor: token("system-line"),
    tertiaryColor: token("domain-bg"),
    tertiaryTextColor: token("text"),
    tertiaryBorderColor: token("domain-line"),
    lineColor: token("border-strong"),
    textColor: token("text"),
    mainBkg: token("surface-subtle"),
    nodeBorder: token("border-strong"),
    clusterBkg: token("surface"),
    clusterBorder: token("border"),
    edgeLabelBackground: token("surface"),
    actorBkg: token("surface-subtle"),
    actorBorder: token("border-strong"),
    actorTextColor: token("text"),
    actorLineColor: token("border"),
    signalColor: token("border-strong"),
    signalTextColor: token("text"),
    labelBoxBkgColor: token("surface"),
    labelBoxBorderColor: token("border"),
    labelTextColor: token("text"),
    noteBkgColor: token("data-bg"),
    noteBorderColor: token("data-line"),
    noteTextColor: token("text"),
    fontFamily: getComputedStyle(document.body).fontFamily,
  };
}

function compactBreakpoint(diagram) {
  const configured = Number(diagram.dataset.vizCompactAt);
  return Number.isFinite(configured) && configured > 0 ? configured : 720;
}

function isCompact(diagram) {
  const width = diagram.getBoundingClientRect().width;
  return width > 0 && width <= compactBreakpoint(diagram);
}

function sourceForContainer(diagram, source) {
  const compactDirection = diagram.dataset.vizCompactDirection;
  if (!compactDirection || !isCompact(diagram)) return source;

  if (/^flowchart\s+(TB|TD|BT|RL|LR)/m.test(source)) {
    return source.replace(/^flowchart\s+(TB|TD|BT|RL|LR)/m, `flowchart ${compactDirection}`);
  }

  if (/^\s*direction\s+(TB|TD|BT|RL|LR)/m.test(source)) {
    return source.replace(
      /^\s*direction\s+(TB|TD|BT|RL|LR)/m,
      `  direction ${compactDirection}`,
    );
  }

  return source;
}

function finishInitialPositioning() {
  if (initialPositioned) return;
  initialPositioned = true;
  window.clearTimeout(revealTimeout);
  let target = null;
  try {
    target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  } catch {
    target = null;
  }
  requestAnimationFrame(() => {
    target?.scrollIntoView({ block: "start" });
    requestAnimationFrame(() => root.removeAttribute("data-viz-mermaid-loading"));
  });
}

function sourceDescription(source) {
  return source?.match(/^\s*accDescr:\s*(.+)$/m)?.[1]?.trim();
}

function showRenderFailure(diagram, error, source) {
  const output = diagram.querySelector("[data-viz-mermaid-output]");
  if (!output) return;
  const title = document.createElement("strong");
  const description = document.createElement("p");
  const technical = document.createElement("small");
  title.textContent = "Diagram unavailable";
  description.textContent =
    sourceDescription(source) ||
    "The diagram could not be rendered. Use the adjacent textual equivalent or inspect its Mermaid source.";
  technical.textContent = error instanceof Error ? error.message : String(error);
  output.replaceChildren(title, description, technical);
  diagram.dataset.vizRenderError = "true";
}

function naturalWidthOf(svg) {
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/).map(Number);
  return viewBox?.[2] ? Math.ceil(viewBox[2]) : null;
}

// Fit or scroll is decided from the live container width, so it stays right when the container
// is resized or revealed without crossing the compact breakpoint (the only resize that re-renders).
// Reading and writing are separate passes: a style write between layout reads forces a reflow
// per diagram on every resize tick.
function readFit(diagram) {
  const output = diagram.querySelector("[data-viz-mermaid-output]");
  if (!output) return null;
  const rendered = output.querySelector("svg");
  const naturalWidth = rendered ? naturalWidths.get(rendered) : null;
  const available = output.clientWidth;
  if (!naturalWidth) return { output, scrolls: output.scrollWidth > available + 1 };
  const fits = available > 0 && naturalWidth <= available * MAX_FIT_OVERFLOW;
  return { output, rendered, fits, scrolls: available > 0 && !fits };
}

function writeFit({ output, rendered, fits, scrolls }) {
  if (rendered) rendered.style.maxWidth = fits ? "100%" : "none";
  output.dataset.vizHorizontalScroll = String(scrolls);
}

function updateFit(targets) {
  targets.map(readFit).forEach((fit) => fit && writeFit(fit));
}

function renderFailure(error) {
  diagrams.forEach((diagram) => {
    const source = diagram.querySelector('script[type="text/plain"]')?.textContent.trim();
    showRenderFailure(diagram, error, source);
  });
  finishInitialPositioning();
}

async function renderAll() {
  const version = ++renderVersion;
  const { default: mermaid } = await mermaidModule;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    look: "classic",
    layout: "elk",
    themeCSS: roleThemeCss,
    themeVariables: themeVariables(),
    flowchart: { htmlLabels: false, useMaxWidth: false },
  });

  const results = await Promise.all(
    diagrams.map(async (diagram, index) => {
      const canonicalSource = diagram
        .querySelector('script[type="text/plain"]')
        ?.textContent.trim();
      const output = diagram.querySelector("[data-viz-mermaid-output]");
      if (!canonicalSource || !output) return null;
      // Record the compact state this render used, so a host that resizes between the first
      // render and the first ResizeObserver callback still triggers a re-render.
      compactState.set(diagram, isCompact(diagram));
      const source = sourceForContainer(diagram, canonicalSource);

      try {
        const { svg, bindFunctions } = await mermaid.render(
          `viz-mermaid-${version}-${index}`,
          source,
          renderStage,
        );
        return { diagram, output, svg, bindFunctions };
      } catch (error) {
        return { diagram, output, error, source };
      }
    }),
  );

  if (version !== renderVersion) return;
  results.forEach((result) => {
    if (!result) return;
    const { diagram, output, error, source, svg, bindFunctions } = result;
    if (error) {
      showRenderFailure(diagram, error, source);
      return;
    }

    output.innerHTML = svg;
    const rendered = output.querySelector("svg");
    rendered?.classList.add("viz-diagram");
    rendered?.removeAttribute("height");
    if (rendered) {
      const naturalWidth = naturalWidthOf(rendered);
      naturalWidths.set(rendered, naturalWidth);
      if (
        (!rendered.getAttribute("width") || rendered.getAttribute("width") === "100%") &&
        naturalWidth
      ) {
        rendered.setAttribute("width", String(naturalWidth));
      }
      rendered.style.backgroundColor = "transparent";
    }
    bindFunctions?.(output);
    diagram.removeAttribute("data-viz-render-error");
  });

  updateFit(diagrams);
  finishInitialPositioning();
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderAll().catch(renderFailure);
  });
}

window.addEventListener("viz-themechange", scheduleRender);
prefersDark.addEventListener("change", () => {
  if (root.dataset.vizTheme === "auto") scheduleRender();
});

if ("ResizeObserver" in window) {
  const observer = new ResizeObserver((entries) => {
    let crossedBreakpoint = false;
    entries.forEach((entry) => {
      const previous = compactState.get(entry.target);
      const next = isCompact(entry.target);
      compactState.set(entry.target, next);
      if (previous !== undefined && previous !== next) crossedBreakpoint = true;
    });
    updateFit(entries.map((entry) => entry.target));
    if (crossedBreakpoint) scheduleRender();
  });
  diagrams.forEach((diagram) => observer.observe(diagram));
}

renderAll().catch(renderFailure);
