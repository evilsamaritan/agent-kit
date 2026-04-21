# Recipes — Preset Answer Bundles

Each recipe is a preset answer set for the 5 bootstrap questions plus a stack assumption. Invoked via `/init <recipe-name>`. The dispatch matrix (`dispatch-matrix.md`) then derives the actual action list from these answers — recipes never encode outputs directly.

---

## small-react-app

**Stack assumption:** React + Vite (or CRA), TypeScript, no backend (or simple API mock)

**Answers:**
- Project type: web app
- Primary tasks: feature development
- Team size: pair
- Quality gates: advisory
- Shortcuts: slash commands (`/test`, `/lint`)

**Why this preset:** Small SPAs benefit most from frontend + testing pair. No backend role needed if there's no server. Advisory gates avoid blocking dev flow on solo projects.

---

## go-microservice

**Stack assumption:** Go + Docker (often + Postgres, gRPC/HTTP)

**Answers:**
- Project type: web app (service)
- Primary tasks: feature development + code review
- Team size: small team (3–5)
- Quality gates: blocking (lint, tests)
- Shortcuts: slash commands (`/lint`, `/test`, `/audit`)

**Why this preset:** Backend services need backend + devops + testing + security. Blocking gates matter because services run in production. CI integration is high-value.

---

## monorepo-fullstack

**Stack assumption:** pnpm workspace + Node + React (or Vue) + TypeScript + Express/Fastify

**Answers:**
- Project type: mixed
- Primary tasks: feature development + code review + refactor
- Team size: small team (3–5) or Agent Teams
- Quality gates: blocking
- Shortcuts: slash commands (`/review`, `/test`, `/deploy-check`)

**Why this preset:** Monorepos cross frontend/backend boundaries — architect role earns its place. Three primary tasks make Agent Teams worth considering.

---

## library

**Stack assumption:** Single-package repo, any language, intended for npm/PyPI/crates publication

**Answers:**
- Project type: library
- Primary tasks: feature development + documentation
- Team size: pair
- Quality gates: advisory
- Shortcuts: slash commands (`/release-check`)

**Why this preset:** Libraries need docs + testing rigor but rarely benefit from heavy team setup. Advisory gates catch regressions without slowing maintainer velocity.

---

## data-pipeline

**Stack assumption:** Python + Airflow / dbt / Spark, often + cloud (S3/GCS/Snowflake)

**Answers:**
- Project type: data pipeline
- Primary tasks: feature development + operations
- Team size: small team (3–5)
- Quality gates: advisory
- Shortcuts: slash commands (`/lint`, `/test`)

**Why this preset:** Data pipelines need backend + database + observability + testing. Operations is a primary task because pipelines run on schedules — sre role is helpful.

---

## How to add a recipe

1. Decide what kind of project it targets — be specific about stack assumptions
2. Fill in all 5 answers — every field, no defaults
3. Add a "Why this preset" paragraph explaining the rationale
4. Test by running through `dispatch-matrix.md` mentally — does the resulting plan make sense?
5. Add to the table in `init/SKILL.md`

Recipes are **answer presets only**. Do not encode action lists here — that's the dispatch matrix's job. This separation keeps recipes stable as the matrix evolves.
