/** Close the software keyboard before disabling a form or leaving its page. */
export function blurActiveEditable() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable='true']")) {
    active.blur();
  }
}
