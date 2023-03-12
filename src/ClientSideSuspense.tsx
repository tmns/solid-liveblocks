import { createSignal, JSXElement, onMount, Suspense } from 'solid-js'

type Props = {
  fallback: JSXElement
  children: () => JSXElement | undefined
}

/**
 * Almost like a normal <Suspense> component, except that for server-side
 * renders, the fallback will be used.
 *
 * The child props will have to be provided in a function, i.e. change:
 *
 *   <Suspense fallback={<Loading />}>
 *     <MyRealComponent a={1} />
 *   </Suspense>
 *
 * To:
 *
 *   <ClientSideSuspense fallback={<Loading />}>
 *     {() => <MyRealComponent a={1} />}
 *   </ClientSideSuspense>
 *
 */
export function ClientSideSuspense(props: Props) {
  const [mounted, setMounted] = createSignal(false)

  onMount(() => setMounted(true))

  return (
    <Suspense fallback={<p>Loading...</p>}>
      {mounted() ? props.children() : props.fallback}
    </Suspense>
  )
}
