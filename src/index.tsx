/* @refresh reload */
import { render } from "solid-js/web";
import "./styles.css";
import App from "./App";
import { initServerUrl } from "./lib/server";
import { addNotification } from "./lib/notifications/store";
import { startServerHealthCheck } from "./lib/ws";

// Global error handlers
window.onerror = (_message, _source, _lineno, _colno, error) => {
  const msg = error?.message ?? (typeof _message === "string" ? _message : "An unknown error occurred");
  console.error("[bord] uncaught error:", error ?? _message);
  addNotification({
    type: "error",
    terminalId: "__system__",
    workspaceId: "__system__",
    title: "Unexpected error",
    body: msg.slice(0, 200),
    isActiveTerminal: false,
    isAppFocused: document.hasFocus(),
  });
};

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("[bord] unhandled rejection:", reason);
  addNotification({
    type: "error",
    terminalId: "__system__",
    workspaceId: "__system__",
    title: "Unhandled promise rejection",
    body: msg.slice(0, 200),
    isActiveTerminal: false,
    isAppFocused: document.hasFocus(),
  });
});

initServerUrl().then(() => {
  startServerHealthCheck();
  render(() => <App />, document.getElementById("root")!);
});
