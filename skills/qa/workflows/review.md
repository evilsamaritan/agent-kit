# Test Suite Review Protocol

## Phase 1: Discover

1. Find test config and detect framework
2. Glob for test files and note naming patterns
3. Check coverage config and reports if available
4. Identify mock library and patterns in use
5. Map test files to source files — find orphaned source without tests

## Phase 2: Evaluate

For each test file:

- [ ] Tests are co-located with source (or in a parallel `tests/` directory matching the project convention)
- [ ] Test names describe behavior, not implementation
- [ ] Each test has a single assertion focus (AAA pattern)
- [ ] Mocks are at the right boundary (mock external deps, not internal logic)
- [ ] Edge cases covered: empty, null, boundary, error paths
- [ ] No test depends on execution order or shared mutable state
- [ ] No real network/DB calls in unit tests
- [ ] Setup/teardown resets state properly
- [ ] No type-system escapes that hide errors in tests
- [ ] Tests actually fail when the code is wrong (not just testing mocks)

## Phase 3: Report

```
## Test Suite Assessment

### Summary
[1-3 sentences: overall test health, biggest gaps]

### Coverage Map
| Package/Module | Test Files | Tests | Coverage | Critical Paths Tested |
|---------------|-----------|-------|----------|----------------------|

### Quality Scores
| Dimension | Score (1-5) | Notes |
|-----------|-------------|-------|
| Naming clarity | | |
| Mock boundaries | | |
| Edge case coverage | | |
| Assertion quality | | |
| Determinism | | |

### Missing Tests (by priority)
| Priority | Module | What to Test | Why |
|----------|--------|-------------|-----|

### Anti-Patterns Found
| # | File | Anti-Pattern | Fix |
|---|------|-------------|-----|

### Recommendations
1. [Priority-ordered actions]
```
