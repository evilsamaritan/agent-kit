// visualization-shell revision 4
const regions = [...document.querySelectorAll("[data-viz-code]")];

if (regions.length) {
  const highlighterModule = import(
    "https://cdn.jsdelivr.net/npm/highlight.js@11.12.0/+esm"
  );

  function highlightSource(hljs, source, language) {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(source, { language, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(source).value;
  }

  function highlightRegion(hljs, region) {
    const language = region.dataset.vizLanguage?.trim().toLowerCase();
    const lines = [...region.querySelectorAll(".viz-code__line")];

    if (!lines.length) {
      const code = region.querySelector("pre code");
      if (!code) return;
      code.innerHTML = highlightSource(hljs, code.textContent, language);
      region.dataset.vizCodeStatus = "highlighted";
      return;
    }

    lines.forEach((line) => {
      const content = line.querySelector(":scope > span");
      if (!content || line.classList.contains("viz-code__line--empty")) return;
      if (content.querySelector(":scope > .viz-token--comment")) return;

      const sign = content.querySelector(":scope > .viz-diff-sign");
      const source = sign
        ? content.textContent.slice(sign.textContent.length)
        : content.textContent;
      const prefix = sign?.outerHTML || "";
      content.innerHTML = `${prefix}${highlightSource(hljs, source, language)}`;
    });

    region.dataset.vizCodeStatus = "highlighted";
  }

  highlighterModule
    .then((module) => {
      const hljs = module.default || module;
      regions.forEach((region) => highlightRegion(hljs, region));
      window.dispatchEvent(new CustomEvent("viz-codehighlight"));
    })
    .catch(() => {
      regions.forEach((region) => {
        region.dataset.vizCodeStatus = "fallback";
      });
    });
}
