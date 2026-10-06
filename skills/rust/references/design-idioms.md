# Design Idioms in Rust

How Rust expresses the practice in `development` and the boundaries chosen with `architecture`: ports as traits, variant families as enums or traits, typestate, and explicit dependencies.

## Contents

- [Ports as Traits, Adapters as Crates](#ports-as-traits-adapters-as-crates)
- [Variant Families: Enum or Trait](#variant-families-enum-or-trait)
- [Typestate Pattern](#typestate-pattern)
- [Passing Dependencies: Generics or Trait Objects](#passing-dependencies-generics-or-trait-objects)
- [Ownership Review](#ownership-review)

---

## Ports as Traits, Adapters as Crates

A port is a trait the domain owns; an adapter is a type that implements it. Dependency direction and module layout are in `architecture`; the Rust-specific choices are the trait shape and static or dynamic dispatch.

```rust
// core/src/ports.rs: declare Send futures so generic code can be spawned on a multi-thread runtime
pub trait UserRepository: Send + Sync + 'static {
    fn save(&self, user: &User) -> impl Future<Output = Result<(), RepositoryError>> + Send;
    fn find_by_email(&self, email: &str)
        -> impl Future<Output = Result<Option<User>, RepositoryError>> + Send;
}

// core/src/services.rs: the domain is generic over the port
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

// db/src/postgres.rs: an adapter may use `async fn` in the impl
pub struct PostgresUserRepo { pool: sqlx::PgPool }

impl UserRepository for PostgresUserRepo {
    async fn save(&self, user: &User) -> Result<(), RepositoryError> { /* ... */ Ok(()) }
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, RepositoryError> { /* ... */ Ok(None) }
}
```

A trait with native `async fn` or `-> impl Future` is not dyn-compatible, so `Box<dyn UserRepository>` does not compile. Use generics (above), the `async-trait` macro, hand-boxed futures, or an enum of adapters when the implementation is chosen at runtime. A test adapter is an in-memory struct implementing the same trait (see [testing-strategies.md](testing-strategies.md)).

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

A derive-based builder crate (for example `bon`) enforces required fields at compile time:

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

Dependencies arrive through constructors, as generic parameters with trait bounds:

```rust
// Static dispatch (default): zero cost, works with async-fn-in-trait ports
pub struct App<U: UserRepository, E: EmailService, P: PaymentGateway> {
    users: U,
    email: E,
    payment: P,
}

// Dynamic dispatch: runtime selection. Requires dyn-compatible traits
// (sync methods, `async-trait`, or boxed futures)
pub struct DynApp {
    users: Box<dyn UserStore>,
    email: Box<dyn EmailSender>,
}

// main() is the composition root: the only place that names concrete types
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    let pool = PgPool::connect(&config.database_url).await?;

    let app = App {
        users: PostgresUserRepo::new(pool.clone()),
        email: SmtpEmailService::new(&config.smtp),
        payment: ProviderGateway::new(&config.payment_key),
    };

    serve(app, config.port).await
}
```

Tests wire the same `App` with in-memory implementations; no mocking framework is needed.

---

## Ownership Review

```rust
// Prefer borrowing in functions: the caller decides lifetime
pub fn process(data: &[u8]) -> Result<Output, Error>   // NOT: data: Vec<u8>
pub fn lookup(key: &str) -> Option<&Value>              // NOT: key: String

// Use Cow when sometimes you allocate, sometimes you borrow
pub fn normalize(s: &str) -> Cow<'_, str> {
    if needs_change(s) { Cow::Owned(s.to_uppercase()) }
    else { Cow::Borrowed(s) }
}
```

- Each `clone()` is justified; a clone that exists to satisfy the borrow checker usually signals a design problem
- `Arc<Mutex<T>>` is minimal; prefer message passing when one task can own the state
- Domain concepts are newtypes, not raw `String`, `u64`, or `Uuid`
- `pub` fields only where the invariant allows it
