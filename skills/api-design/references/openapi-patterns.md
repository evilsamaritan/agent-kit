# OpenAPI 3.1 Patterns

Schema design patterns, components, discriminators, webhooks, and SDK generation.

## Contents

- [Minimal OpenAPI 3.1 Spec](#minimal-openapi-31-spec) — starter template
- [Components Organization](#components-organization) — reusable schemas, parameters, responses
- [Discriminators (Polymorphism)](#discriminators-polymorphism) — oneOf with discriminator
- [Webhooks (OpenAPI 3.1)](#webhooks-openapi-31) — webhook event definitions
- [Security Schemes](#security-schemes) — Bearer, API key, OAuth2
- [SDK Generation](#sdk-generation) — openapi-generator commands, SDK-friendly tips

---

## Minimal OpenAPI 3.1 Spec

```yaml
openapi: "3.1.0"
info:
  title: My API
  version: "1.0.0"
  description: API for managing users and orders

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://api-staging.example.com/v1
    description: Staging

paths:
  /users:
    get:
      operationId: listUsers
      summary: List users
      tags: [Users]
      parameters:
        - $ref: "#/components/parameters/Limit"
        - $ref: "#/components/parameters/Cursor"
      responses:
        "200":
          description: Paginated list of users
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

    post:
      operationId: createUser
      summary: Create a user
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateUserInput"
      responses:
        "201":
          description: User created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "422":
          $ref: "#/components/responses/ValidationError"
```

---

## Components Organization

### Reusable Schemas

```yaml
components:
  schemas:
    # Base entities
    User:
      type: object
      required: [id, email, name, createdAt]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 100
        role:
          type: string
          enum: [user, admin, moderator]
          default: user
        createdAt:
          type: string
          format: date-time
          readOnly: true

    # Input types (separate from output)
    CreateUserInput:
      type: object
      required: [email, name]
      properties:
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 100
        role:
          type: string
          enum: [user, admin, moderator]

    UpdateUserInput:
      type: object
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        role:
          type: string
          enum: [user, admin, moderator]

    # Pagination envelope
    UserListResponse:
      type: object
      required: [data, pagination]
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/User"
        pagination:
          $ref: "#/components/schemas/CursorPagination"

    CursorPagination:
      type: object
      required: [hasMore]
      properties:
        nextCursor:
          type: string
          nullable: true
        prevCursor:
          type: string
          nullable: true
        hasMore:
          type: boolean
        limit:
          type: integer
```

### Reusable Parameters

```yaml
  parameters:
    Limit:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

    Cursor:
      name: after
      in: query
      description: Cursor for pagination
      schema:
        type: string

    ResourceId:
      name: id
      in: path
      required: true
      schema:
        type: string
        format: uuid
```

### Reusable Responses

```yaml
  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

    Forbidden:
      description: Insufficient permissions
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

    NotFound:
      description: Resource not found
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

    ValidationError:
      description: Validation failed
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ValidationProblemDetail"

    # Error schemas
  schemas:
    ProblemDetail:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
          format: uri

    ValidationProblemDetail:
      allOf:
        - $ref: "#/components/schemas/ProblemDetail"
        - type: object
          properties:
            errors:
              type: array
              items:
                type: object
                properties:
                  field:
                    type: string
                  code:
                    type: string
                  message:
                    type: string
```

---

## Discriminators (Polymorphism)

### oneOf with Discriminator

Use `oneOf` with `discriminator` for polymorphic types. Pattern: define a `Base` schema with shared fields including the discriminator property (`type`), then create variant schemas using `allOf` that extend the base and add a `const` value for the discriminator.

```yaml
Notification:
  oneOf: [EmailNotification, SmsNotification, PushNotification]
  discriminator:
    propertyName: type
    mapping:
      email: "#/components/schemas/EmailNotification"
      sms: "#/components/schemas/SmsNotification"

NotificationBase:
  type: object
  required: [type, recipient, message]
  properties:
    type: { type: string }
    recipient: { type: string }
    message: { type: string }

EmailNotification:
  allOf:
    - $ref: "#/components/schemas/NotificationBase"
    - type: object
      required: [subject]
      properties:
        type: { type: string, const: email }
        subject: { type: string }
```

---

## Webhooks (OpenAPI 3.1)

```yaml
webhooks:
  orderCreated:
    post:
      operationId: onOrderCreated
      summary: Order created event
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/WebhookEvent"
      responses:
        "200":
          description: Webhook processed

components:
  schemas:
    WebhookEvent:
      type: object
      required: [id, type, createdAt, data]
      properties:
        id:
          type: string
        type:
          type: string
          enum: [order.created, order.updated, order.cancelled]
        createdAt:
          type: string
          format: date-time
        data:
          type: object
```

---

## Security Schemes

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/authorize
          tokenUrl: https://auth.example.com/token
          scopes:
            users:read: Read user data
            users:write: Modify user data
            orders:read: Read orders

# Apply globally
security:
  - BearerAuth: []

# Override per operation
paths:
  /public/health:
    get:
      security: []  # No auth required
```

---

## SDK Generation

### openapi-generator Commands

```bash
# TypeScript (fetch-based)
openapi-generator generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o ./sdk/typescript \
  --additional-properties=supportsES6=true,npmName=@myorg/api-client

# Python
openapi-generator generate \
  -i openapi.yaml \
  -g python \
  -o ./sdk/python \
  --additional-properties=packageName=myapi_client

# Go
openapi-generator generate \
  -i openapi.yaml \
  -g go \
  -o ./sdk/go \
  --additional-properties=packageName=myapi
```

### Tips for SDK-Friendly Specs

| Practice | Why |
|----------|-----|
| Use `operationId` on every operation | Becomes method name in SDK |
| Group with `tags` | Becomes class/module in SDK |
| Use `$ref` for reusable schemas | Generates named types |
| Add `description` to everything | Becomes code comments/docs |
| Use `enum` with string values | Generates type-safe constants |
| Mark `required` fields explicitly | Affects nullability in generated types |
| Use `readOnly` / `writeOnly` | Separate input/output types automatically |
