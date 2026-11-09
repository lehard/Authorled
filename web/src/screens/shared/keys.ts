// Key labels in the writing of the author's system (openspec/specs/web/workspace,
// «Подсказка клавиш в поле чата»): macOS by `navigator.platform`, decided once at load.
export const isMac = navigator.platform.startsWith("Mac");

export const newLineKey = isMac ? "⇧↵" : "Shift+Enter";
export const sendKey = isMac ? "↵" : "Enter";
