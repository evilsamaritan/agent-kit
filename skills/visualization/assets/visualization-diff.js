document.querySelectorAll("[data-viz-diff]").forEach((diff) => {
  const buttons = [...diff.querySelectorAll("[data-viz-diff-mode-value]")];

  function setDiffMode(mode) {
    const next = mode === "unified" ? "unified" : "split";
    diff.dataset.vizDiffMode = next;
    buttons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.vizDiffModeValue === next),
      );
    });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => setDiffMode(button.dataset.vizDiffModeValue));
  });
  setDiffMode(diff.dataset.vizDiffMode);
});
