# `solid-liveblocks`

### Intro

This is a set of [Solid](https://github.com/solidjs/solid) hooks and providers to use [Liveblocks](https://github.com/liveblocks/liveblocks) declaratively. It is essentially a port of the [React version](https://github.com/liveblocks/liveblocks/tree/main/packages/liveblocks-react) and while, due to Solid's reactivity model, it wasn't completely necessary to port all the hooks over, I did so anyway (for the most part) so the API would be as similar as possible.

On that note, you can refer to the [React Liveblocks docs](https://liveblocks.io/docs/api-reference/liveblocks-react) for more information on the different use cases of the API. Note though, that there is one main difference, which is that for most hooks a Solid signal is returned, which means you must invoke it to get the current value:

```ts
const me = useSelf()

createEffect(() => console.log('Me: ', me()))
```

_Warning: I don't have tests in place yet so don't use for anything critical unless you're feeling particularly adventurous._

### Getting started

First, install the package:

```bash
npm i solid-liveblocks @liveblocks/client
```

Then, you can basically follow the same instructions outlined in [the Liveblocks React getting started docs](https://liveblocks.io/docs/get-started/react#connect-liveblocks-servers):

For example, use `createClient` to create your Liveblocks client and `createRoomContext` to connect to a Liveblocks room:

```ts
// liveblocks.config.ts

import { createClient } from '@liveblocks/client'
import { createRoomContext } from 'solid-liveblocks'

const client = createClient({
  publicApiKey: 'pk_prod_xxxxxxxxxxxxxxxxxxxxxxxx',
})

export const { RoomProvider } = createRoomContext(client)
```

Then you can use the provider in your app:

```tsx
import { RoomProvider } from './liveblocks.config'

function Index() {
  return (
    <RoomProvider id="example-room-id" initialPresence={{}}>
      {/* Components that are inside RoomProvider can use our hooks */}
    </RoomProvider>
  )
}
```

You can check out this [Stackblitz demo](https://stackblitz.com/edit/solidjs-templates-e55hkq?file=README.md) for a rewrite of [the Liveblocks Solid cursors example](https://github.com/liveblocks/liveblocks/tree/main/examples/solidjs-live-cursors). Start it up in more than one client and watch those colorful cursors go!

### Suspense

The same export pattern implemented by Liveblocks for their Suspense hooks was followed here as well. So, you can access all Suspense aware hooks by grabbing them from the nested `suspense` object returned by `createRoomContext`, like so:

```js
export const {
  suspense: {
    RoomProvider,
    useSelf,
    useStorage,
    // ...
  },
} = createRoomContext(client)
```

However, due to the fundamental difference in how Solid renders and thus how it also handles async operations, the actual implementation of each Suspense aware hook is a bit different than its Liveblocks counterpart.

Specifically, you'll notice that what's returned is a [Solid resource](https://www.solidjs.com/docs/latest/api#createresource), which is Solid's primitive for handling async operations. This in turn means the value returned from the hoook has a few special properties that you can use to determine the state of the promise:

```ts
state: 'unresolved' | 'pending' | 'ready' | 'refreshing' | 'errored'
loading: boolean
error: any
latest: T | undefined
```

_Note that these values are Solid's and may change. Please refer to the link above for the most up to date documentation._

Further, since it is a Solid resource, you can use it within a [Solid `Suspense`](https://www.solidjs.com/docs/latest/api#suspense) component and Suspense will trigger automatically without any further work on your part. As a simple example:

```tsx
function ColorList() {
  const colors = useStorage((root) => root.colors)

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <For each={colors()}>{(color) => <li>{color}</li>}</For>
    </Suspense>
  )
}
```

Take care that if you need to use the data from one resource as the input to another, you should ensure to use [Solid's `untrack`](https://www.solidjs.com/docs/latest/api#untrack) where appropriate so as to not cause any infinite loops. For example, say you want to grab the first connected "other" user's id via `useOthersConnectionIds` and then supply it to `useOther`. The following pattern has worked for me:

```tsx
const ids = useOthersConnectionIds()

// Create a memo that returns a signal to our selected other user state.
const countSignal = createMemo(() => {
  const id = ids()?.[0]
  // Note here that we return `untrack(() => useOther(...))`, i.e. we supply our hook wrapped
  // in a function to `untrack` rather than calling it directly. This is important, as it prevents
  // infinite loops (setting & getting the `useOther` signal) while also maintaining reactivity.
  if (id) return untrack(() => useOther(id, (user) => user.presence.count))
})

// The above memo returns a signal to the resource, so for convenience we can create another memo
// to return the actual resource itself.
const count = createMemo(() => countSignal()?.())

// And finally do something with the data, e.g. broadcast an event.
createEffect(() => {
  if (count() > 5) {
    broadcast({ type: 'GT-5', data: { msg: 'Other user has count greater than 5' } })
  }
})
```

### SSR

All non Suspense hooks are compatible with SSR out of the box. The approach for Suspense aware hooks is similar to that of the [official Liveblocks recommendation](https://liveblocks.io/docs/api-reference/liveblocks-react#suspense-avoid-ssr), which is to use a helper component, `ClientSideSuspense`, that acts as a drop in for Solid's `Suspense` and ensures only the fallback is ever rendered on the server:

```tsx
import { ClientSideSuspense } from 'solid-liveblocks'

export default function Page() {
  return (
    <RoomProvider /* ... */>
      <ClientSideSuspense fallback={<p>Loading...</p>}>{() => <App />}</ClientSideSuspense>
    </RoomProvider>
  )
}
```

Note that if you attempt to use a Suspense aware hook without `ClientSideSuspense` via SSR, an error will be thrown on the server.

### License

Licensed under the MIT License, Copyright © 2023-present tmns.

See LICENSE for more information.
