export const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let _invoke: typeof import("@tauri-apps/api/core").invoke;
export async function getInvoke() {
  if (!_invoke) {
    _invoke = (await import("@tauri-apps/api/core")).invoke;
  }
  return _invoke;
}
