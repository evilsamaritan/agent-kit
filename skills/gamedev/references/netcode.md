# Netcode

How a multiplayer game shares one simulation across machines: authority, what crosses the wire each tick, and how clients hide latency. Connection handling, reconnection mechanics, and relay scaling belong to `realtime`.

## Contents

- [Transport is not netcode](#transport-is-not-netcode)
- [Choosing an authority model](#choosing-an-authority-model)
- [Ticks, send rates, and clock sync](#ticks-send-rates-and-clock-sync)
- [Snapshot replication](#snapshot-replication)
- [Client prediction and reconciliation](#client-prediction-and-reconciliation)
- [Interpolating remote entities](#interpolating-remote-entities)
- [Lag compensation](#lag-compensation)
- [Deterministic lockstep](#deterministic-lockstep)
- [Rollback](#rollback)
- [Bandwidth](#bandwidth)
- [Channels and transports](#channels-and-transports)
- [Trust and validation](#trust-and-validation)
- [Match lifetime on the wire](#match-lifetime-on-the-wire)
- [Testing under bad networks](#testing-under-bad-networks)

---

## Transport is not netcode

A connection that reconnects, heartbeats, and scales is a transport. Netcode is the contract above it. Sending every state change as a reliable JSON event and applying it on arrival — the chat-application model — produces the classic failures:

| Symptom | Cause | Netcode answer |
|---|---|---|
| Own character reacts a round trip late | no prediction | client prediction with reconciliation |
| Remote players teleport or stutter | updates applied on arrival, uneven timing | interpolation buffer |
| Everything freezes after one lost packet | reliable ordered transport, head-of-line blocking | unreliable channel, newest snapshot wins |
| Bandwidth grows with every feature | per-change events, no budget | snapshots with deltas, quantization, interest management |
| Cheaters teleport or one-shot | clients send outcomes | clients send intents; authority decides |

## Choosing an authority model

```text
What kind of play?
├── Turn-based or asynchronous
│   → authoritative server validates each command; plain request/response or a reliable channel. No prediction.
├── Many units, few players, input-light (strategy, city builders, simulations)
│   → deterministic lockstep: every peer runs the simulation; only inputs travel.
├── Fast action, many players (shooters, action RPGs, sports)
│   → dedicated authoritative server + snapshots + client prediction + interpolation + lag compensation.
├── Two to a few players, frame-precise (fighting, versus platformers)
│   → rollback on a deterministic simulation.
└── Casual co-op among friends
    → host-authoritative: one client also runs the server role.
```

| Model | What travels | Feel | Cheating surface | Needs determinism | Join in progress | Hosting cost |
|---|---|---|---|---|---|---|
| Authoritative server + snapshots | inputs up, state down | responsive with prediction | low; server decides | no | send a full snapshot | servers per match |
| Host-authoritative | same, host is server | host has zero latency | host can cheat | no | same | none |
| Lockstep | inputs only | input delay equals worst latency | full state on every client (map hacks) | cross-machine | state transfer or replay | relay only |
| Rollback | inputs only | local input immediate; corrections visible | full state on every client | cross-machine | state transfer | relay only |
| Client-authoritative per entity | each client's own state | immediate | high | no | snapshot | relay only |

Choose before the first networked feature. Moving from client authority to server authority, or adding determinism later, rewrites the simulation boundary.

## Ticks, send rates, and clock sync

Three separate rates:

- **Simulation tick** on the server (commonly 20–60 Hz; competitive shooters run higher).
- **Snapshot send rate** to each client (often equal to or lower than the tick, for example every second tick).
- **Input send rate** from clients (every client tick, with the last few inputs repeated in each packet so single losses do not drop input).

Clock sync:

- The client estimates the server tick from round-trip measurements (send local time, server replies with its tick; smooth over many samples).
- The client simulates ahead of the server by half the round trip plus a small jitter margin, so each input arrives just before the server needs it.
- Adjust drift by running the client simulation slightly faster or slower (a few percent) instead of jumping ticks.
- The server keeps a small input buffer per client. A missing input for a tick repeats the client's last input; the client will be corrected if the guess was wrong.

## Snapshot replication

- A snapshot is the state of the entities relevant to one client at one server tick.
- **Delta compression** encodes a snapshot against the last snapshot that client acknowledged (its baseline). Without an ack, delta against an older acknowledged baseline or send full state.
- **Interest management** sends only what the client may perceive: spatial relevance, team visibility, fog of war. Not sending hidden information is also the only reliable defense against wallhacks.
- **Priority accumulation** fits the most important entities into the packet budget: each entity accumulates priority per tick (by distance, relevance, time since sent); the highest are sent and reset.
- **One-shot events** (explosion, kill feed, chat) travel on a reliable channel, or inside snapshots repeated until acknowledged. Spawns and despawns repeat until acknowledged.

## Client prediction and reconciliation

The client runs its own inputs through the same simulation code as the server, immediately. Each input carries a sequence number; each snapshot carries the last sequence the server applied for that client.

```ts
onSnapshot(snapshot: Snapshot) {
  const authoritative = snapshot.entities.get(this.playerId)!.state
  this.pendingInputs = this.pendingInputs.filter(input => input.seq > snapshot.lastAppliedInput)

  let predicted = authoritative
  for (const input of this.pendingInputs) predicted = simulatePlayer(predicted, input, STEP)  // shared rules

  this.presentation.smoothCorrection(this.playerId, this.localState, predicted)  // visual offset decays
  this.localState = predicted
}
```

- Keep an input history ring buffer and the ability to restore and resimulate the predicted entities; resimulation cost per snapshot is part of the frame budget.
- Smooth small corrections over 100–200 ms in presentation; snap large ones.
- Predict what the player controls: movement, own weapon animations, cooldown displays. Do not predict outcomes owned by others (deaths, scores, pickups contested by another player); show them on confirmation, or predict with a visible rollback.
- Quantize state the same way on both sides. If the server simulates with full precision but sends quantized values, every snapshot corrects the client slightly. Quantize authoritative state at the end of each server tick, or predict from the quantized values.

## Interpolating remote entities

- Render remote entities in the past, at `serverTime - interpolationDelay`, so two snapshots usually surround the render time. A delay of two to three snapshot intervals is typical (around 100 ms at 20–30 Hz snapshots).
- Buffer snapshots by server tick; interpolate between the two around the render time.
- When the next snapshot is late, extrapolate for at most one interval, then hold position.
- Adapt the delay to measured jitter: a stable connection can run a shorter buffer.
- Consequence: each client sees others where they were. Hit detection must account for it.

## Lag compensation

- The server keeps a short history of hit volumes per tick.
- A shot arrives stamped with the client's render time (its interpolation time). The server rewinds hit volumes to that time, tests the hit, and restores them.
- Cap the rewind window (for example 200–250 ms). Beyond it, high-latency shooters must lead targets; within it, low-latency victims occasionally die behind cover. The cap sets that tradeoff.
- Apply it to instant checks (hitscan, melee sweeps). Slow projectiles are simulated on the server; the client shows a predicted visual projectile.

## Deterministic lockstep

- Every peer runs the same deterministic simulation. For tick T, each peer needs every player's input for T before advancing.
- Hide latency with input delay: local input is scheduled for tick T + d, where d covers the round trip to the slowest peer.
- Bandwidth is independent of entity count — thousands of units cost the same as ten.
- Requirements: cross-machine determinism, identical builds and data, checksum exchange every N ticks ([saves-and-determinism.md](saves-and-determinism.md)).
- Costs: the slowest connection sets the pace for everyone; joining mid-match needs a state transfer or a fast replay from the start; every client holds the full state.
- A server-relayed variant (the server collects inputs and announces each tick's input set) removes peer-to-peer NAT problems and gives one clock, but clients still simulate everything.

## Rollback

- Each peer simulates immediately using predicted remote inputs (usually "same as last tick").
- When a remote input for an earlier tick T arrives and differs from the prediction, restore the saved state at T and resimulate to the present with corrected inputs, within the current frame.
- Requirements: deterministic simulation; cheap state save and restore every tick (small state, or a ring buffer of snapshots); resimulating several ticks (often up to 7–8) within one frame's budget.
- Presentation must tolerate corrections: one-shot effects and sounds spawned during predicted ticks are keyed by tick and event identity, so resimulation does not duplicate them and cancelled events can be faded out.
- Often combined with a small input delay (1–3 frames) to reduce how often rollbacks happen.
- Fits two to a handful of players with small state; large worlds make save, restore, and resimulation too expensive.

## Bandwidth

- Set an explicit per-client budget (bytes per second, both directions) and measure against it in the worst-case scene.
- Quantize: positions to the precision the game needs within world bounds (16 bits per axis covers a 1 km world at about 1.5 cm), rotations to 8–12 bits per angle or smallest-three quaternions, velocities clamped to a range.
- Pack bits, send change masks so unchanged fields cost one bit, and delta against acknowledged baselines.
- Keep datagram payloads under roughly 1200 bytes to avoid IP fragmentation; split snapshots by priority rather than sending oversize packets.
- Track bytes per entity per snapshot and per-client totals in development builds.

## Channels and transports

| Data | Delivery |
|---|---|
| Snapshots, input streams with redundancy | unreliable, unordered, newest wins |
| Chat, match events, purchases, RPCs that must arrive | reliable, ordered |
| Large one-off transfers (state for join in progress) | reliable, chunked, lower priority |

- Native clients use UDP with a game networking library that adds reliability layers, encryption, and connection management.
- Browser clients get unreliable delivery from WebRTC data channels (unreliable mode) or WebTransport datagrams.
- A reliable ordered transport (TCP, WebSocket) is fine for turn-based games, slow-paced games, and lockstep with generous input delay; fast action over it stalls on every loss.
- Connection setup, reconnection policy, heartbeats, and relay scaling → `realtime`.

## Trust and validation

- Clients send intents; the authority validates ownership, rate (inputs per tick), ranges (maximum speed, reach), cooldowns, and resources.
- Anything sent to a client is readable by the player. Withhold hidden information instead of trusting the client to hide it.
- Client-reported hits are hints that the server verifies with lag compensation.
- In lockstep and rollback, every client has full state: map and information hacks are possible by design. Accept it, or choose server authority.
- Rate-limit and disconnect clients that send malformed or excessive messages; log for review instead of crashing the match.

## Match lifetime on the wire

- Tag every message with a match or session id and a tick. After leaving a match, drop messages for the old id ([scene-and-asset-lifecycle.md](scene-and-asset-lifecycle.md#async-work-across-lifetimes)).
- Reconnection within a grace period resumes with a full snapshot; inputs during the gap are lost. Decide what the server does with an absent player (idle, AI control, removal).
- Ending a match: stop accepting inputs, persist results through the backend, notify clients, then close connections.

## Testing under bad networks

- Run with a network conditioner: added latency, jitter, loss, reordering, duplication. Test a representative bad case (for example 150 ms round trip, 2 percent loss, 20 ms jitter) on every netcode change.
- Run server and clients in one process with a simulated transport for deterministic tests: with zero loss and fixed latency, prediction should produce zero corrections.
- Drive load tests with headless bot clients.
- Track metrics: correction count and magnitude, snapshot arrival rate, input buffer underruns, bytes per second per client, rollback depth.
