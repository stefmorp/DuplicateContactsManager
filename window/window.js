"use strict";

/**
 * Main window script for Duplicate Contacts Manager
 * Ported from Thunderbird 68 to Thunderbird 128+
 */

// Import the DuplicateFinder class (we'll load it via script tag)
let finder = null;

// State
let addressBooks = [];
let contacts = [[], []]; // Two arrays for two address books
let simplifiedContacts = [[], []];
let currentPair = [0, 0];
let duplicates = [];
let duplicateIndex = 0;
let isSearching = false;
let shouldStop = false;

// Statistics
let stats = {
  totalBefore: 0,
  totalChanged: 0,
  totalSkipped: 0,
  totalDeleted1: 0,
  totalDeleted2: 0,
  totalDeletedAuto: 0
};

// UI Elements
let elements = {};

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize finder
  finder = new DuplicateFinder();
  await finder.loadPreferences();
  
  // Get all UI elements
  elements = {
    explanation: document.getElementById("explanation"),
    addressbook1: document.getElementById("addressbook1"),
    addressbook2: document.getElementById("addressbook2"),
    autoremove: document.getElementById("autoremove"),
    preservefirst: document.getElementById("preservefirst"),
    startbutton: document.getElementById("startbutton"),
    quitbutton: document.getElementById("quitbutton"),
    progressSection: document.getElementById("progress-section"),
    statusText: document.getElementById("statusText"),
    progressText: document.getElementById("progressText"),
    progressMeter: document.getElementById("progressMeter"),
    statusAddressBook1: document.getElementById("statusAddressBook1"),
    statusAddressBook2: document.getElementById("statusAddressBook2"),
    statusAddressBook1Label: document.getElementById("statusAddressBook1_label"),
    statusAddressBook1Size: document.getElementById("statusAddressBook1_size"),
    statusAddressBook2Label: document.getElementById("statusAddressBook2_label"),
    statusAddressBook2Size: document.getElementById("statusAddressBook2_size"),
    stopbutton: document.getElementById("stopbutton"),
    tablepane: document.getElementById("tablepane"),
    tableheader: document.getElementById("tableheader"),
    headerLeft: document.getElementById("headerLeft"),
    headerRight: document.getElementById("headerRight"),
    keepLeftRadio: document.getElementById("keepLeft"),
    keepRightRadio: document.getElementById("keepRight"),
    AttributesTableRows: document.getElementById("AttributesTableRows"),
    skipnextbutton: document.getElementById("skipnextbutton"),
    mergebutton: document.getElementById("mergebutton"),
    backbutton: document.getElementById("backbutton"),
    closebutton: document.getElementById("closebutton"),
    applynextbutton: document.getElementById("applynextbutton"),
    endinfo: document.getElementById("endinfo"),
    resultNumBefore: document.getElementById("resultNumBefore"),
    resultNumAfter: document.getElementById("resultNumAfter"),
    resultNumRemovedMan: document.getElementById("resultNumRemovedMan"),
    resultNumRemovedAuto: document.getElementById("resultNumRemovedAuto"),
    resultNumChanged: document.getElementById("resultNumChanged"),
    resultNumSkipped: document.getElementById("resultNumSkipped"),
    restartbutton: document.getElementById("restartbutton")
  };

  // Set initial checkbox states from preferences
  elements.autoremove.checked = finder.autoremoveDups;
  elements.preservefirst.checked = finder.preserveFirst;
  // deferInteractive is always true - always collect all duplicates before showing
  finder.deferInteractive = true;

  // Load address books
  await loadAddressBooks();

  // Event listeners
  elements.startbutton.addEventListener("click", startSearch);
  elements.quitbutton.addEventListener("click", () => window.close());
  elements.stopbutton.addEventListener("click", () => { shouldStop = true; });
  elements.skipnextbutton.addEventListener("click", skipAndSearchNext);
  elements.mergebutton.addEventListener("click", mergeAndSearchNext);
  elements.backbutton.addEventListener("click", goToPreviousDuplicate);
  elements.applynextbutton.addEventListener("click", applyAndSearchNext);
  elements.closebutton.addEventListener("click", () => {
    endSearch();
  });
  elements.restartbutton.addEventListener("click", () => {
    location.reload();
  });
});

