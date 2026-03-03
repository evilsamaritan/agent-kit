# Architecture Patterns

## Contents

- [Hexagonal Architecture (Ports & Adapters)](#hexagonal-architecture-ports--adapters)
- [Typestate Pattern](#typestate-pattern)
- [CQRS (Command Query Responsibility Segregation)](#cqrs-command-query-responsibility-segregation)
- [Event Sourcing Pattern](#event-sourcing-pattern)
- [Dependency Injection Pattern](#dependency-injection-pattern)

---

## Hexagonal Architecture (Ports & Adapters)

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

## CQRS (Command Query Responsibility Segregation)

Separate write operations (commands) from read operations (queries):

```rust
// Commands — mutate state, return minimal data
pub trait CommandHandler<C: Command>: Send + Sync {
    type Error;
    async fn handle(&self, cmd: C) -> Result<C::Output, Self::Error>;
}

#[derive(Debug)]
pub struct CreateOrder { pub customer_id: CustomerId, pub items: Vec<OrderItem> }
impl Command for CreateOrder { type Output = OrderId; }

// Queries — read-only, return view models (can be denormalized for performance)
pub trait QueryHandler<Q: Query>: Send + Sync {
    type Error;
    async fn handle(&self, query: Q) -> Result<Q::Output, Self::Error>;
}

#[derive(Debug)]
pub struct GetOrderSummary { pub order_id: OrderId }
impl Query for GetOrderSummary { type Output = OrderSummaryView; }

// View model — optimized for the UI, not normalized
pub struct OrderSummaryView {
    pub id: OrderId,
    pub customer_name: String,   // denormalized from customer table
    pub item_count: usize,
    pub total: Money,
    pub status_label: String,    // human-readable status
}
```

---

## Event Sourcing Pattern

Store events instead of current state. Replay events to reconstruct state.

```rust
// Events are the source of truth
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum OrderEvent {
    Created { customer_id: CustomerId, items: Vec<OrderItem> },
    ItemAdded { item: OrderItem },
    Submitted { submitted_at: SystemTime },
    Cancelled { reason: String },
}

// Aggregate reconstructed by applying events
#[derive(Debug, Default)]
pub struct Order {
    pub id: Option<OrderId>,
    pub items: Vec<OrderItem>,
    pub status: OrderStatus,
}

impl Order {
    pub fn apply(&mut self, event: &OrderEvent) {
        match event {
            OrderEvent::Created { customer_id, items } => {
                self.items = items.clone();
                self.status = OrderStatus::Draft;
            }
            OrderEvent::ItemAdded { item } => self.items.push(item.clone()),
            OrderEvent::Submitted { .. } => self.status = OrderStatus::Submitted,
            OrderEvent::Cancelled { .. } => self.status = OrderStatus::Cancelled,
        }
    }

    pub fn from_events(events: &[OrderEvent]) -> Self {
        let mut order = Self::default();
        events.iter().for_each(|e| order.apply(e));
        order
    }
}
```

---

## Dependency Injection Pattern

No framework needed — constructor injection with trait bounds:

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
