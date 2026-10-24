# Organization: Where Code Lives

Use this reference when deciding where a new declaration or file goes, when a file or folder has grown, when reviewing the places a change wrote into, or when auditing a tree. It owns the physical side of core rule 7: packages, folders, files, the declarations inside them. Which unit owns a behavior is in [units.md](units.md) and [variation.md](variation.md), what things are called in [names.md](names.md), and boundaries between modules in `architecture`.

Trees use generic names; the structures hold in any language.

## Contents

- [The approach](#the-approach)
- [The five tests](#the-five-tests)
- [Concept first, then kind](#concept-first-then-kind)
- [A concept with several roles](#a-concept-with-several-roles)
- [When a role gets its own file](#when-a-role-gets-its-own-file)
- [Start flat, split on meaning](#start-flat-split-on-meaning)
- [Shared code](#shared-code)
- [Entry points](#entry-points)
- [Container check](#container-check)
- [How far a change restructures](#how-far-a-change-restructures)
- [Smell catalog](#smell-catalog)
- [Examples across ecosystems](#examples-across-ecosystems)
- [Recording the project's choices](#recording-the-projects-choices)
- [Judged, not detected](#judged-not-detected)

## The approach

The structure of a code base is its model of its concepts. Every placement — a function in a class, a declaration in a file, a file in a folder, a folder in a package — answers one question: **which concept is this about?** The same question holds at every scale, and for tests, fixtures, and configuration as much as for production code.

Disorder does not come from one bad folder. It comes from answering an easier question instead, every time:

| Placement decided by | The easy question | What it grows into |
|---|---|---|
| convenience | which file is open, where is the import already? | files that hold several concepts; new concepts hidden inside old ones |
| consumer | who needs this? | declarations defined where they are first used; folders named after their users; one concept copied or split across its consumers |
| kind | what syntax or layer is it — a type, a helper, a constant, a controller? | buckets and by-kind trees; every feature spread over every folder |
| chronology | where was the first version written? | structure frozen at the first guess; later concepts grafted onto early files |
| precedent | how does the code around it do it? | the existing disorder copied as a convention |

Each answer is locally reasonable, and each scales into the same result: a reader cannot find a concept by its name, and a change to one concept touches many places. A cleanup that fixes the places without changing the question does not hold — the next feature is placed by the same easy question, and the tree decays again.

The practice that holds is continuous:

- **Name the concept before placing the code.** A piece you cannot name is not understood yet; naming it is the design decision.
- **Treat the structure as provisional.** Any change can reveal a new concept, a new role of an existing one, or a concept that no longer exists. The structure follows in the same change, as its own behavior-preserving step.
- **Look again after writing, not only before.** A file that was right before the change can be wrong after it. G1 decides the home before writing; G2 checks the container after each portion.
- **Remove what a concept left behind.** When a concept merges or disappears, its home goes too: an empty folder, a file with one leftover declaration, a role file with nothing left in it.

## The five tests

| Test | Passes when | Fails, for example |
|---|---|---|
| **Folder phrase** | "Everything in `X/` is about …" is true for every file in it | `common/` holding date formatting, the HTTP client, feature flags, and the currency type: they share "used in many places", not a concept |
| **File without "and"** | the file's description needs no "and", and its name names that concept | `user` file that also holds session tokens, password hashing, and email templates |
| **Declaration at its concept** | a type, constant, error, default, or schema sits with the concept it describes; consumers import it | the cart line type defined inside the checkout page |
| **One home** | the concept lives in one place, not split across trees and not duplicated | pricing rules half in the cart, half in the invoice generator |
| **Roles as files** | a role with its own reason to change or its own dependencies has its own file beside the concept's root file ([when a role gets its own file](#when-a-role-gets-its-own-file)) | a document's model, its file format, its import from another format, and its errors in one file |

Write the phrase for a folder and the one-line description for a file before judging them; the failure usually shows while writing the sentence. "Utilities", "core stuff", and "helpers for X" are not phrases.

A source root — the package or application root, `src/`, or a framework's reserved directory — takes the package as its phrase. The tests apply to every folder below it. The same tests apply one scale down to a class or module: a class whose methods serve two concepts fails the file test in miniature ([units.md](units.md#what-a-unit-owns)).

## Concept first, then kind

Group by the concept a piece of code serves; inside a concept, the kind of file may name it.

```text
by kind (fails the folder phrase)        by concept
controllers/order, billing               orders/ order, orderService, orderRepository, orderRoutes
services/order, billing                  billing/ invoice, invoiceService, invoiceRepository
repositories/order, billing
```

What changes together lives together; what is used together lives together. A by-kind tree spreads every feature over every folder: one change edits three trees, and nothing tells a reader where a concept ends.

When the project adopted a methodology or framework that fixes the top levels — layers and slices, a framework's reserved directories for routes or auto-imports — those levels stay. The tests apply inside each of them.

## A concept with several roles

A concept starts as one file. When a role [gets its own file](#when-a-role-gets-its-own-file), the concept becomes a folder:

```text
document/
  document.ts          root: the model, its types, invariants, operations on it
  documentFormat.ts    the file format: encode, decode, format versions, migrations
  documentErrors.ts    the error family of the concept
```

| Role | Holds |
|---|---|
| root (model) | types, invariants, operations on the model — the file named after the concept |
| persistence or format | load, save, encode, decode, format versions, migrations |
| transport mapping | wire shapes and their conversion at a boundary |
| presentation | how the concept is shown, when the code base renders it |
| errors | the concept's error types or codes |
| wiring | assembly of the concept's concrete parts |

The root file keeps the concept's name, so the folder reads as the concept and its first file is the concept. Roles are added as they appear, not scaffolded in advance.

## When a role gets its own file

This is the one condition for splitting a role out of a concept's root file; the gates, profiles, and other references point here.

A role gets its own file when it has **its own reason to change or its own dependencies**: persistence brings storage or I/O, a wire format has its own versions, presentation depends on the UI, wiring knows the concrete parts. Kept in the root file, such a role would make the concept change for the role's reasons, or depend on what only the role needs.

A role without its own reason to change or its own dependencies stays in the root file, however much code it has: helpers that serve one algorithm are part of that algorithm. Counting declarations decides nothing — a single save function that needs the storage client earns its own file, while the many private helpers of a parser do not. A file per fragment and a folder per file scatter a concept as surely as a dump hides it.

## Start flat, split on meaning

New code starts in one file per concept, side by side. Meaning splits a file or a folder, never size:

- a file splits when it holds a second concept, or a role that [gets its own file](#when-a-role-gets-its-own-file);
- a folder gets a subfolder when several of its files serve one concept that the folder's phrase does not name;
- a folder splits when its phrase fails.

Line counts, declaration counts, file counts, and consumer counts decide nothing. A short file with three concepts is a dump; a long parser with one concept is not. A file that has grown, a crowded folder, or a section banner is a reason to apply the tests carefully, never an answer to them.

## Shared code

Who uses a piece of code does not decide where it lives; what it is about does.

- Code that is part of one concept's knowledge stays with that concept, however many others use it; they reach it through the concept's entry point.
- Code that belongs to none of the concepts using it — a general mechanism such as money arithmetic, date handling, or retry, free of their rules — is a concept of its own, named for what it is (`money/`, `dates/`, `retry/`), however many users it has.
- When the project's layering forbids one concept importing another (sibling slices or features), knowledge two of them need moves to the place the layering names for it — an entity or a domain-free shared layer — as soon as the second one needs it.

A bucket — `util`, `utils`, `helpers`, `common`, `misc`, `shared`, `types`, `constants` — is not a home: it names a location and grows without bound.

A methodology's domain-free layer (such as a shared layer for UI primitives and infrastructure) is fine when each entry in it is a concept folder; the layer itself is not a place to drop files.

## Entry points

A folder that is a boundary has one entry point; consumers import through it and never reach past it. An entry file that only re-exports at every level is a middle man: it adds a hop without hiding anything. The JavaScript barrel rule is in `frontend`.

## Container check

The single list of questions for G2 (after each portion you write) and G4 (reviewing a change). Compute the answers from the code each time; the evidence goes into the working notes (G2), the report (G3), or the review (G4).

**Gather the evidence** with whatever the stack offers — a directory listing, the editor's outline, a search:

1. **Files of the folder.** List them. Write the folder phrase.
2. **Declarations of the file.** List its top-level declarations: search for the language's declaration keywords at the start of a line (`class`, `interface`, `type`, `enum`, `function`, `const`, `def`, `fn`, `struct`, `trait`, `func`, `object`, `record`…) or read the outline. Write each name with the concept it names.
3. **Consumers.** Search for imports of the file. Note which files use which exports.

A throwaway command or script that speeds this up during the work is fine; it is not committed to the project and is not a gate.

**Then answer** — each question asks about a violation, so "no" everywhere means the container is sound:

1. Is there a file in the folder that does not fit the folder's phrase?
2. Does the file's description need an "and", or does its name leave out something the file holds?
3. Do some declarations name a concept other than the file's — a group of them, or a group of exports used by different files than the rest?
4. Does a role that [gets its own file](#when-a-role-gets-its-own-file) sit in the concept's root file?
5. Did a declaration land at its consumer instead of its concept?
6. Did the change leave a concept's old home empty, or holding a stray declaration?

A "yes" in code you are writing: restructure first as a separate behavior-preserving step ([refactoring.md](refactoring.md)), within the bounds below, then continue. In a review: a blocker when the violation is in what the change adds or in a declaration it extends; a note otherwise.

## How far a change restructures

Restructuring is bounded by what the change writes, so a narrow fix stays narrow:

- **New declarations go to their home.** When the container they would join already mixes concepts, the new piece gets a home of its own — a new file or folder for its concept — instead of joining the mix. That is cheap and needs no reorganization of the rest.
- **An existing declaration moves when the change extends it** and it sits at the wrong concept: that declaration moves, with what it drags along, not the whole container.
- **An edit inside an existing declaration** — a fix in a function body — does not oblige reorganizing the container around it. The container's failures go into the report as findings.
- **Reorganizing a whole file or folder is its own change**, planned with [organize.md](../workflows/organize.md), unless the task asks for it.

## Smell catalog

| Smell | Signs | How to find | Fix |
|---|---|---|---|
| **Grab-bag folder** | the files share "used by X" or "needed early", not a concept | list the folder; try the phrase; look for files related neither to the folder name nor to each other | group by concept into folders; move each file to the concept it serves |
| **Dump file** | several groups of declarations, each naming its own concept | list declarations; group names by concept word | one file per concept; the original name keeps the concept it names |
| **Declaration at its consumer** | a type, constant, or schema of concept A defined in a file of concept B | declarations whose concept word differs from the file's; exports used by other files than the rest | move to A's home; B imports it |
| **Split concept** | one concept's contract, registry, or rules in different trees; files that always change together live apart | search file and declaration names for the concept word across the tree; history of files changed in the same commits | one home; the other trees import it |
| **Folder named by a consumer** | `admin/` inside a domain module, holding a contract the admin panel uses | a folder named after who uses the code, often with one file | name the folder after the concept the code describes, or move the code to that concept |
| **Frozen first guess** | the earliest files hold the most concepts; later concepts live as sections inside them | the history of early files: which concepts were grafted on later | give each grafted concept its own home |
| **Twins** | two near-identical names in one place; which is which cannot be read from the names | names differing by one vague word | name each by its role ([names.md](names.md#role-among-siblings)) |
| **Unmarked family** | members of one family read as something else: error codes that look like settings, events that look like commands | constants and types of one family without a shared marker | a family marker ([names.md](names.md#family)) |
| **Mixed forms** | units of one kind built differently: one owner a class, another a closure, a third a bag of functions | compare units of one kind across the code base | one form per kind of unit ([units.md](units.md#one-form-per-kind-of-unit)); record it |
| **Pass-through entries** | an entry file at every level that only re-exports | entry files with no declarations of their own below the boundary | one entry at the boundary; internal files import each other directly |
| **Section banners** | comment headers splitting a file into parts | search for banner comments | a prompt, not a verdict: split only when the sections serve different concepts or a role that [gets its own file](#when-a-role-gets-its-own-file); stages of one algorithm, or the public and private parts of one concept, stay together |
| **By-kind tree** | top folders named by kind (`controllers/`, `services/`, `models/`, `reducers/`) below the framework's reserved levels | one concept word appears in file names in several sibling trees | concept folders; kinds name files inside them |
| **Bucket** | `utils`, `helpers`, `common`, `misc`, `shared`, `types`, `constants` as a file or folder | file and folder names | move each piece to its owner or to a named shared concept |
| **Confetti** | a concept spread over files that each hold a fragment rather than a concept or a role; reading one concept means opening many files | files whose description is a fragment of another file's concept; folders with one file | merge the fragments into the concept's root file or its role files |
| **Leftover home** | an empty folder, a file with one stray declaration, a role file with nothing left | listings after a move or deletion | delete it, or move the stray to its concept |

## Examples across ecosystems

**Web state.** A by-kind tree (`actions/`, `reducers/`, `selectors/`) where the player reducer also declares the wallet's state types. Opening the player reducer shows wallet state; a wallet change touches three folders.

```text
player/  player.ts (state, actions, reducer)   playerSelectors.ts
wallet/  wallet.ts (state, actions, reducer)   walletSelectors.ts
```

**Backend.** `controllers/`, `services/`, `repositories/` each hold order and billing files. By concept: `orders/` and `billing/`, each with its routes, service, and repository.

**Mobile.** A profile screen file holds the screen, the API client for the profile endpoint, the response cache, and avatar image resizing. Concepts: profile (screen and state), profile API, avatar images. The screen keeps the screen; the others get their own files under `profile/` or, for images used elsewhere, their own concept.

**Game.** The player file holds movement, the inventory, input bindings, and the save format. Concepts: player movement, inventory, input, save data. Inventory and input become their own concepts; the save format becomes a role file of each concept it stores, or of a save concept that composes them.

**Library.** `utils.ts` holds string trimming, date formatting, and a retry helper. Trimming is part of how one module normalizes names, so it moves into that module; date formatting and retry are general mechanisms with no module's rules in them, so they become `dates/` and `retry/` with its policy.

**Data pipeline.** One script extracts records, applies cleaning rules, deduplicates, and renders the report. Concepts: source extraction, cleaning rules, deduplication, report. The script that remains is wiring: it lists the stages in order.

**CLI.** `commands.ts` holds argument parsing and behavior for every command. Each command becomes a module that owns its arguments and its behavior; one registration lists them.

## Recording the project's choices

A project writes its organization choices once, in its instructions or a project skill: the concept glossary, the kind suffixes it uses (one per layer), the form for each kind of unit, and forbidden folder names. A recorded choice beats a convention inferred from the tree. When the existing tree fails the tests, the tests win for new code and the tree is a finding; a rule that pushes toward fewer folders at the cost of mixed concepts ("do not split for the sake of folder count") is such a finding.

## Judged, not detected

Organization is judged by applying the tests to the code at hand. Projects differ too much for a detector to guess concepts from names or file counts: it misreads a family folder as a grab-bag and misses a short file that holds three concepts. Executable checks fit where the rule is exact: a dependency rule that keeps a folder's boundary (enter through the entry point, no cycles, the core imports no adapters) — see [checks.md](checks.md#dependency-rules).
