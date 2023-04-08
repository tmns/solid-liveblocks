import { LiveList, LiveObject } from '@liveblocks/client'
import { render, renderHook } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'

import { RoomProvider } from './_liveblocks.config'

/**
 * Testing context for all tests. Sets up a default RoomProvider to wrap all
 * tests with.
 */
export function AllTheProviders(props: { children: JSX.Element }) {
  return (
    <RoomProvider
      id="room"
      initialPresence={() => ({ x: 1 })}
      initialStorage={() => ({
        obj: new LiveObject({
          a: 0,
          nested: new LiveList(['foo', 'bar']),
        }),
      })}
    >
      {props.children}
    </RoomProvider>
  )
}

/**
 * Wrapper for rendering components that are wrapped in a pre set up
 * <RoomProvider> context.
 */
function customRender(Ui: JSX.Element, options?: RenderOptions) {
  return render(() => Ui, { wrapper: AllTheProviders, ...options })
}

/**
 * Wrapper for rendering hooks that are wrapped in a pre set up
 * <RoomProvider> context.
 */
function customRenderHook<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: {
    initialProps?: Props
    wrapper?: JSX.Element
  },
) {
  return renderHook(render, { wrapper: AllTheProviders, ...options })
}

export * from '@solidjs/testing-library'
export { customRender as render, customRenderHook as renderHook }
