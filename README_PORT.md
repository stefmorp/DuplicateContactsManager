# Port to TB128+ - Status and Instructions

## Current Status

This branch (`Port_to_TB128`) contains a minimal port of the Duplicate Contacts Manager from Thunderbird 68 (XUL/XPCOM) to Thunderbird 128+ (WebExtension).

## What's Been Done

1. **Manifest** (`manifest.json`) - Created WebExtension manifest with required permissions
2. **Background Script** (`background.js`) - Window management and menu integration
3. **Window Logic** (`window/window.js`) - Started porting core logic with initialization
4. **Documentation** - Created porting notes and guides

## What Still Needs to Be Done

The original `duplicateEntriesWindow.js` is ~1700 lines. To complete the port, the following functions need to be ported:

### Critical Functions (Core Logic - Preserve Exactly)
- All matching functions (`namesMatch`, `mailsMatch`, `phonesMatch`, etc.)
- All abstraction functions (`abstract`, `simplifyText`, `getPrunedProperty`, etc.)
- Comparison functions (`abCardsCompare`, `SetRelation`, etc.)

### API Replacement Functions (Need WebExtension API)
- `readAddressBooks()` - Replace `getAllAbCards()` with `browser.contacts.list()`
- `getAllAbCards()` - Port to async contact loading
- `getProperty()` - Adapt to direct property access
- `updateAbCard()` - Use `browser.contacts.update()`
- `deleteAbCard()` - Use `browser.contacts.delete()`

### UI Functions (XUL → HTML)
- `displayCardData()` - Convert XUL elements to HTML
- `displayCardField()` - Convert XUL textbox/menulist to HTML input/select
- `createSelectionList()` - Already started (HTML select instead of XUL menulist)
- `purgeAttributesTable()` - Adapt for HTML table
- `getCardFieldValues()` - Adapt for HTML inputs

### Search and Navigation
- `startSearch()` - Port async address book loading
- `searchNextDuplicate()` - Preserve logic, adapt async
- `searchDuplicateIntervalAction()` - Preserve exactly
- `skipPositionsToNext()` - Preserve exactly
- `searchPositionsToNext()` - Preserve exactly

## Approach

1. **Preserve Core Logic**: All duplicate detection, matching, and comparison algorithms are preserved exactly
2. **Replace APIs Only**: Only replace XPCOM/nsIAbManager calls with WebExtension APIs
3. **Convert UI**: Convert XUL to HTML, maintaining same structure and behavior
4. **Document Changes**: All porting changes are marked with `// PORT:` comments

## Next Steps

1. Complete `window/window.js` with all functions from original
2. Create `window/window.html` (convert from XUL)
3. Create `window/window.css` (adapt from original CSS)
4. Create `popup/popup.html` and `popup/popup.js`
5. Test with Thunderbird 128+

## Files to Reference

- **Original Code**: `chrome/content/duplicateEntriesWindow.js` (1700 lines)
- **Original UI**: `chrome/content/duplicateEntriesWindow.xul`
- **Original CSS**: `skin/classic/duplicateContactsManager.css`
- **Porting Guide**: `PORTING_GUIDE.md`
- **Porting Notes**: `PORTING_NOTES.md`

## Key Porting Principles

1. **Minimal Changes**: Only change what's necessary for WebExtension API
2. **Preserve Functionality**: All original features must work the same
3. **Well Documented**: Every change is commented with `// PORT:` and explanation
4. **Clean Code**: Maintain original code structure and style where possible
