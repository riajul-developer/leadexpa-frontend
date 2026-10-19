import type * as SonnerModule from "sonner";

type Sonner = typeof SonnerModule;
type Toast = Sonner["toast"];

let sonner: Promise<Sonner> | undefined;
const load = () => (sonner ??= import("sonner"));

function method<K extends "success" | "error" | "info" | "warning">(kind: K) {
  return (...args: Parameters<Toast[K]>) => {
    void load().then((m) => (m.toast[kind] as (...a: Parameters<Toast[K]>) => unknown)(...args));
  };
}

export const toast = {
  success: method("success"),
  error: method("error"),
  info: method("info"),
  warning: method("warning"),
};
