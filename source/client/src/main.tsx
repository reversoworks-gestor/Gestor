import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function installZoomLock() {
  const preventDefault = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };

  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey || event.metaKey) preventDefault(event);
    },
    { capture: true, passive: false },
  );

  document.addEventListener(
    "keydown",
    (event) => {
      const isZoomShortcut =
        (event.ctrlKey || event.metaKey) &&
        ["+", "-", "=", "0", "Add", "Subtract"].includes(event.key);

      if (isZoomShortcut) preventDefault(event);
    },
    { capture: true },
  );

  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    document.addEventListener(eventName, preventDefault, { capture: true, passive: false });
  });

  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) preventDefault(event);
    },
    { capture: true, passive: false },
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300) preventDefault(event);
      lastTouchEnd = now;
    },
    { capture: true, passive: false },
  );

  document.addEventListener("dblclick", preventDefault, { capture: true, passive: false });
}

installZoomLock();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