async function loadAddressBooks() {
  try {
    const books = await browser.addressBooks.list();
    addressBooks = books;
    
    // Populate dropdowns
    elements.addressbook1.innerHTML = "";
    elements.addressbook2.innerHTML = "";
    
    if (books.length === 0) {
      elements.statusText.textContent = "Warning: No address books found. Make sure Thunderbird is running with the correct profile.";
      elements.statusText.className = "status-text error-message";
      return;
    }
    
    books.forEach(book => {
      const option1 = document.createElement("option");
      option1.value = book.id;
      option1.textContent = book.name;
      elements.addressbook1.appendChild(option1);
      
      const option2 = document.createElement("option");
      option2.value = book.id;
      option2.textContent = book.name;
      elements.addressbook2.appendChild(option2);
    });
    
    // Select first address book in both dropdowns
    if (books.length > 0) {
      elements.addressbook1.value = books[0].id;
      elements.addressbook2.value = books[0].id;
      
      // Show profile info message
      const profileInfo = document.getElementById("profile-info");
      if (profileInfo) {
        profileInfo.style.display = "block";
      }
    }
  } catch (error) {
    console.error("Error loading address books:", error);
    elements.statusText.textContent = "Error: Could not load address books";
    elements.statusText.className = "status-text error-message";
  }
}

async function startSearch() {
  if (isSearching) return;
  
  // Save preferences
  finder.autoremoveDups = elements.autoremove.checked;
  finder.preserveFirst = elements.preservefirst.checked;
  // deferInteractive is always true - always collect all duplicates before showing
  finder.deferInteractive = true;
  await finder.savePreferences();
  
  // Get selected address books
  const ab1Id = elements.addressbook1.value;
  const ab2Id = elements.addressbook2.value;
  
  if (!ab1Id || !ab2Id) {
    alert("Please select address books");
    return;
  }
  
  // Hide explanation, show progress
  elements.explanation.style.display = "none";
  elements.progressSection.style.display = "block";
  elements.tablepane.style.display = "none";
  elements.endinfo.style.display = "none";
  
  // Reset state
  contacts = [[], []];
  simplifiedContacts = [[], []];
  duplicates = [];
  duplicateIndex = 0;
  currentPair = [0, 0];
  shouldStop = false;
  isSearching = true;
  
  stats = {
    totalBefore: 0,
    totalChanged: 0,
    totalSkipped: 0,
    totalDeleted1: 0,
    totalDeleted2: 0,
    totalDeletedAuto: 0
  };
  
  // Load contacts from address books
  await loadContacts(ab1Id, ab2Id);
  
  // Start searching
  await searchForDuplicates();
}

async function loadContacts(ab1Id, ab2Id) {
  try {
    // Load contacts from first address book using the contacts API
    const ab1 = addressBooks.find(ab => ab.id === ab1Id);
    if (!ab1) {
      throw new Error("Address book not found");
    }

    const contacts1 = await browser.contacts.list(ab1Id);

    contacts[0] = contacts1;
    simplifiedContacts[0] = new Array(contacts1.length);
    stats.totalBefore = contacts1.length;

    // Load contacts from second address book (if different)
    if (ab1Id !== ab2Id) {
      const ab2 = addressBooks.find(ab => ab.id === ab2Id);
      if (!ab2) {
        throw new Error("Second address book not found");
      }
      const contacts2 = await browser.contacts.list(ab2Id);
      contacts[1] = contacts2;
      simplifiedContacts[1] = new Array(contacts2.length);
      stats.totalBefore += contacts2.length;
    } else {
      contacts[1] = contacts[0];
      simplifiedContacts[1] = simplifiedContacts[0];
    }

    // Update UI
    elements.statusAddressBook1Label.textContent = ab1.name;
    const ab2 = addressBooks.find(ab => ab.id === ab2Id);
    elements.statusAddressBook2Label.textContent = ab1Id === ab2Id ? ab1.name : (ab2 ? ab2.name : "");
    elements.statusAddressBook1.style.display = "block";
    elements.statusAddressBook2.style.display = "block";
    updateProgress();

  } catch (error) {
    console.error("Error loading contacts:", error);
    alert("Error loading contacts: " + error.message);
    isSearching = false;
  }
}

