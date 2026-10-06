# Profiling, Benchmarking, and Load Testing Method

How to produce trustworthy performance evidence. The review protocol is in [../workflows/review.md](../workflows/review.md). Always-on production profiling infrastructure (agents, pipelines, trace correlation) is owned by `observability`.

## Contents

- [Profile types](#profile-types)
- [Reading a flame graph](#reading-a-flame-graph)
- [Benchmarking](#benchmarking)
- [Load testing](#load-testing)
- [Noise control](#noise-control)
- [Capacity planning](#capacity-planning)
- [Tool selection](#tool-selection)
- [Tools by runtime](#tools-by-runtime)

---

## Profile types

Pick the type that matches the symptom.

| Profile | Question it answers | Use when |
|---------|---------------------|----------|
| CPU (on-CPU sampling) | Which code burns CPU? | CPU high, throughput capped |
| Wall-clock | Where does elapsed time go, on CPU or not? | Latency high, CPU low |
| Off-CPU | What is the thread waiting for (I/O, locks, scheduler)? | Threads blocked, low CPU |
| Allocation / heap | Who allocates, what is retained? | Memory growth, GC pressure, leaks |
| Lock / mutex contention | Which locks serialize work? | Throughput flat as cores grow |

Profiling with a sampling profiler is cheap enough for production at a low sampling rate; instrumenting profilers distort short functions. Profile with release-like build settings and realistic data, or the hotspots will differ.

## Reading a flame graph

- Width is the share of samples (time), not elapsed order. The x-axis is not a timeline.
- Look for wide frames near the top (self time) and wide plateaus: that is where time is spent. Narrow, tall stacks are just deep call chains.
- Compare two profiles (before and after, good and bad) with a differential view instead of eyeballing.
- Check for missing or merged frames: inlining, missing symbols or frame pointers, and runtime frames can hide or misattribute cost.
- Sampling is statistical: a function with a handful of samples is noise.
- Work top-down from the widest application frame; ignore wide frames you cannot change unless you can avoid calling them.

## Benchmarking

- **Warm up.** Runtimes with JIT, caches, connection pools, and lazy loading need warm-up before measurement; measure cold start separately.
- **Run many iterations** and report the distribution (median and spread), not one run or only the mean.
- **Compare against noise.** Repeat the baseline several times; a change smaller than run-to-run variance is not a result. Use the benchmark tool's statistical comparison where it has one.
- **Defeat the optimizer in micro-benchmarks:** make sure the result is used, inputs are not constant-folded, and the work is not eliminated.
- **Use realistic inputs and sizes.** A micro-benchmark on tiny data hides cache and allocation effects. Confirm any micro-level win with an end-to-end measurement.
- **One variable at a time**, same machine, same build mode.

## Load testing

1. **State the question:** capacity limit, regression check, soak behavior, spike behavior.
2. **Model the workload:** request mix, data distribution, payload sizes, think time, and ramp, from production data where possible.
3. **Choose the arrival model.**
   - *Closed model* (fixed number of virtual users, each waits for its response): under overload the generator slows down with the system and under-records latency. This is coordinated omission.
   - *Open model* (requests arrive at a target rate regardless of responses): matches independent real users. Measure latency from the intended send time.
4. **Warm up, then measure steady state.** Drop the ramp from the numbers.
5. **Record latency as a histogram** (for example HDR-style) and compute percentiles from it. Never average percentiles across runs or instances and never report only the mean; merge histograms instead.
6. **Make sure the generator is not the bottleneck:** watch its CPU, network, and connection limits; use several generators if needed.
7. **Watch the system under test,** not just client-side latency: saturation of each resource, queue depth, error rate, GC, pool wait.
8. **Test types:** baseline (expected load), stress (find the knee and the failure mode), soak (hours; leaks and drift), spike (sudden surge and recovery).
9. **Use a production-like environment and data volume.** An empty database or a single instance lies.

## Noise control

- Pin or record: build, runtime flags, instance type, data set, and load shape.
- Avoid noisy neighbors: dedicated or quiet hosts, stable CPU frequency, no other jobs.
- Repeat runs and interleave A/B runs to cancel drift over time.
- Keep timing sources, logging, and metrics overhead the same in both arms.
- If results disagree between runs, find the source of variance before drawing conclusions.

## Capacity planning

```
1. Measure current load (requests/sec, CPU, memory, I/O) and its trend
2. Find the resource that saturates first, and the load at which it does (the knee of the latency curve)
3. Decide headroom: peak load, failure of one failure domain, and growth lead time
4. Choose: scale vertically, horizontally, or reduce waste (a profile-driven fix)
```

Track for each resource: utilization, saturation (queue depth, wait), and errors, plus traffic trend.

## Tool selection

```
Need to profile or load test. What constrains you?
├── Production, cannot modify the app, polyglot hosts → system-wide sampling profiler (kernel-level)
├── Need allocations or locks for one runtime → that runtime's built-in or agent profiler
├── Need trace-level attribution across services → distributed tracing first (see `observability`)
├── Development loop → IDE or CLI profiler on a release-like build
├── Load: scriptable and CI-friendly → code-based load tool with open-model support
├── Load: very large scale → distributed generators
└── Load: needs browser behavior → browser-driven load or synthetic tests
```

Check that a load tool supports an open arrival model and histogram output before relying on its percentiles.

## Tools by runtime

Volatile: tool names and flags change between versions. Verify against the project's runtime version.

| Runtime | Common profiling tools |
|---------|------------------------|
| Node.js | built-in inspector, `--cpu-prof` and `--heap-prof`, `0x` |
| JVM | JFR, async-profiler, GC logs |
| Go | `pprof`, `runtime/trace` |
| Rust | `perf`, `cargo flamegraph`, `tokio-console`, `heaptrack` |
| Python | `cProfile`, `py-spy`, `memray`, `tracemalloc` |
| .NET | `dotnet-trace`, `dotnet-counters`, PerfView |
| Linux, any process | `perf`, bcc and `bpftrace` tools (disk, TCP, off-CPU) |

Framework-native benchmarks for hot-path micro-benchmarks: `cargo bench`, `go test -bench`, and the test framework's benchmark mode elsewhere.
