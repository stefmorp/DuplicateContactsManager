# Duplicate Contacts Manager for Thunderbird 128+

A Thunderbird add-on that searches address book(s) for duplicate contact entries and helps you merge or remove them. This is a port of the original [Duplicate Contacts Manager](https://github.com/DDvO/Duplicate-Contacts-Manager) from Thunderbird 68 (legacy XUL/XPCOM) to Thunderbird 128+ (MailExtension/WebExtension).

**Important**: This extension works only with Thunderbird's **native address books**. It does not support third-party address book extensions (such as CardBook) that maintain their own separate address book systems.

## Features

- **Duplicate Detection**: Finds contacts that match by name, email address, or phone number
- **Smart Matching**: Handles variations in formatting, case, accents, and phone number formats
- **Interactive Review**: Side-by-side comparison of duplicate pairs with options to:
  - **Skip**: Keep both contacts as-is
  - **Merge**: Combine fields from both contacts into one
  - **Apply**: Keep the selected contact with any changes made, and delete the other
- **Automatic Collection**: All duplicates are collected before showing them, allowing you to review and process them at your own pace
- **Statistics**: Shows total contacts before/after, number of duplicates removed, and changes made

## Installation

Download the code to a directory of your choice, and then:

1. Open **Thunderbird**
2. Go to **Tools → Add-ons and Themes**
3. Click the **gear icon (⚙)** → **Debug Add-ons**
4. Click **Load Temporary Add-on…**
5. Navigate to this directory and select **`manifest.json`**

See also: https://developer.thunderbird.net/add-ons/hello-world-add-on#installing

The add-on will be loaded temporarily. You can access it via:
- The toolbar button (opens popup → main window)
- **Tools → Duplicate Contacts Manager...** menu item

## How to Use

1. **Launch the extension** from the toolbar or Tools menu
2. **Select address books** to search for duplicates:
   - **Note**: Only Thunderbird's native address books will appear in the dropdowns
   - Choose the first address book from the dropdown
   - Choose the second address book (can be the same book to find duplicates within one book)
3. **Configure options** (optional):
   - **Auto-remove duplicates**: Automatically removes contacts with less information
   - **Preserve first contact**: When auto-removing, keeps the first contact found
4. **Click "Start Search"** to begin finding duplicates
5. **Review duplicates**: For each duplicate pair:
   - Use the radio buttons to select which contact to keep (left or right)
   - Click **"Merge (Combine Fields)"** to combine all fields from both contacts into the selected one
     - **Note**: The merged contact will remain in the same address book as the contact you selected to keep
   - Click **"Apply (Delete Other Card)"** to keep the selected contact and delete the other
   - Click **"Skip"** to keep both contacts unchanged
6. **After processing all duplicates**: Click **"Close"** to close the window and view the final statistics

## Important Notes

### Native Address Books Only

**Important**: This extension works exclusively with Thunderbird's **native address books** via the WebExtension API. 

- Only Thunderbird's native address books will appear in the extension's address book dropdowns
- Third-party address book extensions (such as CardBook) maintain their own separate address book systems
- These third-party address books are not accessible through the standard WebExtension API
- If you use CardBook or similar extensions, their address books will not appear in this extension
- To work with third-party address book extensions, you would need to use their own duplicate detection features (if available)

### Address Book Location for Merged Contacts

When you merge two contacts:
- The merged contact will be saved in the **same address book** as the contact you selected to keep (via the radio buttons)
- If the two contacts are in different address books, the merged contact will be in the address book of the contact you chose to keep
- The duplicate contact (the one you didn't select) will be deleted from its original address book

## Matching Logic

Two contacts are considered duplicates if they match on:
- **Name**: Matching display names, first names, or last names (with normalization for accents, case, etc.)
- **Email**: Matching email addresses (case-insensitive)
- **Phone**: Matching phone numbers (with normalization for formatting differences)

Contacts with non-equivalent `AIMScreenName` are never considered matching.

## Technical Details

### Architecture

This add-on uses the Thunderbird WebExtension API:
- **addressBooks API**: For listing and accessing address books
- **contacts API**: For reading, updating, and deleting contacts
- **storage API**: For persisting user preferences

### Contact Merging

The merge functionality uses the Thunderbird contacts API's legacy properties interface:
- Merges properties from both contacts intelligently
- Combines multiple emails, phones, and web pages
- Preserves all non-empty fields
- Automatically updates the internal vCard when legacy properties are updated
- See: [Thunderbird vCard API Documentation](https://thunderbird-webextension-apis.readthedocs.io/en/stable/examples/vcard.html)

#### Merge Strategy

When merging two contacts, the extension uses the following strategy:

**Base Strategy:**
- Starts with all properties from the contact you selected to keep (card1)
- Merges in additional information from the duplicate contact (card2)

**Email Addresses:**
- Collects all unique email addresses from both contacts
- **PrimaryEmail**: First email address found
- **SecondEmail**: Second email address found
- **Notes**: Any additional emails (3rd, 4th, etc.) are added as "Additional emails: email1, email2, ..."

**Phone Numbers:**
- Collects all unique phone numbers from both contacts (from any phone field)
- **CellularNumber**: First phone number
- **WorkPhone**: Second phone number
- **HomePhone**: Third phone number
- **PagerNumber**: Fourth phone number
- **FaxNumber**: Fifth phone number
- **Notes**: Any additional phone numbers (6th, 7th, etc.) are added as "Additional phone numbers: phone1, phone2, ..."

**Web Pages:**
- Collects all unique web page URLs from both contacts
- **WebPage1**: First web page
- **WebPage2**: Second web page
- **Notes**: Any additional web pages (3rd, 4th, etc.) are added as "Additional web pages: url1, url2, ..."

**Custom Fields:**
- Collects all unique custom field values from both contacts
- **Custom1**: First custom field value
- **Custom2**: Second custom field value
- **Custom3**: Third custom field value
- **Custom4**: Fourth custom field value
- **Notes**: Any additional custom fields (5th, 6th, etc.) are added as "Additional custom fields: value1, value2, ..."

**Text Fields** (DisplayName, FirstName, LastName, Company, JobTitle, etc.):
- If both contacts have values: prefers the longer/more complete value
- If only one contact has a value: uses that value
- Preserves existing value from card1 if card2 is empty

**Selection/Numerical Fields** (PreferDisplayName, PreferMailFormat, etc.):
- Prefers non-empty, non-zero values
- Falls back to any available value if preferred value is not available

**Other Fields:**
- Prefers non-empty values from card1 (the contact being kept)
- Falls back to card2 values if card1 is empty

**Notes Field:**
- Combines existing notes from both contacts (avoiding duplicates)
- Appends any overflow information:
  - Additional emails (beyond PrimaryEmail/SecondEmail)
  - Additional phone numbers (beyond the 5 standard phone fields)
  - Additional web pages (beyond WebPage1/WebPage2)
  - Additional custom fields (beyond Custom1-4)
- Notes are separated by double newlines (`\n\n`)

**Fields Excluded from Merge:**
- Internal metadata fields (vCard, UID, UUID, CardUID, id, parentId, type)
- System-managed fields (PopularityIndex, LastModifiedDate, RecordKey, DbRowID)
- DAV sync fields (groupDavKey, groupDavVersion, etc.)
- Internal processing fields (fields starting with `__`)

### File Structure

```
├── manifest.json          # Add-on manifest
├── background.js         # Background script (window management)
├── lib/
│   └── duplicateFinder.js # Core duplicate detection logic
├── window/
│   ├── window.html       # Main UI window
│   ├── window.css        # Styles
│   └── window.js         # Window logic and merge functionality
└── popup/
    ├── popup.html        # Toolbar popup
    └── popup.js          # Popup logic
```

## Port Status

### ✅ Fully Implemented

- Core duplicate detection logic (name, email, phone matching)
- Card comparison algorithms
- Text abstraction and normalization
- Preferences/storage system
- Main UI window (HTML/CSS/JS)
- Address book selection and contact loading
- Duplicate pair display
- Contact deletion
- **Contact merging** - Combines fields from duplicate contacts
- Navigation (Back button, Close button)
- Statistics tracking

### Known Limitations

- Auto-removal comparison logic may need refinement for edge cases
- Photo display in comparison view not yet implemented
- Advanced preferences UI (phone normalization, ignored fields) not yet exposed
- Mailing list membership handling not yet implemented

## Credits

Original add-on by DDvO: https://github.com/DDvO/Duplicate-Contacts-Manager

Port to Thunderbird 128+ by [Your Name]

## License

[To be determined - check original repository license]
