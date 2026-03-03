# Testing Strategies

## Contents

- [Proptest: Advanced Strategies](#proptest-advanced-strategies)
- [Kani: Formal Verification](#kani-formal-verification)
- [Bolero: Unified Fuzzing + Verification](#bolero-unified-fuzzing--verification)
- [Insta: Advanced Snapshot Patterns](#insta-advanced-snapshot-patterns)
- [Test Doubles: No Mocking Framework Needed](#test-doubles-no-mocking-framework-needed)

Advanced testing techniques for Rust. For the standard workflow see `workflows/test.md`.

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
        any::<f64>().prop_map(|f| serde_json::Value::Number(f.into())),
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

## Kani: Formal Verification

Kani proves properties for **all** inputs within bounded domains.  
Install: `cargo install --locked kani-verifier && cargo kani setup`

```rust
#[cfg(kani)]
mod verification {
    use super::*;

    // Prove: push then pop returns the original value (for all inputs)
    #[kani::proof]
    fn push_pop_roundtrip() {
        let value: u64 = kani::any(); // symbolic — all possible u64 values
        let mut stack = Stack::new();
        stack.push(value);
        let popped = stack.pop();
        assert_eq!(popped, Some(value));
    }

    // Prove: no integer overflow in add (bounded)
    #[kani::proof]
    #[kani::unwind(10)]  // unroll loops up to 10 times
    fn addition_no_overflow() {
        let a: u32 = kani::any();
        let b: u32 = kani::any();
        kani::assume(a <= u32::MAX / 2);
        kani::assume(b <= u32::MAX / 2);
        let result = a.checked_add(b);
        assert!(result.is_some());
    }

    // Prove: memory safety of unsafe code
    #[kani::proof]
    fn unsafe_ptr_access_safe() {
        let data: [u8; 16] = kani::any();
        let idx: usize = kani::any();
        kani::assume(idx < 16);
        let ptr = data.as_ptr();
        // SAFETY: idx < 16 = data.len(), proven by kani::assume above
        let val = unsafe { *ptr.add(idx) };
        // Kani verifies no out-of-bounds access
        let _ = val;
    }
}
```

Run: `cargo kani` or `cargo kani --harness push_pop_roundtrip`

Kani limitations: no thread verification, loops need `#[kani::unwind(N)]`, slow for large bounds.

---

## Bolero: Unified Fuzzing + Verification

Bolero runs the same harness through libfuzzer, AFL, and Kani:

```rust
#[test]
fn fuzz_parser() {
    bolero::check!()
        .with_type::<Vec<u8>>()
        .for_each(|input| {
            // Should never panic on any input
            let _ = parse_message(input);
        });
}

// With structured inputs
#[test]
fn fuzz_order_processing() {
    bolero::check!()
        .with_type::<(OrderId, Vec<OrderItem>)>()
        .for_each(|(id, items)| {
            let mut order = Order::new(id);
            for item in items {
                let _ = order.add_item(item); // may return error, must not panic
            }
        });
}
```

Run as fuzz: `cargo bolero fuzz fuzz_parser`  
Run as Kani: `cargo bolero kani fuzz_parser`

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
// Fake — a real implementation that's fast and deterministic
pub struct FakeEmailService {
    sent: Arc<Mutex<Vec<Email>>>,
}

impl FakeEmailService {
    pub fn new() -> Self {
        Self { sent: Arc::new(Mutex::new(Vec::new())) }
    }
    
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
    let email_svc = Arc::new(FakeEmailService::new());
    let app = App::new(InMemoryUserRepo::new(), email_svc.clone(), ...);
    
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
