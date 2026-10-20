# Legal documents

What people agree to when they sign up ("I have read and agree to the Terms and Risk statements"). The app shows these exact files on its Terms page (`/terms`), so this folder is the only copy.

| File | What it is | Status |
|---|---|---|
| [terms-of-use.md](terms-of-use.md) | Terms of Use, adapted for a Kenyan business tool from General Legal's CC0 template | Draft |
| [risk-statement.md](risk-statement.md) | What the app does and doesn't do with money and records, in plain words | Draft |
| Privacy Policy | Required under the Kenya Data Protection Act, 2019 | Not written yet ([GDPR template](https://github.com/General-Legal/legal-templates/tree/main/templates/privacy-policy-gdpr) is a good start) |

## Before launch

1. Fill in every **[TO FILL: …]**: company legal name, address, support email, privacy policy link, billing terms.
2. Have a Kenyan lawyer review all three documents, including whether disputes go to court or arbitration.
3. Write the Privacy Policy and link it from the Terms.
4. Decide whether the documents need Somali and Arabic versions. The app currently shows them in English, with a note saying so.

## Changing them

Each document has a version date at the top. When the text changes:

1. Update the date in the document.
2. Set `TERMS_VERSION` in `packages/core/src/schemas.ts` to the same date.

Every profile records the version its owner agreed to (`profiles.terms_version`) and when (`terms_accepted_at`), so we always know who accepted which text. Asking existing users to agree to a new version is not built yet.

## Source

The Terms of Use start from [General Legal's Terms of Use template](https://github.com/General-Legal/legal-templates/tree/main/templates/terms-of-use), released under CC0 1.0 (free to copy and change, no credit needed). We removed the US-only parts (US state notices, US arbitration, export rules) and added sections for a record-keeping tool under Kenyan law. The Risk statement is our own.
