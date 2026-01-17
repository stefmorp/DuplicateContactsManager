"use strict";

/**
 * CardBook API Wrapper
 * 
 * This module provides an interface to communicate with the CardBook extension
 * via runtime messaging. CardBook must be installed for this to work.
 * 
 * CardBook extension ID: cardbook@vigneau.philippe
 */

const CARDBOOK_EXTENSION_ID = "cardbook@vigneau.philippe";

/**
 * Check if CardBook extension is installed and available
 */
async function isCardBookAvailable() {
  try {
    // Try to send a ping message to CardBook
    const response = await browser.runtime.sendMessage(CARDBOOK_EXTENSION_ID, {
      action: "ping"
    });
    return response && response.status === "ok";
  } catch (error) {
    // CardBook not installed or not responding
    return false;
  }
}

/**
 * Get list of CardBook address books
 * @returns {Promise<Array>} Array of address book objects with {id, name, ...}
 */
async function listAddressBooks() {
  try {
    const response = await browser.runtime.sendMessage(CARDBOOK_EXTENSION_ID, {
      action: "listAddressBooks"
    });
    
    if (response && response.status === "ok" && Array.isArray(response.addressBooks)) {
      return response.addressBooks;
    }
    
    throw new Error("Invalid response from CardBook");
  } catch (error) {
    console.error("Error listing CardBook address books:", error);
    throw new Error("Failed to list CardBook address books. Make sure CardBook is installed and enabled.");
  }
}

/**
 * Get all contacts from a CardBook address book
 * @param {string} addressBookId - The ID of the address book
 * @returns {Promise<Array>} Array of contact objects
 */
async function listContacts(addressBookId) {
  try {
    const response = await browser.runtime.sendMessage(CARDBOOK_EXTENSION_ID, {
      action: "listContacts",
      addressBookId: addressBookId
    });
    
    if (response && response.status === "ok" && Array.isArray(response.contacts)) {
      return response.contacts;
    }
    
    throw new Error("Invalid response from CardBook");
  } catch (error) {
    console.error("Error listing CardBook contacts:", error);
    throw new Error("Failed to list contacts from CardBook address book.");
  }
}

/**
 * Update a contact in CardBook
 * @param {string} contactId - The ID of the contact to update
 * @param {Object} properties - Properties to update (key-value pairs)
 * @returns {Promise<void>}
 */
async function updateContact(contactId, properties) {
  try {
    const response = await browser.runtime.sendMessage(CARDBOOK_EXTENSION_ID, {
      action: "updateContact",
      contactId: String(contactId),
      properties: properties
    });
    
    if (response && response.status === "ok") {
      return;
    }
    
    throw new Error(response?.error || "Invalid response from CardBook");
  } catch (error) {
    console.error("Error updating CardBook contact:", error);
    throw new Error("Failed to update contact in CardBook: " + (error.message || error));
  }
}

/**
 * Delete a contact from CardBook
 * @param {string} contactId - The ID of the contact to delete
 * @returns {Promise<void>}
 */
async function deleteContact(contactId) {
  try {
    const response = await browser.runtime.sendMessage(CARDBOOK_EXTENSION_ID, {
      action: "deleteContact",
      contactId: String(contactId)
    });
    
    if (response && response.status === "ok") {
      return;
    }
    
    throw new Error(response?.error || "Invalid response from CardBook");
  } catch (error) {
    console.error("Error deleting CardBook contact:", error);
    throw new Error("Failed to delete contact from CardBook: " + (error.message || error));
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isCardBookAvailable,
    listAddressBooks,
    listContacts,
    updateContact,
    deleteContact
  };
}
