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
| Cross-module decisions / architect | architect | architecture; relevant domain knowledge |
| Independent code review / reviewer | reviewer | architecture; relevant implementation knowledge |
| Security review / security-reviewer | reviewer | architecture, security; auth or other knowledge when in scope |
| UI journeys / ui-designer | designer | design, accessibility; html/css or platform knowledge for implementation |
| Test ownership / tester | tester | testing; actual language/framework/domain |
| Documentation / writer | writer | documentation; the topic's knowledge |
| Delivery infrastructure / devops | devops | actual container, CI, orchestration, and release knowledge |
| Reliability / sre | sre | reliability; observability/performance when in scope |

One developer may own UI and other runtime code when the project is small. Several instances are justified by boundaries and recurring work, not by how many frameworks are installed. New domains can use any suitable profile; do not create a profile for every technology.

Game/mobile recipes will be added with their substantive knowledge skills. Until then, do not reference nonexistent skills or claim frontend knowledge covers gameplay.
