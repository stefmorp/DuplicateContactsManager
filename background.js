"use strict";

/**
 * Background script for Duplicate Contacts Manager
 * Ported from Thunderbird 68 to Thunderbird 128+
 */

let windowId = null;

// Open the main window when the add-on is installed or updated
browser.runtime.onInstalled.addListener(async (details) => {
  console.log("Duplicate Contacts Manager installed:", details.reason);
});

// Handle toolbar button click - popup will handle it, but also support direct clicks
browser.browserAction.onClicked.addListener(async () => {
  // If popup is set, this won't fire, but keep it for compatibility
});

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openWindow") {
    openMainWindow();
  }
  return true;
});

// Open the main duplicate contacts manager window
async function openMainWindow() {
  try {
    // Check if window already exists
    if (windowId) {
      try {
        const window = await browser.windows.get(windowId);
        await browser.windows.update(windowId, { focused: true });
        return;
      } catch (e) {
        // Window doesn't exist anymore, create a new one
        windowId = null;
      }
    }

    // Create new window (Thunderbird/Firefox do not support a 'focused' property here)
    const window = await browser.windows.create({
      url: browser.runtime.getURL("window/window.html"),
      type: "popup",
      width: 1000,
      height: 700
    });

    windowId = window.id;

    // Clean up windowId when window is closed
    browser.windows.onRemoved.addListener((id) => {
      if (id === windowId) {
        windowId = null;
      }
    });
  } catch (error) {
    console.error("Error opening main window:", error);
  }
}

// Also add menu item under Tools menu
browser.menus.create({
  id: "duplicate-contacts-manager",
  title: "Duplicate Contacts Manager...",
  contexts: ["tools_menu"]
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "duplicate-contacts-manager") {
    await openMainWindow();
  }
});


