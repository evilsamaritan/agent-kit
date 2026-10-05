// visualization-shell revision 5
// Select precompiled SVG variants; source compilation stays in the project's build.
const root = document.documentElement;
const figures = [...document.querySelectorAll("[data-viz-diagram]")];
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
const failed = new WeakSet();
const MAX_FIT_OVERFLOW = 1.18;
let scheduled = false;

function effectiveTheme() {
  const theme = root.dataset.vizTheme;
  return theme === "light" || theme === "dark" ? theme : prefersDark.matches ? "dark" : "light";
}

function readVariant(figure) {
  const images = [...figure.querySelectorAll("img[data-viz-diagram-theme]")];
  const output = figure.querySelector("[data-viz-diagram-output]");
  const breakpoint = Number(figure.dataset.vizCompactAt) || 720;
  const compact = figure.getBoundingClientRect().width <= breakpoint;
  const theme = effectiveTheme();
  const view = compact && images.some((img) => img.dataset.vizDiagramView === "compact") ? "compact" : "wide";
  const image = images.find((img) => img.dataset.vizDiagramTheme === theme && (img.dataset.vizDiagramView || "wide") === view);
  const width = image?.naturalWidth || Number(image?.getAttribute("width"));
  const available = output?.clientWidth || 0;
  return { figure, output, images, image, fits: width > 0 && available > 0 && width <= available * MAX_FIT_OVERFLOW };
}

function writeVariant({ figure, output, images, image, fits }) {
  if (!output) return;
  const unavailable = !image || failed.has(image) || (image.complete && !image.naturalWidth);
  for (const candidate of images) candidate.hidden = candidate !== image || unavailable;
  if (image) image.style.maxWidth = fits ? "100%" : "none";
  output.dataset.vizHorizontalScroll = String(!unavailable && !fits);
  figure.dataset.vizRenderError = String(unavailable);
  let error = figure.querySelector(".viz-compiled__error");
  if (unavailable && !error) {
    error = document.createElement("p");
    error.className = "viz-compiled__error";
    error.setAttribute("role", "status");
    error.textContent = "Diagram unavailable. Use the description and linked source below.";
    output.append(error);
  }
  if (error) error.hidden = !unavailable;
}

function refresh() {
  scheduled = false;
  // Read every container before changing image visibility or dimensions.
  figures.map(readVariant).forEach(writeVariant);
}

function scheduleRefresh() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(refresh);
}

for (const figure of figures) {
  for (const image of figure.querySelectorAll("img[data-viz-diagram-theme]")) {
    image.addEventListener("load", () => { failed.delete(image); scheduleRefresh(); });
    image.addEventListener("error", () => { failed.add(image); scheduleRefresh(); });
  }
}
new MutationObserver(scheduleRefresh).observe(root, { attributes: true, attributeFilter: ["data-viz-theme"] });
prefersDark.addEventListener("change", scheduleRefresh);
if ("ResizeObserver" in window) {
  const observer = new ResizeObserver(scheduleRefresh);
  figures.forEach((figure) => observer.observe(figure));
} else {
  window.addEventListener("resize", scheduleRefresh);
}
refresh();
