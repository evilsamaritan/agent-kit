# Names: What Code Is Called

Use this reference when naming a declaration, a file, or a folder, when two names look alike, or when a group of related constants or types needs to read as a group. Where a thing lives is in [organization.md](organization.md); this file is about what it is called.

A name is how a reader finds a concept and tells what a thing is without opening it. A good name says up to three things: the **concept** it is about, its **role** when the concept has several representations, and the **family** it belongs to. Most naming failures drop one of the three, and the reader has to open the code to recover it.

## Contents

- [Vocabulary](#vocabulary)
- [Concept](#concept)
- [Role among siblings](#role-among-siblings)
- [Family](#family)
- [Files and folders](#files-and-folders)
- [Recording the choices](#recording-the-choices)

## Vocabulary

- Take names from the domain and from the industry. Do not coin names for mechanisms when a known term exists.
- One term, one meaning. When a word carries two meanings (`session` for both login and game round, `account` for both a login and a ledger), rename one; do not document the ambiguity.
- A name that needs the word "and", or a comment to explain it, is describing two things.

## Concept

The name says what the thing is about: `invoice`, `retryPolicy`, `inventory`. Words that say where code sits or how generic it is — `Manager`, `Helper`, `Utils`, `Common`, `Data`, `Info`, `Item`, `Handler` on its own — say nothing about the concept. Find the concept each piece serves and name it after that; when the pieces serve different concepts, they are different units. The same words as file or folder names are buckets ([organization.md](organization.md#shared-code)).

## Role among siblings

When one concept has several representations, each name says its role: the model (`Invoice`), the stored row (`InvoiceRecord`), the wire shape (`InvoiceDto`), the view model (`InvoiceView`), the file document (`InvoiceFile`). The domain model stays bare; the other roles carry one suffix each, the same suffix for the same role across the code base. A format or protocol version goes on the boundary representation (`InvoiceFileV2`), never on the model.

Two names that differ by a vague word (`Invoice`, `InvoiceData`, `InvoiceInfo`) do not say which is which; the reader opens both to find out.

## Family

Members of one family read as one family, so a reader can tell from the name alone what kind of thing a constant or type is:

| Family | Marker |
|---|---|
| error types | end in `Error` or the language's equivalent |
| error codes | a family prefix (`ERR_…`), an enum, or a namespace (`PaymentError.Timeout`); the category (usage, I/O, conflict) is a separate field from the specific code |
| events — facts that happened | past tense: `OrderPlaced`, `PaymentFailed` |
| commands — requests to act | imperative: `PlaceOrder`, `RefundPayment` |
| settings and limits | the unit in the name: `PAYMENT_TIMEOUT_MS`, `MAX_UPLOAD_BYTES` |
| feature flags, routes, metrics | the project's prefix or namespace for that family |

`TIMEOUT` beside `RETRY_LIMIT` could be an error code or a setting; `PaymentError.Timeout` and `PAYMENT_TIMEOUT_MS` cannot be confused. A family's members also live together, at the concept they describe, not scattered beside their first users.

## Files and folders

A file or folder is named after the concept it holds. A kind suffix (`Service`, `Repository`, `Reducer`) appears only when the reader needs it to tell files of one concept apart, with one suffix per layer. A folder is named after the concept, never after a consumer (`admin/` for a contract the admin panel uses) or a kind (`types/`, `helpers/`).

## Recording the choices

The project's glossary, role suffixes, family markers, and forbidden names live in one place with its other organization choices ([organization.md](organization.md#recording-the-projects-choices)).
