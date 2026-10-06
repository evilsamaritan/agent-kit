# Design Idioms in Rust

How Rust expresses the practice in `development` and the boundaries chosen with `architecture`: ports as traits, variant families as enums or traits, typestate, and explicit dependencies.

## Contents

- [Ports as Traits, Adapters as Crates](#ports-as-traits-adapters-as-crates)
- [Variant Families: Enum or Trait](#variant-families-enum-or-trait)
- [Typestate Pattern](#typestate-pattern)
- [Passing Dependencies: Generics or Trait Objects](#passing-dependencies-generics-or-trait-objects)
- [Design Checklist](#design-checklist)

---

## Ports as Traits, Adapters as Crates

The domain crate has **zero infrastructure dependencies**.  
Traits are ports. Structs implementing them are adapters.

```
crates/
├── types/        # shared types — zero deps
├── core/         # domain logic — depends only on types/
├── db/           # database adapter — depends on core/, types/
├── api/          # HTTP adapter — depends on core/, types/
└── app/          # binary — wires everything together
```

```rust
// core/src/ports.rs — defines the ports (interfaces)
pub trait UserRepository: Send + Sync + 'static {
    async fn save(&self, user: &User) -> Result<(), RepositoryError>;
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, RepositoryError>;
}

// core/src/services.rs — domain logic depends only on ports
pub struct UserService<R: UserRepository> {
    repo: R,
}

impl<R: UserRepository> UserService<R> {
    pub async fn register(&self, email: &str, password: &str) -> Result<User, RegisterError> {
        if self.repo.find_by_email(email).await?.is_some() {
            return Err(RegisterError::EmailTaken);
        }
        let user = User::new(email, hash_password(password));
        self.repo.save(&user).await?;
        Ok(user)
    }
}

// db/src/postgres.rs — concrete adapter
pub struct PostgresUserRepo { pool: sqlx::PgPool }

impl UserRepository for PostgresUserRepo {
    async fn save(&self, user: &User) -> Result<(), RepositoryError> { ... }
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, RepositoryError> { ... }
}

// In tests: in-memory adapter
#[cfg(test)]
mod tests {
    struct InMemoryUserRepo { users: Mutex<Vec<User>> }
    impl UserRepository for InMemoryUserRepo { ... }
}
```

---

## Variant Families: Enum or Trait

A closed family — protocol messages, states, a format's record versions — is an `enum` consumed with `match` and no `_` arm, so a new variant fails to compile until every match handles it:

```rust
pub enum Frame { Data { payload: Bytes }, Ping, Close { code: u16 } }

fn handle(conn: &mut Connection, frame: Frame) -> Result<(), ProtocolError> {
    match frame {
        Frame::Data { payload } => conn.deliver(payload),
        Frame::Ping => conn.pong(),
        Frame::Close { code } => conn.close(code),
    }
}
```

An open family — notification channels, payment providers, importers — is a trait each member implements, registered once where the application is assembled. Consumers call the trait, never test which member they hold:

```rust
pub trait Channel: Send + Sync {
    fn send(&self, message: &Message) -> Result<Receipt, SendError>;
    fn settings_schema(&self) -> Schema;
}

pub struct Channels(HashMap<ChannelId, Box<dyn Channel>>); // filled in main(); the only place that names members
```

Prefer generics when the set of implementations is fixed at compile time per call site, `Box<dyn Trait>` when members are chosen at runtime.

---

## Typestate Pattern

Encode state machine transitions in the type system. Invalid transitions are compile errors.

```rust
use std::marker::PhantomData;

// States as zero-sized types
pub struct Unverified;
pub struct Verified;
pub struct Expired;

// Entity parameterized by state
pub struct ApiKey<S> {
    value: String,
    created_at: SystemTime,
    _state: PhantomData<S>,
}

// Constructor produces Unverified
impl ApiKey<Unverified> {
    pub fn new(value: impl Into<String>) -> Self {
        Self { value: value.into(), created_at: SystemTime::now(), _state: PhantomData }
    }
}

// Only Unverified keys can be verified
impl ApiKey<Unverified> {
    pub fn verify(self, secret: &str) -> Result<ApiKey<Verified>, AuthError> {
        if constant_time_eq(self.value.as_bytes(), secret.as_bytes()) {
            Ok(ApiKey { value: self.value, created_at: self.created_at, _state: PhantomData })
        } else {
            Err(AuthError::InvalidKey)
        }
    }
}

// Only Verified keys can be used
impl ApiKey<Verified> {
    pub fn authorize(&self, permission: Permission) -> Result<(), AuthError> { ... }
    
    pub fn expire(self) -> ApiKey<Expired> { ... }
}

// compile error: ApiKey<Unverified> has no .authorize() method ✓
```

Use `bon` crate for builder pattern with required/optional fields enforced at compile time:

```rust
#[derive(bon::Builder)]
pub struct Config {
    host: String,          // required — compile error if missing
    port: u16,             // required
    #[builder(default = 30)]
    timeout_secs: u64,     // optional with default
}
```

---

## Passing Dependencies: Generics or Trait Objects

No framework needed — dependencies arrive through constructors with trait bounds:

```rust
// Static dispatch (preferred — zero cost)
pub struct App<U: UserRepository, E: EmailService, P: PaymentGateway> {
    users: U,
    email: E,
    payment: P,
}

// Dynamic dispatch (when you need runtime polymorphism)
pub struct App {
    users: Box<dyn UserRepository>,
    email: Box<dyn EmailService>,
    payment: Box<dyn PaymentGateway>,
}

// App module wires everything in main()
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    let pool = PgPool::connect(&config.database_url).await?;
    
    let app = App {
        users: PostgresUserRepo::new(pool.clone()),
        email: SmtpEmailService::new(&config.smtp),
        payment: StripeGateway::new(&config.stripe_key),
    };
    
    serve(app, config.port).await
}
```

The key insight: test code wires the same `App` with in-memory implementations — no mocking frameworks needed.

---

## Design Checklist

Before handing off any design:

- [ ] All public traits defined with signatures and doc comments
- [ ] All error types defined with variants — `Send + Sync + 'static`
- [ ] All invariants stated explicitly
- [ ] Module boundaries enforce dependency direction (domain never depends on infrastructure)
- [ ] `[workspace.dependencies]` with versions for all crates
- [ ] `[workspace.lints]` configured
- [ ] API parameters use borrowed types (`&str`, `&[T]`, `impl AsRef<Path>`) — not owned
- [ ] Domain concepts wrapped in newtype structs (not raw `String`, `u64`, `Uuid`)
- [ ] `pub` fields only where needed — encapsulation is correct
- [ ] `Default` impl is sensible (not just `#[derive(Default)]` producing nonsense)
- [ ] Open questions flagged (not silently assumed)

### Ownership & Lifetime Review

```rust
// Prefer borrowing in functions — caller decides lifetime
pub fn process(data: &[u8]) -> Result<Output, Error>   // NOT: data: Vec<u8>
pub fn lookup(key: &str) -> Option<&Value>              // NOT: key: String

// Use Cow when sometimes you allocate, sometimes you borrow
pub fn normalize(s: &str) -> Cow<'_, str> {
    if needs_change(s) { Cow::Owned(s.to_uppercase()) }
    else { Cow::Borrowed(s) }
}
```

- No unnecessary clones — each clone should be justified
- `Arc<Mutex<T>>` usage is minimal; prefer message passing (`tokio::sync::mpsc`)
- `unsafe` blocks: each requires a `// SAFETY:` comment explaining soundness
