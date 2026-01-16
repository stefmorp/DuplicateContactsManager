"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const scanButton = document.getElementById("scan");
  const statusEl = document.getElementById("status");

  if (!scanButton || !statusEl) {
    return;
  }

  scanButton.addEventListener("click", async () => {
    // Open the main window
    browser.runtime.sendMessage({ action: "openWindow" });
    window.close();
  });
});


