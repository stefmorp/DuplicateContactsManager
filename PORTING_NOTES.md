# Porting Notes: Duplicate Contacts Manager to Thunderbird 128+

This document describes the minimal changes made to port the original XUL/XPCOM extension to Thunderbird 128+ WebExtension API.

## Overview

The original extension was built for Thunderbird 68 using:
- **XUL** for UI
- **XPCOM** for address book access (`nsIAbManager`, `nsIAbCard`, `nsIAbDirectory`)
- **nsIPrefService** for preferences

The port to TB128+ uses:
- **HTML/CSS** for UI (replacing XUL)
- **WebExtension APIs** (`browser.addressBooks`, `browser.contacts`) for address book access
- **browser.storage** for preferences (replacing nsIPrefService)

## Key Changes

### 1. Manifest (`manifest.json`)
- **Changed**: From legacy `install.rdf` + `chrome.manifest` to WebExtension `manifest.json`
- **Added**: Required permissions (`addressBooks`, `contacts`, `storage`)
- **Added**: Background script for window management
- **Note**: Uses experimental `windowManager` API for opening windows (standard in TB128+)

### 2. Address Book Access
- **Original**: `Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager)`
- **Port**: `browser.addressBooks.list()` and `browser.contacts.list()`
- **Impact**: Async API requires callback-based code instead of synchronous access

### 3. Contact Properties
- **Original**: `card.getProperty(property, defaultValue)` and `card.setProperty(property, value)`
- **Port**: Contact objects have properties directly accessible (e.g., `contact.PrimaryEmail`)
- **Note**: Some property names may differ; mapping maintained in code

### 4. Preferences/Storage
- **Original**: `Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService)`
- **Port**: `browser.storage.local.get()` and `browser.storage.local.set()`
- **Note**: Preferences stored under `extensions.DuplicateContactsManager.*` prefix maintained

### 5. UI (XUL → HTML)
- **Original**: XUL elements (`<window>`, `<hbox>`, `<vbox>`, `<textbox>`, etc.)
- **Port**: Standard HTML elements (`<div>`, `<input>`, `<button>`, etc.)
- **CSS**: Minimal changes to work with HTML instead of XUL

### 6. Window Management
- **Original**: `window.open('chrome://...', ...)` for XUL windows
- **Port**: `browser.windows.create()` with HTML file
- **Note**: Uses experimental windowManager API for proper window handling

## Preserved Functionality

All core duplicate detection logic is preserved:
- Name matching (with normalization)
- Email matching
- Phone number matching
- Field abstraction and comparison
- Auto-removal logic
- Manual review interface
- Statistics tracking

## Files Structure

```
manifest.json              # WebExtension manifest
background.js             # Background script (window management)
lib/
  duplicateFinder.js      # Core duplicate detection logic (minimal changes)
window/
  window.html             # Main UI (converted from XUL)
  window.css              # Styles (adapted from original)
  window.js               # Window logic (ported from duplicateEntriesWindow.js)
popup/
  popup.html              # Toolbar popup
  popup.js                # Popup logic
```

## Code Comments

All porting-related changes are documented with comments prefixed with:
- `// PORT: ` - Indicates a change made for the port
- `// ORIGINAL: ` - References original implementation
- `// TODO: ` - Areas that may need further refinement

## Testing

This port maintains the same functionality as the original. Test with:
- Multiple address books
- CardDAV-synced address books
- Large address books (1000+ contacts)
- Various duplicate scenarios (name, email, phone matches)
