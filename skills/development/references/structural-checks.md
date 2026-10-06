# Structural Checks: Making Core Rules Executable

Use this reference when a core rule has been broken more than once in a project, when a team wants a structure to stay as designed, or when a review keeps finding the same violation. A check runs in the project's own lint, type check, or test suite; it is code the project owns, not an instruction to agents. Tools named here are examples; use what the project already runs.

## Contents

- [Choose the cheapest check](#choose-the-cheapest-check)
- [Completeness at compile time](#completeness-at-compile-time)
- [Restricted dispatch](#restricted-dispatch)
- [Dependency rules](#dependency-rules)
- [Extension tests](#extension-tests)
- [Keeping checks honest](#keeping-checks-honest)

## Choose the cheapest check

| Rule to protect | Cheapest check |
|---|---|
| a closed family is dispatched completely | the compiler's exhaustiveness check, with no default arm |
| every member of an open family provides its pieces | a typed registration the type checker proves complete |
| consumers do not branch on member types | a lint rule restricting the comparison to construction and decoding modules |
| the core does not import adapters, cycles stay out | a dependency rule in the build |
| adding a member touches only its module and one registration | an extension test |

## Completeness at compile time

The compiler should fail when a member is missing:

- **TypeScript:** an exhaustive `switch` whose default assigns the value to `never`; a registration typed `Record<Kind, Handler>` or checked with `satisfies`, so a new `Kind` without a handler does not compile.
- **Rust:** `match` over the enum without a `_` arm.
- **Kotlin:** `when` over a `sealed` hierarchy or enum used as an expression, without `else`.
- **Swift:** `switch` over an enum without `default`.
- **Python:** `match` with `typing.assert_never` in the final case, checked by the type checker.
- **Go:** no exhaustiveness in the language; use an `exhaustive`-style linter for enum switches, or interfaces for open families.

## Restricted dispatch

When consumers keep branching on kinds, restrict the comparison to the modules that may name members:

- **ESLint or oxlint:** `no-restricted-syntax` with a selector for comparisons against the kind property, enabled everywhere and disabled by an override for the registration and codec directories.
- **Other ecosystems:** a custom lint rule, or a test that scans source files for the pattern outside allowed paths and fails with the file and line.

Keep the allowed paths explicit and short. A growing allow list means the rule is wrong or the structure drifted.

## Dependency rules

- **JavaScript and TypeScript:** dependency-cruiser or the build tool's boundary rules: the core imports no adapters, no cycles, modules are entered through their public entry point.
- **Python:** import-linter contracts for layers and forbidden imports.
- **JVM:** ArchUnit tests for package dependencies.
- **Go:** depguard or an internal-package layout.
- **Rust:** module visibility (`pub(crate)`) and crate boundaries.

## Extension tests

An extension test adds a fake member through the public registration and runs the generic operations over it: create, act, present, save and restore. It fails when a consumer needs to know the member.

```ts
test("a new document type needs only its module and a registration", () => {
  const types = registerDocumentTypes([...builtInTypes, fakeType])
  const workspace = createWorkspace({ types })
  const id = workspace.create("fake")
  expect(workspace.render(id)).toBeDefined()
  expect(importWorkspace(exportWorkspace(workspace), { types }).find(id)).toBeDefined()
})
```

## Keeping checks honest

- A check names the rule it protects in its failure message, with the file and line.
- An exception is a reviewed allow-list entry with a reason, not a disabled rule.
- Remove a check whose rule no longer applies; a check nobody understands is noise.
