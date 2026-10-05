# Bootstrap Recipe Router

The canonical compositions and naming rules live in [project-agent-recipes.md](../../agent-creator/references/project-agent-recipes.md). Init selects them; agent-creator adapts and writes one exact composition.

| Project request | Starting responsibilities |
|---|---|
| small-react-app | frontend implementation plus testing when independently useful |
| go-microservice | service implementation; testing, security, or delivery only where recurring |
| monorepo-fullstack | UI and service owners when actually separate; architect for coupled decisions |
| library | implementation, contract design, testing, or writing as the work requires |
| data-pipeline | data-processing implementation; persistence testing and reliability as applicable |
| web-game | game rules, simulation, and scene lifecycle with gamedev; a separate UI owner only for a substantial web UI; scenario testing of state transitions |
| mobile-app | app lifecycle, restoration, and offline sync with mobile; the sync API owner when it lives in the project |

A technology hint selects knowledge, not an agent identity. Keep project agents optional; a small project can use the main session directly.
