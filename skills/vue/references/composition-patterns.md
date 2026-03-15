# Vue Composition API Patterns

Deep patterns for Composition API, composables, lifecycle, provide/inject, and TypeScript integration.

---

## Composable Patterns

### Basic Composable Structure

```ts
// useMouse.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useMouse() {
  const x = ref(0)
  const y = ref(0)

  function handler(event: MouseEvent) {
    x.value = event.pageX
    y.value = event.pageY
  }

  onMounted(() => window.addEventListener('mousemove', handler))
  onUnmounted(() => window.removeEventListener('mousemove', handler))

  return { x, y }
}
```

### Async Composable with Loading/Error State

```ts
export function useApi<T>(url: MaybeRefOrGetter<string>) {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const isLoading = ref(false)

  async function execute() {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(toValue(url))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      data.value = await response.json()
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  // Auto-refetch when URL changes
  watchEffect(() => {
    toValue(url) // track dependency
    execute()
  })

  return { data, error, isLoading, execute }
}
```

### Composable with Cleanup (onScopeDispose)

```ts
export function useEventListener(
  target: EventTarget,
  event: string,
  handler: EventListener
) {
  onMounted(() => target.addEventListener(event, handler))

  // Works in both component and effectScope contexts
  onScopeDispose(() => target.removeEventListener(event, handler))
}
```

### Composable Accepting Refs or Values

```ts
import { toValue, type MaybeRefOrGetter } from 'vue'

export function useTitle(title: MaybeRefOrGetter<string>) {
  watchEffect(() => {
    document.title = toValue(title) // unwraps ref, getter, or plain value
  })
}

// Usage — all valid:
useTitle('Static Title')
useTitle(ref('Reactive Title'))
useTitle(() => `Page ${page.value}`)
```

---

## Reactivity Deep Dive

### shallowRef for Performance

```ts
// Only triggers when .value is reassigned (not when nested properties change)
const list = shallowRef<Item[]>([])

// Does NOT trigger watchers:
list.value.push(newItem)

// DOES trigger watchers:
list.value = [...list.value, newItem]

// Force trigger without reassignment:
list.value.push(newItem)
triggerRef(list)
```

Use `shallowRef` for: large arrays, objects from external libraries, performance-critical state.

### customRef for Debouncing

```ts
function useDebouncedRef<T>(value: T, delay = 300) {
  let timeout: ReturnType<typeof setTimeout>
  return customRef<T>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(newValue) {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        value = newValue
        trigger()
      }, delay)
    },
  }))
}

// Usage
const searchQuery = useDebouncedRef('', 500)
```

### effectScope for Manual Lifecycle Control

```ts
const scope = effectScope()

scope.run(() => {
  const counter = ref(0)
  watchEffect(() => console.log(counter.value))
  // All effects inside are collected by the scope
})

// Dispose all effects at once
scope.stop()
```

Use effectScope in: stores (Pinia uses this internally), composables outside component context, testing.

---

## Lifecycle Hooks

```ts
// Execution order:
// setup()          — runs synchronously during component creation
// onBeforeMount()  — before initial DOM render
// onMounted()      — DOM is available
// onBeforeUpdate() — before reactive state change causes re-render
// onUpdated()      — after re-render
// onBeforeUnmount()— before component teardown
// onUnmounted()    — component removed from DOM

// SSR-only:
// onServerPrefetch() — async data fetching during SSR
```

**Key rules:**
- `onMounted` callbacks execute in child-first order (children mount before parents)
- `onUpdated` fires after any reactive state change causes re-render
- Never mutate state in `onUpdated` (causes infinite loops)
- Use `nextTick()` to wait for DOM updates after state change

---

## Provide / Inject

### Type-Safe Provide/Inject

```ts
// keys.ts — shared injection key with type
import type { InjectionKey, Ref } from 'vue'

export interface UserContext {
  user: Ref<User | null>
  login: (credentials: Credentials) => Promise<void>
  logout: () => void
}

export const UserKey: InjectionKey<UserContext> = Symbol('user')

// Parent component
import { UserKey } from './keys'

const user = ref<User | null>(null)
provide(UserKey, {
  user,
  login: async (creds) => { /* ... */ },
  logout: () => { user.value = null },
})

// Child component (any depth)
const { user, login, logout } = inject(UserKey)!
// Or with fallback:
const ctx = inject(UserKey, { user: ref(null), login: async () => {}, logout: () => {} })
```

### Readonly Provide (Prevent Child Mutation)

```ts
import { readonly } from 'vue'

const count = ref(0)
provide('count', readonly(count)) // children can read but not mutate
provide('increment', () => count.value++) // expose controlled mutation
```

---

## TypeScript Integration

### Component Props with Types

```vue
<script setup lang="ts">
// Runtime + type declaration
interface Props {
  title: string
  count?: number
  items: string[]
  status: 'active' | 'inactive'
  onChange?: (value: string) => void
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  status: 'active',
})
</script>
```

### Generic Components (Vue 3.3+)

```vue
<script setup lang="ts" generic="T extends { id: string }">
defineProps<{
  items: T[]
  selected?: T
}>()

defineEmits<{
  select: [item: T]
}>()
</script>
```

### Typed Template Refs

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const inputRef = ref<HTMLInputElement | null>(null)
const childRef = ref<InstanceType<typeof MyComponent> | null>(null)

onMounted(() => {
  inputRef.value?.focus()
  childRef.value?.validate() // typed method from defineExpose
})
</script>

<template>
  <input ref="inputRef" />
  <MyComponent ref="childRef" />
</template>
```

### Typed Emits

```vue
<script setup lang="ts">
// Object syntax (Vue 3.3+)
const emit = defineEmits<{
  change: [value: string]
  update: [id: number, data: Partial<User>]
  close: []
}>()

// Usage — fully type-checked
emit('change', 'hello')
emit('update', 1, { name: 'New' })
emit('close')
```

---

## Transition & Animation Patterns

### Transition with Composition API

```vue
<script setup>
import { ref } from 'vue'

const show = ref(true)
</script>

<template>
  <Transition name="fade" mode="out-in">
    <component :is="currentView" :key="currentView" />
  </Transition>
</template>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
```

### TransitionGroup for Lists

```vue
<TransitionGroup name="list" tag="ul">
  <li v-for="item in items" :key="item.id">
    {{ item.text }}
  </li>
</TransitionGroup>
```

---

## Testing Composables

```ts
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useCounter } from './useCounter'

function withSetup<T>(composable: () => T) {
  let result: T
  mount(defineComponent({
    setup() {
      result = composable()
      return () => null
    },
  }))
  return result!
}

test('useCounter', () => {
  const { count, increment } = withSetup(() => useCounter(10))
  expect(count.value).toBe(10)
  increment()
  expect(count.value).toBe(11)
})
```
