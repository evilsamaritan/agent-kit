# Vue Composition API Patterns

Deep patterns for composables, reactivity, lifecycle, provide/inject, TypeScript, testing, and version notes.

## Contents

- [Composable patterns](#composable-patterns)
- [Reactivity deep dive](#reactivity-deep-dive)
- [Lifecycle hooks](#lifecycle-hooks)
- [Provide / inject](#provide--inject)
- [TypeScript integration](#typescript-integration)
- [Testing composables](#testing-composables)
- [Version notes](#version-notes)

---

## Composable patterns

### Event listener with scope cleanup

Always register the listener. Tie removal to the active scope through `onScopeDispose` when there is one, and return `stop` so callers without a scope can clean up. This works in components, `effectScope`, and stores alike. For element targets (template refs) or SSR code, register after mount instead, because the element or `window` may not exist yet.

```ts
import { getCurrentScope, onScopeDispose } from 'vue'

export function useEventListener(target: EventTarget, event: string, handler: EventListener) {
  target.addEventListener(event, handler)
  const stop = () => target.removeEventListener(event, handler)
  if (getCurrentScope()) onScopeDispose(stop)
  return stop
}
```

```ts
// useMouse.ts — built on the primitive above
export function useMouse() {
  const x = ref(0)
  const y = ref(0)
  useEventListener(window, 'mousemove', (e) => {
    x.value = (e as MouseEvent).pageX
    y.value = (e as MouseEvent).pageY
  })
  return { x, y }
}
```

### Async composable with loading and error state

A refetch triggered by a changed URL must cancel the previous request and ignore its response. Disposal must cancel too.

```ts
import { ref, watchEffect, toValue, type MaybeRefOrGetter } from 'vue'

export function useApi<T>(url: MaybeRefOrGetter<string>) {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const isLoading = ref(false)

  watchEffect(async (onCleanup) => {
    const target = toValue(url)          // tracked dependency
    const controller = new AbortController()
    onCleanup(() => controller.abort())  // runs on re-run and on scope disposal

    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(target, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      data.value = await response.json()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') error.value = e as Error
    } finally {
      if (!controller.signal.aborted) isLoading.value = false
    }
  })

  return { data, error, isLoading }
}
```

For server data in an application, prefer the framework's data layer (`useFetch`/`useAsyncData` in Nuxt) or a server-state library over a hand-written composable; this one shows the cancellation contract.

### Accepting refs, getters, or plain values

```ts
import { toValue, type MaybeRefOrGetter } from 'vue'

export function useTitle(title: MaybeRefOrGetter<string>) {
  watchEffect(() => {
    document.title = toValue(title)
  })
}

useTitle('Static')                    // plain value
useTitle(ref('Reactive'))             // ref
useTitle(() => `Page ${page.value}`)  // getter
```

---

## Reactivity deep dive

### shallowRef for large or external data

```ts
// Only reassigning .value triggers (nested changes do not)
const list = shallowRef<Item[]>([])

list.value.push(newItem)          // does NOT trigger
list.value = [...list.value, newItem]  // triggers
triggerRef(list)                  // force a trigger after in-place mutation
```

Use for large arrays, objects owned by external libraries, and performance-critical state.

### customRef for debouncing

```ts
function useDebouncedRef<T>(value: T, delay = 300) {
  let timeout: ReturnType<typeof setTimeout>
  return customRef<T>((track, trigger) => ({
    get() { track(); return value },
    set(next) {
      clearTimeout(timeout)
      timeout = setTimeout(() => { value = next; trigger() }, delay)
    },
  }))
}
```

Clear the timer on scope disposal if the ref can outlive its component.

### effectScope for manual lifecycle

```ts
const scope = effectScope()
scope.run(() => {
  const counter = ref(0)
  watchEffect(() => console.log(counter.value))
})
scope.stop()   // disposes every effect and onScopeDispose callback created inside
```

Use outside components (stores, long-lived services, tests).

---

## Lifecycle hooks

Order: `setup` → `onBeforeMount` → `onMounted` → `onBeforeUpdate` → `onUpdated` → `onBeforeUnmount` → `onUnmounted`. SSR-only: `onServerPrefetch`.

- `onMounted` runs children before parents.
- Do not mutate state that triggers a re-render inside `onUpdated`.
- Use `nextTick()` to wait for the DOM after a state change.

---

## Provide / inject

### Typed keys

```ts
// keys.ts
import type { InjectionKey, Ref } from 'vue'

export interface UserContext {
  user: Readonly<Ref<User | null>>
  logout: () => void
}
export const UserKey: InjectionKey<UserContext> = Symbol('user')

// provider
const user = ref<User | null>(null)
provide(UserKey, { user: readonly(user), logout: () => { user.value = null } })

// consumer — fail loudly when the provider is missing
const ctx = inject(UserKey)
if (!ctx) throw new Error('UserKey is not provided')
```

The provider owns the state; consumers get readonly refs and call the provided operations.

---

## TypeScript integration

### Props, emits, models

```vue
<script setup lang="ts">
// Reactive destructure with defaults (Vue 3.5+)
const { title, count = 0, status = 'active' } = defineProps<{
  title: string
  count?: number
  status?: 'active' | 'inactive'
}>()

const emit = defineEmits<{
  change: [value: string]
  update: [id: number, data: Partial<User>]
  close: []
}>()

const model = defineModel<string>()
</script>
```

### Generic components

```vue
<script setup lang="ts" generic="T extends { id: string }">
defineProps<{ items: T[]; selected?: T }>()
defineEmits<{ select: [item: T] }>()
</script>
```

### Typed template refs

```vue
<script setup lang="ts">
import { useTemplateRef, onMounted } from 'vue'
import MyComponent from './MyComponent.vue'

const input = useTemplateRef<HTMLInputElement>('input')
const child = useTemplateRef<InstanceType<typeof MyComponent>>('child')

onMounted(() => {
  input.value?.focus()
  child.value?.validate()   // method exposed with defineExpose
})
</script>

<template>
  <input ref="input" />
  <MyComponent ref="child" />
</template>
```

Animation of `<Transition>` and `<TransitionGroup>` is CSS: the `css` skill owns the styling and reduced-motion rules.

---

## Testing composables

Composables that use lifecycle hooks or injection need a host component. Unmount after the test so cleanup runs.

```ts
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

function withSetup<T>(composable: () => T) {
  let result!: T
  const wrapper = mount(defineComponent({
    setup() { result = composable(); return () => null },
  }))
  return { result, unmount: () => wrapper.unmount() }
}

test('useCounter', () => {
  const { result, unmount } = withSetup(() => useCounter(10))
  result.increment()
  expect(result.count.value).toBe(11)
  unmount()
})
```

Also assert that listeners, timers, and requests are released on unmount.

---

## Version notes

Checked 2026-10-06 against the Vue core changelog, the Vue Router 5 migration guide, the Pinia 3 migration guide, and the npm registry. Confirm against the project's installed versions.

| Area | Note |
|------|------|
| Vue 3.3 | `generic` attribute on `<script setup>`, typed emits object syntax |
| Vue 3.4 | `defineModel` stable |
| Vue 3.5 | Reactive props destructure, `useTemplateRef`, `useId` |
| Vue 3.6 (Vapor) | Release-candidate series (3.6.0-rc.10 on 2026-09-30), published under the npm `rc` tag while `latest` stays on 3.5.x. Opt in per component with `<script setup vapor>` (or `<script vapor>`); pure Vapor apps use `createVaporApp()`, virtual-DOM apps need `vaporInteropPlugin` to render Vapor components. Not supported in Vapor: the Options API, `getCurrentInstance()`, `v-memo`. Check the compatibility notes of every library you use before shipping it |
| Vue Router 5 | Absorbs unplugin-vue-router (file-based routing, typed routes) with no breaking changes for plain Router 4 users; data loaders are experimental |
| Pinia 3 | Drops Vue 2 support; the Vue 3 API is unchanged |
