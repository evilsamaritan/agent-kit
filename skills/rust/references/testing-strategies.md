# Testing Strategies

## Contents

- [Proptest: Advanced Strategies](#proptest-advanced-strategies)
- [When to Reach for Formal Tools](#when-to-reach-for-formal-tools)
- [Insta: Advanced Snapshot Patterns](#insta-advanced-snapshot-patterns)
- [Test Doubles: No Mocking Framework Needed](#test-doubles-no-mocking-framework-needed)
- [Test Review Checklist](#test-review-checklist)

Advanced testing techniques for Rust.

---

## Proptest: Advanced Strategies

### Dependent value generation (prop_flat_map)

```rust
use proptest::prelude::*;

// Generate a Vec and a valid index into it — index depends on vec length
fn vec_and_index() -> impl Strategy<Value = (Vec<u32>, usize)> {
    prop::collection::vec(any::<u32>(), 1..=100)
        .prop_flat_map(|v| {
            let len = v.len();
            (Just(v), 0..len)  // index is always valid
        })
}

proptest! {
    #[test]
    fn index_is_always_in_bounds((vec, idx) in vec_and_index()) {
        // This can never panic — the strategy ensures validity
        let _ = vec[idx];
    }
}
```

### Recursive data structures

```rust
fn arb_json() -> impl Strategy<Value = serde_json::Value> {
    let leaf = prop_oneof![
        Just(serde_json::Value::Null),
        any::<bool>().prop_map(serde_json::Value::Bool),
        // JSON has no NaN or infinity: from_f64 is fallible, so keep only finite values
        any::<f64>().prop_filter_map("finite", |f| serde_json::Number::from_f64(f).map(serde_json::Value::Number)),
        "[a-z]{0,10}".prop_map(serde_json::Value::String),
    ];

    leaf.prop_recursive(
        4,    // max depth
        64,   // max total nodes
        8,    // max items per collection
        |inner| prop_oneof![
            prop::collection::vec(inner.clone(), 0..8)
                .prop_map(serde_json::Value::Array),
            prop::collection::hash_map("[a-z]{1,5}", inner, 0..8)
                .prop_map(|m| serde_json::Value::Object(m.into_iter().collect())),
        ]
    )
}
```

### Model-based testing (state machine testing)

Test a complex system against a simple reference model:

```rust
use proptest::prelude::*;
use proptest_state_machine::{ReferenceStateMachine, StateMachineTest};

// Simple reference model (HashMap)
#[derive(Default, Clone, Debug)]
struct RefModel {
    data: HashMap<String, String>,
}

// Transitions
#[derive(Debug, Clone)]
enum Op {
    Insert(String, String),
    Remove(String),
    Get(String),
}

impl ReferenceStateMachine for RefModel {
    type State = Self;
    type Transition = Op;

    fn init_state() -> BoxedStrategy<Self::State> { Just(Self::default()).boxed() }
    
    fn transitions(_: &Self::State) -> BoxedStrategy<Self::Transition> {
        prop_oneof![
            ("[a-z]{1,5}", "[a-z]{1,10}").prop_map(|(k,v)| Op::Insert(k, v)),
            "[a-z]{1,5}".prop_map(Op::Remove),
            "[a-z]{1,5}".prop_map(Op::Get),
        ].boxed()
    }

    fn apply(mut state: Self::State, op: &Self::Transition) -> Self::State {
        match op {
            Op::Insert(k, v) => { state.data.insert(k.clone(), v.clone()); }
            Op::Remove(k) => { state.data.remove(k); }
            Op::Get(_) => {}
        }
        state
    }
}
```

---

## When to Reach for Formal Tools

Property tests and fuzzing cover most invariants. Add the heavier tools only where the cost is justified:

- **Kani** (bounded model checking) proves a property for all inputs within bounds. Use it for small, pure, safety-critical functions and for `unsafe` code whose soundness argument is local. It does not verify threads, loops need `#[kani::unwind(N)]`, and large bounds are slow.
- **Bolero** runs one harness as a fuzz target, a property test, and a Kani proof, which suits a parser that must never panic.

```rust
#[cfg(kani)]
#[kani::proof]
fn push_pop_roundtrip() {
    let value: u64 = kani::any(); // symbolic: every u64
    let mut stack = Stack::new();
    stack.push(value);
    assert_eq!(stack.pop(), Some(value));
}

#[test]
fn parser_never_panics() {
    bolero::check!().with_type::<Vec<u8>>().for_each(|input| {
        let _ = parse_message(input); // an Err is fine, a panic is not
    });
}
```

---

## Insta: Advanced Snapshot Patterns

### Redacting dynamic values

```rust
#[test]
fn api_response_snapshot() {
    let response = create_user("alice@example.com");
    insta::assert_yaml_snapshot!(response, {
        ".id" => "[uuid]",
        ".created_at" => "[timestamp]",
        ".updated_at" => "[timestamp]",
    });
}
```

### Globbing over many inputs

```rust
#[test]
fn test_all_fixtures() {
    insta::glob!("fixtures/*.json", |path| {
        let input = std::fs::read_to_string(path).unwrap();
        let output = transform(&input).unwrap();
        insta::assert_snapshot!(output);
    });
}
```

### Settings for consistent output

```rust
#[test]
fn deterministic_snapshot() {
    let mut settings = insta::Settings::clone_current();
    settings.set_sort_maps(true);         // sort HashMap keys
    settings.set_prepend_module_to_snapshot(false);
    settings.bind(|| {
        insta::assert_yaml_snapshot!(complex_output());
    });
}
```

---

## Test Doubles: No Mocking Framework Needed

Prefer **fake implementations** (in-memory adapters) over mock frameworks:

```rust
// Fake — a real implementation that's fast and deterministic.
// Clone shares the inner Arc, so the test keeps a handle to inspect what the app sent.
#[derive(Clone, Default)]
pub struct FakeEmailService {
    sent: Arc<Mutex<Vec<Email>>>,
}

impl FakeEmailService {
    // Test helper to inspect what was sent
    pub fn sent_emails(&self) -> Vec<Email> {
        self.sent.lock().unwrap().clone()
    }
}

impl EmailService for FakeEmailService {
    async fn send(&self, email: Email) -> Result<(), EmailError> {
        self.sent.lock().unwrap().push(email);
        Ok(())
    }
}

// In tests:
#[tokio::test]
async fn registration_sends_confirmation_email() {
    let email_svc = FakeEmailService::default();
    let app = App::new(InMemoryUserRepo::default(), email_svc.clone());

    app.register("user@example.com", "password").await.unwrap();

    let emails = email_svc.sent_emails();
    assert_eq!(emails.len(), 1);
    assert!(emails[0].subject.contains("Confirm"));
}
```

Advantages over mock frameworks:
- Compile-time type checking
- Can hold state across calls
- Inspectable after the fact
- No macro magic or complex setup

---

## Test Review Checklist

- [ ] Public behavior and every error variant are exercised by at least one test
- [ ] Non-trivial invariants have a property test
- [ ] Complex serialized output has a snapshot test
- [ ] Unit and integration tests run with `cargo nextest run` or `cargo test`; doctests run with `cargo test --doc`
- [ ] Async tests use the runtime's test attribute, and wait on synchronization (a channel, a notify), not `sleep`
- [ ] No `#[ignore]` without a linked reason
- [ ] Lint suppressions in tests use `#[expect(...)]` rather than `#[allow(...)]`
- [ ] Boundary conditions are covered: empty input, maximum values, zero
- [ ] `.unwrap()` is fine in test assertions; use `?` in test helper functions
