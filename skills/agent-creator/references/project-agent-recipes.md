# Project Agent Recipes

The single source for project compositions. A profile defines stable profession behavior; a project agent has a responsibility and the exact knowledge for it. These recipes are starting points for `agent-creator` and `init`, not an inheritance layer, a skill, or a registered team. Adapt them to the project and preserve explicit user choices. `init` maps repository evidence to extra skills in its dispatch matrix.

## Contents

- [Names](#names)
- [Starting compositions](#starting-compositions)
- [Project shapes](#project-shapes)
- [Realistic splits](#realistic-splits)

## Names

Start with the profession name. Add a domain when it helps routing: `frontend-developer`, `backend-developer`, `ui-designer`, `security-reviewer`. Add a subsystem prefix only for a real split, such as `customer-frontend-developer` and `admin-frontend-developer`. Technology can name an actual owned component, such as a WebGL renderer; it does not name a profession merely because it is in `skills`.

Do not derive names by concatenating skills: `secure-kotlin-sre-developer`, `web-react`, or `service-rust` are not conventions. Existing user names survive migration. The description states tasks and boundaries; several instances of one profile need distinct descriptions.

## Starting compositions

Language rule: add the language skill when the kit has one (`javascript`, `python`, `go`, `rust`, `kotlin`, `zig`); a language without one gets `development` plus the zone skills.

| Responsibility / example name | Profile | Starting exact knowledge |
|---|---|---|
| Browser UI / frontend-developer | developer | development, frontend, javascript, web, html, css, accessibility; the actual framework (react, vue) |
| Service / backend-developer | developer | development, backend, api-design, the language; database, auth, or message-queues only as used |
| Python service / backend-developer | developer | development, backend, api-design, python; database or background-jobs only as used |
| Data processing / data-developer | developer | development, database, the language (python for Python pipelines); background-jobs or message-queues as used |
| Shared library / developer | developer | development, the language; api-design when the public surface is a contract |
| Game rules and runtime / game-developer | developer | development, gamedev, the language and engine actually used; performance when frame budgets are routine |
| Mobile app and its lifecycle / mobile-developer | developer | development, mobile, accessibility; kotlin for Android or KMP, javascript for React Native (iOS specifics live in the mobile skill's iOS reference) |
| Cross-module decisions / architect | architect | architecture, development; relevant domain knowledge |
| Independent code review / reviewer | reviewer | development; relevant implementation knowledge; architecture when boundaries are in scope. An adversarial stance or a project severity scale goes in `instructions` |
| Measurements, prototypes, spikes / researcher | researcher | performance, development, the language; the zone skill when the harness needs its tooling. Scratch-only by profession; name the scratch directory in `instructions` |
| Security review / security-reviewer | reviewer | development, security; auth or compliance when in scope |
| Test ownership / tester | tester | testing, the project language and framework |
| Game scenarios and state transitions / game-tester | tester | testing, gamedev, the project language |
| UI journeys / ui-designer | designer | design, accessibility; html and css, or platform knowledge, for implementation |
| Documentation / writer | writer | documentation, diagrams; the topic's knowledge |
| Delivery infrastructure / devops | devops | the container, CI, orchestration, and release knowledge actually used |
| Reliability / sre | sre | reliability; observability and performance when in scope |

## Project shapes

| Shape | Typical agents |
|---|---|
| Small single-stack app | one developer with the zone skills, plus a tester when testing is a separate recurring job |
| Service | backend-developer; tester, security-reviewer, or devops only where that work recurs |
| Full-stack monorepo | frontend and backend developers when the boundaries are real; architect for coupled decisions; tester |
| Library | developer, tester; architect for public-contract decisions; writer when documentation is a deliverable; researcher when performance claims are decided by measurement |
| Data pipeline | data-developer; a tester for persistence behavior; sre when it runs in production with SLOs |
| Web game | game-developer; a frontend-developer only for a substantial web UI; game-tester |
| Mobile app | mobile-developer; backend-developer when the sync API lives in the project; tester |

One developer may own UI and other runtime code when the project is small. Several instances are justified by boundaries and recurring work, not by how many frameworks are installed. New domains can use any suitable profile; do not create a profile for every technology.

## Realistic splits

A browser game is not a frontend project because it runs in a browser: gameplay rules, simulation, and the engine adapter belong to a `game-developer` with `gamedev`; menus and HUD built with a web UI framework may belong to a `frontend-developer`. A small game usually needs one developer owning both, with both skill sets.

- **JavaScript game:** `game-developer` (simulation, presentation, scene lifecycle: development, gamedev, javascript) and, only if the UI is a substantial web app, `frontend-developer` (frontend, react or vue, html, css, accessibility). A dedicated renderer owner (`webgl-game-developer`) is justified when GPU work is a separate stream: gamedev, performance, javascript.
- **Mobile app with offline sync:** `mobile-developer` (development, mobile, platform language, accessibility) plus `backend-developer` for the sync API; the conflict policy is agreed between them, recorded by `architect` when it is consequential.
