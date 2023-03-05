# `solid-liveblocks`

### Intro

This is a set of [Solid](https://github.com/solidjs/solid) hooks and providers to use [Liveblocks](https://github.com/liveblocks/liveblocks) declaratively. It is essentially a port of the [React version](https://github.com/liveblocks/liveblocks/tree/main/packages/liveblocks-react) and while, due to Solid's reactivity model, it wasn't completely necessary to port all the hooks over, I did so anyway (for the most part) so the API would be as similar as possible.

On that note, you can refer to the [React Liveblocks docs](https://liveblocks.io/docs/api-reference/liveblocks-react) for more information on the different use cases of the API. Note though, that there is one main difference, which is that for most hooks a Solid signal is returned, which means you must invoke it to get the current value:

```ts
const me = useSelf()

createEffect(() => console.log('Me: ', me()))
```

### Warning

This is still very WIP and most notably does not include:

- tests
- SSR support
- Suspense

So use at your own risk! And help is more than welcome on all of the above :)

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

### License

Licensed under the MIT License, Copyright © 2023-present tmns.

See LICENSE for more information.