async function searchForDuplicates() {
  elements.statusText.textContent = "Searching for duplicates...";
  elements.stopbutton.style.display = "block";
  elements.startbutton.disabled = true;
  
  const num1 = contacts[0].length;
  const num2 = contacts[1].length;
  const totalPairs = (contacts[0] === contacts[1]) ? (num1 * (num1 - 1) / 2) : (num1 * num2);
  let pairCount = 0;
  let lastUpdateTime = Date.now();
  
  for (let i = 0; i < num1; i++) {
    if (shouldStop) break;
    
    const startJ = (contacts[0] === contacts[1]) ? i + 1 : 0;
    for (let j = startJ; j < num2; j++) {
      if (shouldStop) break;
      
      pairCount++;
      
      // Update progress bar every 100ms to avoid UI lag
      const now = Date.now();
      if (now - lastUpdateTime >= 100 || pairCount === totalPairs) {
        updateProgressBar(pairCount, totalPairs);
        elements.progressText.textContent = `Checking pair ${pairCount} of ${totalPairs}...`;
        lastUpdateTime = now;
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Skip if either contact was deleted
      if (!contacts[0][i] || !contacts[1][j]) continue;
      
      // Check if they match
      try {
        if (finder.cardsMatch(contacts[0][i], contacts[1][j])) {
          const name1 = finder.getProperty(contacts[0][i], 'DisplayName') || 
                        finder.getProperty(contacts[0][i], 'FirstName') + ' ' + finder.getProperty(contacts[0][i], 'LastName') ||
                        finder.getProperty(contacts[0][i], 'PrimaryEmail');
          const name2 = finder.getProperty(contacts[1][j], 'DisplayName') || 
                        finder.getProperty(contacts[1][j], 'FirstName') + ' ' + finder.getProperty(contacts[1][j], 'LastName') ||
                        finder.getProperty(contacts[1][j], 'PrimaryEmail');
          // Always collect duplicates before showing (deferInteractive is always true)
          duplicates.push([i, j]);
        }
      } catch (error) {
        console.error("Error checking match:", error, contacts[0][i], contacts[1][j]);
      }
    }
  }
  
  if (duplicates.length > 0) {
    duplicateIndex = 0;
    // Show first duplicate and wait for user action (don't auto-advance)
    await showDuplicateAtCurrentIndex();
  } else {
    endSearch();
  }
}

async function showDuplicateAtCurrentIndex() {
  // Show the duplicate at the current index and wait for user action
  if (duplicateIndex >= duplicates.length) {
    // Show the last duplicate and keep buttons functional
    if (duplicates.length > 0) {
      duplicateIndex = duplicates.length - 1;
      const [i, j] = duplicates[duplicateIndex];
      // Skip if contacts were deleted, try previous one
      if (!contacts[0][i] || !contacts[1][j]) {
        // Find the last valid duplicate
        for (let idx = duplicates.length - 1; idx >= 0; idx--) {
          const [idxI, idxJ] = duplicates[idx];
          if (contacts[0][idxI] && contacts[1][idxJ]) {
            duplicateIndex = idx;
            await handleDuplicate(idxI, idxJ, true); // true = isLastDuplicate
            return;
          }
        }
      } else {
        await handleDuplicate(i, j, true); // true = isLastDuplicate
      }
    }
    return;
  }
  
  const [i, j] = duplicates[duplicateIndex];
  
  // Skip if contacts were deleted
  if (!contacts[0][i] || !contacts[1][j]) {
    duplicateIndex++;
    await showDuplicateAtCurrentIndex();
    return;
  }
  
  await handleDuplicate(i, j, false); // false = not last duplicate
}

async function processNextDuplicate() {
  // Move to next duplicate
  duplicateIndex++;
  await showDuplicateAtCurrentIndex();
}

async function goToPreviousDuplicate() {
  // Move to previous duplicate
  if (duplicateIndex > 0) {
    duplicateIndex--;
    await showDuplicateAtCurrentIndex();
  }
}

async function handleDuplicate(i, j, isLastDuplicate = false) {
  const card1 = contacts[0][i];
  const card2 = contacts[1][j];
  
  // Check if auto-remove should happen
  // TODO: Implement card comparison for auto-removal
  // For now, show all duplicates for manual review
  
  // Show duplicate pair
  elements.tablepane.style.display = "block";
  elements.progressSection.style.display = "block";
  displayCardPair(card1, card2, i, j);
  
  // Update button states
  if (isLastDuplicate) {
    // On last duplicate: disable Skip (no next), enable Close, keep Back and Apply working
    elements.skipnextbutton.disabled = true;
    elements.skipnextbutton.textContent = "Skip (Last)";
    elements.closebutton.style.display = "inline-block";
  } else {
    // Not last duplicate: enable Skip, hide Close
    elements.skipnextbutton.disabled = false;
    elements.skipnextbutton.textContent = "Skip";
    elements.closebutton.style.display = "none";
  }
  
  // Show back button if not on first duplicate
  elements.backbutton.style.display = (duplicateIndex > 0) ? "inline-block" : "none";
  elements.mergebutton.disabled = false;
  elements.applynextbutton.disabled = false;
}

function displayCardPair(card1, card2, index1, index2) {
  // Clear previous display
  elements.AttributesTableRows.innerHTML = "";
  
  // Store current pair indices
  currentPair = [index1, index2];
  
  // Display key fields
  const fieldsToShow = ['DisplayName', 'FirstName', 'LastName', 'PrimaryEmail', 'SecondEmail', 
                       'CellularNumber', 'WorkPhone', 'HomePhone', 'Company', 'Notes'];
  
  fieldsToShow.forEach(field => {
    const row = document.createElement("div");
    row.className = "table-row";
    row.dataset.field = field; // Store field name for easy lookup
    
    const label = document.createElement("div");
    label.className = "field-label";
    label.textContent = field + ":";
    row.appendChild(label);
    
    // Left side (card1) - editable input
    const value1Container = document.createElement("div");
    value1Container.className = "field-value keep";
    const value1Input = field === 'Notes' 
      ? document.createElement("textarea")
      : document.createElement("input");
    value1Input.type = "text";
    value1Input.value = finder.getProperty(card1, field) || "";
    value1Input.dataset.side = "left";
    value1Input.dataset.field = field;
    value1Container.appendChild(value1Input);
    row.appendChild(value1Container);
    
    const equiv = document.createElement("div");
    equiv.className = "equivalence";
    const v1 = finder.getProperty(card1, field);
    const v2 = finder.getProperty(card2, field);
    equiv.textContent = (v1 === v2 && v1 !== "") ? "≡" : "";
    row.appendChild(equiv);
    
    // Right side (card2) - editable input
    const value2Container = document.createElement("div");
    value2Container.className = "field-value remove";
    const value2Input = field === 'Notes'
      ? document.createElement("textarea")
      : document.createElement("input");
    value2Input.type = "text";
    value2Input.value = finder.getProperty(card2, field) || "";
    value2Input.dataset.side = "right";
    value2Input.dataset.field = field;
    value2Container.appendChild(value2Input);
    row.appendChild(value2Container);
    
    elements.AttributesTableRows.appendChild(row);
  });
  
  // Set default selection (left side)
  elements.keepLeftRadio.checked = true;
  elements.keepRightRadio.checked = false;
  updateCardSelection();
  
  // Make headers clickable to select which card to keep
  // Remove old listeners first to avoid duplicates
  const newHeaderLeft = elements.headerLeft.cloneNode(true);
  elements.headerLeft.parentNode.replaceChild(newHeaderLeft, elements.headerLeft);
  elements.headerLeft = newHeaderLeft;
  elements.keepLeftRadio = document.getElementById("keepLeft");
  
  const newHeaderRight = elements.headerRight.cloneNode(true);
  elements.headerRight.parentNode.replaceChild(newHeaderRight, elements.headerRight);
  elements.headerRight = newHeaderRight;
  elements.keepRightRadio = document.getElementById("keepRight");
  
  elements.headerLeft.addEventListener("click", () => {
    elements.keepLeftRadio.checked = true;
    elements.keepRightRadio.checked = false;
    updateCardSelection();
  });
  
  elements.headerRight.addEventListener("click", () => {
    elements.keepRightRadio.checked = true;
    elements.keepLeftRadio.checked = false;
    updateCardSelection();
  });
}

function updateCardSelection() {
  if (elements.keepLeftRadio.checked) {
    elements.headerLeft.className = "card-header selectable keep";
    elements.headerRight.className = "card-header selectable remove";
  } else {
    elements.headerLeft.className = "card-header selectable remove";
    elements.headerRight.className = "card-header selectable keep";
  }
  
  // Update field highlighting and editability
  const rows = elements.AttributesTableRows.querySelectorAll(".table-row");
  rows.forEach(row => {
    const cells = row.querySelectorAll(".field-value");
    const inputs = row.querySelectorAll("input, textarea");
    
    if (cells.length >= 2 && inputs.length >= 2) {
      const leftInput = inputs[0];
      const rightInput = inputs[1];
      
      if (elements.keepLeftRadio.checked) {
        // Left is selected - make left editable, right read-only
        cells[0].classList.add("keep");
        cells[0].classList.remove("remove");
        cells[1].classList.add("remove");
        cells[1].classList.remove("keep");
        leftInput.disabled = false;
        rightInput.disabled = true;
      } else {
        // Right is selected - make right editable, left read-only
        cells[0].classList.add("remove");
        cells[0].classList.remove("keep");
        cells[1].classList.add("keep");
        cells[1].classList.remove("remove");
        leftInput.disabled = true;
        rightInput.disabled = false;
      }
    }
  });
}

async function skipAndSearchNext() {
  // Skip this pair - don't make any changes, just move to next
  // If disabled (last duplicate), do nothing
  if (elements.skipnextbutton.disabled) {
    return;
  }
  
  stats.totalSkipped++;
  await processNextDuplicate();
}

/**
 * Merges data from the unselected contact into the selected contact's input fields in the UI.
 * The merge happens in the window - user can review and edit before clicking "Apply" to save.
 * Overflow data (extra emails, phones, etc.) is appended to the Notes field.
 */
function mergeAndSearchNext() {
  const [index1, index2] = currentPair;
  
  const keepLeft = elements.keepLeftRadio.checked;
  const cardToKeep = keepLeft ? contacts[0][index1] : contacts[1][index2];
  const cardToMerge = keepLeft ? contacts[1][index2] : contacts[0][index1];
  
  // Merge properties from both contacts
  const mergedProperties = mergeContactProperties(cardToKeep, cardToMerge);
  
  // Update the input fields on the selected side with merged values
  const rows = elements.AttributesTableRows.querySelectorAll(".table-row");
  
  rows.forEach(row => {
    const field = row.dataset.field;
    if (!field) return;
    
    // Get the input from the selected side (the one that's not disabled)
    const inputs = row.querySelectorAll("input, textarea");
    let inputToUse = null;
    
    if (keepLeft) {
      // Left is selected - update left input
      inputToUse = inputs[0];
    } else {
      // Right is selected - update right input
      inputToUse = inputs[1];
    }
    
    if (inputToUse) {
      // Get the merged value for this field
      const mergedValue = mergedProperties[field] || "";
      inputToUse.value = mergedValue;
    }
  });
  
  // Note: User can now review and edit the merged result before clicking "Apply" to save
}

/**
 * Merges properties from two contact cards into a single properties object.
 * 
 * Strategy:
 * - Starts with all properties from card1 (the contact being kept)
 * - For sets (emails, phones, web pages): combines unique values from both cards
 * - For text fields: prefers longer/more complete values
 * - Handles multiple emails/phones by assigning to PrimaryEmail, SecondEmail, etc.
 * - Extra values beyond standard fields are added to Notes
 * 
 * @param {Object} card1 - The contact card to keep (base)
 * @param {Object} card2 - The contact card to merge into card1
 * @returns {Object} Merged properties object ready for API update
 */
function mergeContactProperties(card1, card2) {
  
  // Start with all properties from card1 (the one we're keeping)
  // This ensures we don't lose any existing fields
  const merged = {};
  const card1Properties = card1.properties || {};
  const card2Properties = card2.properties || {};
  
  // Get all possible property names from both cards
  // Also check the addressBookFields list to ensure we don't miss any standard fields
  const allPropertyNames = new Set([
    ...Object.keys(card1Properties),
    ...Object.keys(card2Properties),
    ...finder.addressBookFields // Include all standard address book fields
  ]);
  
  // Fields that should not be included in merge (internal metadata, system-managed, etc.)
  const nonMergeableFields = [
    'vCard', 'vcard', 'UID', 'UUID', 'CardUID', 'id', 'parentId', 'type',
    ...finder.ignoredFields,
    ...(finder.metaProperties || []),
    '__Names', '__MailListNames', '__Emails', '__PhoneNumbers',
    'PopularityIndex', 'LastModifiedDate',
    'RecordKey', 'DbRowID',
    'groupDavKey', 'groupDavVersion', 'groupDavVersionPrev',
    'unprocessed:rev', 'unprocessed:x-ablabel'
  ];
  
  // First, copy all properties from card1 (the contact we're keeping)
  // Use getProperty to ensure consistent string conversion and handle all property sources
  for (const property of allPropertyNames) {
    // Skip non-mergeable fields
    if (nonMergeableFields.includes(property) || property.startsWith('__')) {
      continue;
    }
    
    // Use getProperty to get the value (it handles both properties object and direct access)
    const normalizedValue = finder.getProperty(card1, property);
    if (normalizedValue && normalizedValue !== "") {
      // Explicitly ensure it's a string
      merged[property] = String(normalizedValue);
    }
  }
  
  // Now merge in properties from card2
  const allProperties = allPropertyNames;
  
  // Collect all emails, phones, web pages, and custom fields
  const allEmails = new Set();
  const allPhones = new Set();
  const allWebPages = new Set();
  const allCustomFields = new Set();
  
  // First pass: collect emails, phones, web pages, and custom fields
  for (const prop of allProperties) {
    if (prop === 'PrimaryEmail' || prop === 'SecondEmail') {
      const val1 = finder.getProperty(card1, prop);
      const val2 = finder.getProperty(card2, prop);
      if (val1 && val1 !== "") allEmails.add(val1);
      if (val2 && val2 !== "") allEmails.add(val2);
    } else if (finder.isPhoneNumber(prop)) {
      const val1 = finder.getProperty(card1, prop);
      const val2 = finder.getProperty(card2, prop);
      if (val1 && val1 !== "") allPhones.add(val1);
      if (val2 && val2 !== "") allPhones.add(val2);
    } else if (prop === 'WebPage1' || prop === 'WebPage2') {
      const val1 = finder.getProperty(card1, prop);
      const val2 = finder.getProperty(card2, prop);
      if (val1 && val1 !== "") allWebPages.add(val1);
      if (val2 && val2 !== "") allWebPages.add(val2);
    } else if (prop === 'Custom1' || prop === 'Custom2' || prop === 'Custom3' || prop === 'Custom4') {
      const val1 = finder.getProperty(card1, prop);
      const val2 = finder.getProperty(card2, prop);
      if (val1 && val1 !== "") allCustomFields.add(val1);
      if (val2 && val2 !== "") allCustomFields.add(val2);
    }
  }
  
  // Assign emails - keep first two in PrimaryEmail/SecondEmail
  // If more than 2 emails exist, add extras to Notes so they're not lost
  const emailArray = Array.from(allEmails);
  const notesParts = []; // Collect all notes additions to combine at the end
  
  if (emailArray.length > 0) {
    merged['PrimaryEmail'] = String(emailArray[0]);
    if (emailArray.length > 1) {
      merged['SecondEmail'] = String(emailArray[1]);
    }
    // If there are more than 2 emails, add the extras to Notes
    if (emailArray.length > 2) {
      const extraEmails = emailArray.slice(2).join(', ');
      notesParts.push('Additional emails: ' + extraEmails);
    }
  }
  
  // Assign phones to available fields
  // Thunderbird supports: CellularNumber, WorkPhone, HomePhone, FaxNumber, PagerNumber
  const phoneArray = Array.from(allPhones);
  if (phoneArray.length > 0) merged['CellularNumber'] = String(phoneArray[0]);
  if (phoneArray.length > 1) merged['WorkPhone'] = String(phoneArray[1]);
  if (phoneArray.length > 2) merged['HomePhone'] = String(phoneArray[2]);
  if (phoneArray.length > 3) merged['PagerNumber'] = String(phoneArray[3]);
  if (phoneArray.length > 4) merged['FaxNumber'] = String(phoneArray[4]);
  
  // If there are more than 5 phones, add extras to Notes
  if (phoneArray.length > 5) {
    const extraPhones = phoneArray.slice(5).join(', ');
    notesParts.push('Additional phone numbers: ' + extraPhones);
  }
  
  // Assign web pages - Thunderbird supports WebPage1 and WebPage2
  const webPageArray = Array.from(allWebPages);
  if (webPageArray.length > 0) merged['WebPage1'] = String(webPageArray[0]);
  if (webPageArray.length > 1) merged['WebPage2'] = String(webPageArray[1]);
  
  // If there are more than 2 web pages, add extras to Notes
  if (webPageArray.length > 2) {
    const extraWebPages = webPageArray.slice(2).join(', ');
    notesParts.push('Additional web pages: ' + extraWebPages);
  }
  
  // Assign custom fields - Thunderbird supports Custom1-4
  const customArray = Array.from(allCustomFields);
  if (customArray.length > 0) merged['Custom1'] = String(customArray[0]);
  if (customArray.length > 1) merged['Custom2'] = String(customArray[1]);
  if (customArray.length > 2) merged['Custom3'] = String(customArray[2]);
  if (customArray.length > 3) merged['Custom4'] = String(customArray[3]);
  
  // If there are more than 4 custom fields, add extras to Notes
  if (customArray.length > 4) {
    const extraCustom = customArray.slice(4).join(', ');
    notesParts.push('Additional custom fields: ' + extraCustom);
  }
  
  // Second pass: handle other properties that weren't already set
  // Skip fields we've already handled and non-mergeable fields
  const alreadyHandledFields = [
    'PrimaryEmail', 'SecondEmail',
    'CellularNumber', 'WorkPhone', 'HomePhone', 'FaxNumber', 'PagerNumber',
    'WebPage1', 'WebPage2',
    'Custom1', 'Custom2', 'Custom3', 'Custom4',
    'Notes'
  ];
  
  for (const prop of allProperties) {
    // Skip non-mergeable fields, already handled fields
    if (nonMergeableFields.includes(prop) || 
        prop.startsWith('__') ||
        alreadyHandledFields.includes(prop)) {
      continue;
    }
    
    // Get normalized string values using getProperty
    const val1 = finder.getProperty(card1, prop);
    const val2 = finder.getProperty(card2, prop);
    
    // Skip if both are empty (keep existing value from card1 if it exists)
    if ((!val1 || val1 === "") && (!val2 || val2 === "")) {
      continue; // Keep existing value from card1 (already in merged)
    }
    
    // For text fields, prefer the longer/more complete value
    if (finder.isText(prop)) {
      if (val1 && val2 && val1 !== "" && val2 !== "") {
        // Both have values - prefer the longer one
        merged[prop] = String(val1.length >= val2.length ? val1 : val2);
      } else if (val2 && val2 !== "") {
        // Only card2 has a value, use it
        merged[prop] = String(val2);
      }
      // If only card1 has value, it's already in merged, so skip
      continue;
    }
    
    // For selection/numerical fields, prefer non-empty/non-zero value
    if (finder.isSelection(prop) || finder.isNumerical(prop)) {
      if (val1 && val1 !== "" && val1 !== "0") {
        merged[prop] = String(val1); // Prefer card1's value
      } else if (val2 && val2 !== "" && val2 !== "0") {
        merged[prop] = String(val2);
      } else if (val1 && val1 !== "") {
        merged[prop] = String(val1);
      } else if (val2 && val2 !== "") {
        merged[prop] = String(val2);
      }
      continue;
    }
    
    // For other fields, prefer non-empty value from card1, then card2
    if (val1 && val1 !== "" && val1 !== "0") {
      merged[prop] = String(val1); // Prefer card1's value
    } else if (val2 && val2 !== "" && val2 !== "0") {
      merged[prop] = String(val2);
    } else if (val1 && val1 !== "") {
      merged[prop] = String(val1);
    } else if (val2 && val2 !== "") {
      merged[prop] = String(val2);
    }
  }
  
  // Handle Notes field - combine existing notes with any extras
  const notes1 = finder.getProperty(card1, 'Notes') || '';
  const notes2 = finder.getProperty(card2, 'Notes') || '';
  const notesArray = [];
  
  // Add existing notes (avoid duplicates)
  if (notes1) notesArray.push(notes1);
  if (notes2 && notes2 !== notes1) notesArray.push(notes2);
  
  // Add any extra emails/phones/web pages/custom fields that were collected
  if (notesParts.length > 0) {
    notesArray.push(...notesParts);
  }
  
  // Combine all notes with double newline separator
  if (notesArray.length > 0) {
    merged['Notes'] = String(notesArray.join('\n\n').trim());
  }
  
  return merged;
}

async function applyAndSearchNext() {
  // Collect edited values from the input fields and save to the kept contact,
  // then delete the other contact
  const [index1, index2] = currentPair;
  const ab1Id = elements.addressbook1.value;
  const ab2Id = elements.addressbook2.value;
  
  // Determine which card to keep and which to delete based on selection
  const keepLeft = elements.keepLeftRadio.checked;
  const cardToKeep = keepLeft ? contacts[0][index1] : contacts[1][index2];
  const cardToDeleteIndex = keepLeft ? index2 : index1;
  const cardToDeleteBook = keepLeft ? 1 : 0;
  
  try {
    if (ab1Id === ab2Id && index1 === index2) {
      // Same card, don't delete
      alert("Cannot delete - both cards are the same!");
      return;
    }
    
    // Collect edited values from the input fields
    // Only collect values from the selected (editable) side
    const propertiesToUpdate = {};
    const rows = elements.AttributesTableRows.querySelectorAll(".table-row");
    
    rows.forEach(row => {
      const field = row.dataset.field;
      if (!field) return;
      
      // Get the input from the selected side (the one that's not disabled)
      const inputs = row.querySelectorAll("input, textarea");
      let inputToUse = null;
      
      if (keepLeft) {
        // Left is selected - use left input (should not be disabled)
        inputToUse = inputs[0];
      } else {
        // Right is selected - use right input (should not be disabled)
        inputToUse = inputs[1];
      }
      
      if (inputToUse && !inputToUse.disabled) {
        const value = inputToUse.value.trim();
        // Only include non-empty values
        if (value !== "") {
          propertiesToUpdate[field] = value;
        }
      }
    });
    
    // Update the kept contact with edited values
    if (Object.keys(propertiesToUpdate).length > 0) {
      const contactId = String(cardToKeep.id);
      
      // Filter out non-updatable fields
      const readonlyFields = ['vCard', 'vcard', 'UID', 'UUID', 'CardUID', 'id', 'parentId', 'type'];
      const nonUpdatableFields = [
        ...readonlyFields,
        ...finder.ignoredFields,
        ...(finder.metaProperties || []),
        '__Names', '__MailListNames', '__Emails', '__PhoneNumbers',
        'PopularityIndex', 'LastModifiedDate',
        'RecordKey', 'DbRowID',
        'groupDavKey', 'groupDavVersion', 'groupDavVersionPrev',
        'unprocessed:rev', 'unprocessed:x-ablabel'
      ];
      
      const filteredProperties = {};
      for (const [property, value] of Object.entries(propertiesToUpdate)) {
        if (!nonUpdatableFields.includes(property) && !property.startsWith('__')) {
          filteredProperties[property] = String(value);
        }
      }
      
      if (Object.keys(filteredProperties).length > 0) {
        try {
          await browser.contacts.update(contactId, filteredProperties);
          stats.totalChanged++;
        } catch (e) {
          console.error("Error updating contact:", e);
          alert("Error updating contact: " + (e.message || e));
          return; // Don't delete if update failed
        }
      }
    }
    
    // Delete the other contact (the one we didn't keep)
    const contact = contacts[cardToDeleteBook][cardToDeleteIndex];
    if (contact && contact.id) {
      try {
        // Ensure ID is a string as required by API
        await browser.contacts.delete(String(contact.id));
      } catch (e) {
        throw new Error("Unable to delete contact: " + (e.message || e));
      }
      contacts[cardToDeleteBook][cardToDeleteIndex] = null;
      if (cardToDeleteBook === 0) {
        stats.totalDeleted1++;
      } else {
        stats.totalDeleted2++;
      }
    }
  } catch (error) {
    console.error("Error applying changes:", error);
    alert("Error applying changes: " + error.message);
    return; // Don't advance if operation failed
  }
  
  // Check if this was the last duplicate
  const wasLastDuplicate = duplicateIndex >= duplicates.length - 1;
  await processNextDuplicate();
  // If it was the last duplicate, the next call will show the end state
  // and buttons will be properly configured
}

function updateProgressBar(current, max) {
  const percent = max > 0 ? (current / max) * 100 : 0;
  elements.progressMeter.style.width = percent + "%";
  // Progress text is updated in searchForDuplicates with more detail
}

function updateProgress() {
  const num1 = contacts[0].length - stats.totalDeleted1;
  const num2 = contacts[1].length - stats.totalDeleted2;
  elements.statusAddressBook1Size.textContent = `(Cards: ${num1})`;
  elements.statusAddressBook2Size.textContent = `(Cards: ${num2})`;
}

function endSearch() {
  isSearching = false;
  shouldStop = false;
  elements.tablepane.style.display = "none";
  elements.progressSection.style.display = "block";
  elements.endinfo.style.display = "block";
  elements.stopbutton.style.display = "none";
  elements.startbutton.disabled = false;
  
  const totalDeleted = stats.totalDeleted1 + stats.totalDeleted2;
  elements.resultNumBefore.textContent = stats.totalBefore;
  elements.resultNumAfter.textContent = stats.totalBefore - totalDeleted;
  elements.resultNumRemovedMan.textContent = totalDeleted - stats.totalDeletedAuto;
  elements.resultNumRemovedAuto.textContent = stats.totalDeletedAuto;
  elements.resultNumChanged.textContent = stats.totalChanged;
  elements.resultNumSkipped.textContent = stats.totalSkipped;
  
  elements.statusText.textContent = "Search finished";
}

