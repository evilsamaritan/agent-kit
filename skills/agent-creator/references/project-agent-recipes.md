# Project Agent Recipes

A profile defines stable profession behavior. A project agent has a responsibility and exact knowledge for that responsibility. These recipes are starting points for creator/init, not another inheritance layer, skill, or registered team. Adapt them to the actual project and preserve explicit user choices.

## Choose by responsibility

Start with the profession name. Add a domain when it helps routing: `frontend-developer`, `backend-developer`, `ui-designer`, `security-reviewer`. Add a subsystem prefix only for a real split, such as `ui-frontend-developer` and `adminui-frontend-developer`. Technology can name an actual owned component, such as a WebGL renderer; it does not name a profession merely because it is in `skills`.

Do not derive names by concatenating skills: `secure-kotlin-sre-developer`, `web-react`, or `service-rust` are not default conventions. Existing user names survive migration. Description states tasks and boundaries; several instances of a profile need distinct scope descriptions. No closed specialization enum is needed.

## Starting compositions

| Responsibility / example name | Profile | Starting exact knowledge |
|---|---|---|
| Browser UI / frontend-developer | developer | architecture, frontend, web, html, css, accessibility; language and actual framework |
| Service operations / backend-developer | developer | architecture, backend, api-design; language, persistence/auth only as used |
| Shared library / developer | developer | architecture; language, testing/API knowledge as needed |
| Game rules and runtime / game-developer | developer | architecture, gamedev; the language and engine actually used; performance when frame budgets are routine |
| Mobile app and its lifecycle / mobile-developer | developer | architecture, mobile; kotlin for Android or KMP, javascript for React Native (iOS specifics live in the mobile skill's iOS reference); accessibility |
| Game scenarios and state transitions / game-tester | tester | testing, gamedev; the project language |
| Cross-module decisions / architect | architect | architecture; relevant domain knowledge |
| Independent code review / reviewer | reviewer | architecture; relevant implementation knowledge |
| Security review / security-reviewer | reviewer | architecture, security; auth or other knowledge when in scope |
| UI journeys / ui-designer | designer | design, accessibility; html/css or platform knowledge for implementation |
| Test ownership / tester | tester | testing; actual language/framework/domain |
| Documentation / writer | writer | documentation, diagrams; the topic's knowledge |
| Delivery infrastructure / devops | devops | actual container, CI, orchestration, and release knowledge |
| Reliability / sre | sre | reliability; observability/performance when in scope |

One developer may own UI and other runtime code when the project is small. Several instances are justified by boundaries and recurring work, not by how many frameworks are installed. New domains can use any suitable profile; do not create a profile for every technology.

A browser game is not a frontend project because it runs in a browser: gameplay rules, simulation, and the engine adapter belong to a `game-developer` with `gamedev`; menus and HUD built with a web UI framework may belong to a `frontend-developer`. A small game usually needs one developer owning both, with both skill sets.

Realistic splits when the project is large enough:

- **JavaScript game:** `game-developer` (simulation, presentation, scene lifecycle: architecture, gamedev, javascript) and, only if the UI is a substantial web app, `frontend-developer` (frontend, react or vue, html, css, accessibility). A dedicated renderer owner (`webgl-game-developer`) is justified when GPU work is a separate stream: gamedev, performance, javascript.
- **Mobile app with offline sync:** `mobile-developer` (architecture, mobile, platform language, accessibility) plus `backend-developer` for the sync API; the conflict policy is agreed between them, recorded by `architect` when it is consequential.
