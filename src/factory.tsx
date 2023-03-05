import type {
  BaseUserMeta,
  BroadcastOptions,
  Client,
  History,
  Json,
  JsonObject,
  LiveObject,
  LsonObject,
  Others,
  Room,
  User,
} from '@liveblocks/client'
import { shallow } from '@liveblocks/client'
import type { RoomInitializers, ToImmutable } from '@liveblocks/core'
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
} from 'solid-js'
import type { MutationContext, OmitFirstArg, RoomContextBundle, RoomProviderProps } from './types'

// Most of this is nearly a direct port of the React Liveblocks implementation:
// https://github.com/liveblocks/liveblocks/tree/main/packages/liveblocks-react

export function createRoomContext<
  TPresence extends JsonObject,
  TStorage extends LsonObject = LsonObject,
  TUserMeta extends BaseUserMeta = BaseUserMeta,
  TRoomEvent extends Json = never,
>(client: Client): RoomContextBundle<TPresence, TStorage, TUserMeta, TRoomEvent> {
  const RoomContext = createContext<Room<TPresence, TStorage, TUserMeta, TRoomEvent> | null>(null)

  function RoomProvider(props: RoomProviderProps<TPresence, TStorage>) {
    const frozen = {
      initialPresence: props.initialPresence,
      initialStorage: props.initialStorage,
      shouldInitiallyConnect:
        props.shouldInitiallyConnect === undefined
          ? typeof window !== 'undefined'
          : props.shouldInitiallyConnect,
    }

    const room = createMemo<Room<TPresence, TStorage, TUserMeta, TRoomEvent>>((prevRoom) => {
      if (!prevRoom) {
        return client.enter(props.id, {
          initialPresence: frozen.initialPresence,
          initialStorage: frozen.initialStorage,
          shouldInitiallyConnect: frozen.shouldInitiallyConnect,
        } as RoomInitializers<TPresence, TStorage>)
      }

      return client.enter(props.id, {
        initialPresence: frozen.initialPresence,
        initialStorage: frozen.initialStorage,
        withoutConnecting: frozen.shouldInitiallyConnect,
      } as RoomInitializers<TPresence, TStorage>)
    })

    onCleanup(() => client.leave(props.id))

    return <RoomContext.Provider value={room()}>{props.children}</RoomContext.Provider>
  }

  function useRoom(): Room<TPresence, TStorage, TUserMeta, TRoomEvent> {
    const room = useContext(RoomContext)
    if (room === null) {
      throw new Error('RoomProvider is missing from the tree')
    }
    return room
  }

  function useMyPresence(): [
    () => TPresence,
    (patch: Partial<TPresence>, options?: { addToHistory: boolean }) => void,
  ] {
    const room = useRoom()
    const [state, setState] = createSignal(room.getPresence())
    const unsubscribe = room.subscribe('my-presence', (presence) => {
      setState(() => presence)
    })
    onCleanup(() => unsubscribe())

    return [state, room.updatePresence]
  }

  function useUpdateMyPresence(): (
    patch: Partial<TPresence>,
    options?: { addToHistory: boolean },
  ) => void {
    return useRoom().updatePresence
  }

  const identity: <T>(x: T) => T = (x) => x

  function useOthers(): () => Others<TPresence, TUserMeta>
  function useOthers<T>(
    selector: (others: Others<TPresence, TUserMeta>) => T,
    isEqual?: (prev: T, curr: T) => boolean,
  ): () => T
  function useOthers<T>(
    selector?: (others: Others<TPresence, TUserMeta>) => T,
    isEqual?: (prev: T, curr: T) => boolean,
  ): () => T | Others<TPresence, TUserMeta> {
    const room = useRoom()
    const select = selector ?? (identity as (others: Others<TPresence, TUserMeta>) => T)
    const [state, setState] = createSignal(select(room.getOthers()))
    const unsubscribe = room.subscribe('others', (others) => {
      const selectedState = select(others)
      if (!isEqual || !isEqual(state(), selectedState)) {
        setState(() => selectedState)
      }
    })
    onCleanup(() => unsubscribe())

    return state
  }

  function connectionIdSelector(others: Others<TPresence, TUserMeta>): number[] {
    return others.map((user) => user.connectionId)
  }

  function useOthersConnectionIds(): () => readonly number[] {
    return useOthers(connectionIdSelector, shallow)
  }

  function useOthersMapped<T>(
    itemSelector: (other: User<TPresence, TUserMeta>) => T,
    itemIsEqual?: (prev: T, curr: T) => boolean,
  ): () => ReadonlyArray<readonly [connectionId: number, data: T]> {
    const wrappedSelector = (others: Others<TPresence, TUserMeta>) =>
      others.map((other) => [other.connectionId, itemSelector(other)] as const)

    const wrappedIsEqual = (
      a: ReadonlyArray<readonly [connectionId: number, data: T]>,
      b: ReadonlyArray<readonly [connectionId: number, data: T]>,
    ): boolean => {
      const eq = itemIsEqual ?? Object.is
      return (
        a.length === b.length &&
        a.every((atuple, index) => {
          const btuple = b[index]
          return atuple[0] === btuple[0] && eq(atuple[1], btuple[1])
        })
      )
    }

    return useOthers(wrappedSelector, wrappedIsEqual)
  }

  const NOT_FOUND = Symbol()

  type NotFound = typeof NOT_FOUND

  function useOther<T>(
    connectionId: number,
    selector: (other: User<TPresence, TUserMeta>) => T,
    isEqual?: (prev: T, curr: T) => boolean,
  ): () => T {
    const wrappedSelector = (others: Others<TPresence, TUserMeta>) => {
      const other = others.find((other) => other.connectionId === connectionId)
      return other !== undefined ? selector(other) : NOT_FOUND
    }

    const wrappedIsEqual = (prev: T | NotFound, curr: T | NotFound): boolean => {
      if (prev === NOT_FOUND || curr === NOT_FOUND) {
        return prev === curr
      }

      const eq = isEqual ?? Object.is
      return eq(prev, curr)
    }

    const other = useOthers(wrappedSelector, wrappedIsEqual)
    if (other() === NOT_FOUND) {
      throw new Error(`No such other user with connection id ${connectionId} exists`)
    }

    return other as () => T
  }

  function useBroadcastEvent(): (event: TRoomEvent, options?: BroadcastOptions) => void {
    const room = useRoom()

    return (
      event: TRoomEvent,
      options: BroadcastOptions = { shouldQueueEventIfNotReady: false },
    ) => {
      room.broadcastEvent(event, options)
    }
  }

  function useErrorListener(callback: (err: Error) => void): void {
    const room = useRoom()
    room.events.error.subscribe((e: Error) => callback(e))
  }

  function useEventListener(
    callback: (eventData: { connectionId: number; event: TRoomEvent }) => void,
  ): void {
    const room = useRoom()

    const listener = (eventData: { connectionId: number; event: TRoomEvent }) => {
      callback(eventData)
    }

    const unsubscribe = room.events.customEvent.subscribe(listener)

    onCleanup(() => unsubscribe())
  }

  function useSelf(): () => User<TPresence, TUserMeta> | null
  function useSelf<T>(
    selector: (me: User<TPresence, TUserMeta>) => T,
    isEqual?: (prev: T | null, curr: T | null) => boolean,
  ): () => T | null
  function useSelf<T>(
    maybeSelector?: (me: User<TPresence, TUserMeta>) => T,
    isEqual?: (prev: T | null, curr: T | null) => boolean,
  ): () => T | User<TPresence, TUserMeta> | null {
    type Snapshot = User<TPresence, TUserMeta> | null
    type Selection = T | null

    const room = useRoom()

    const selector = maybeSelector ?? (identity as (me: User<TPresence, TUserMeta>) => T)

    const wrappedSelector = (me: Snapshot): Selection => (me !== null ? selector(me) : null)

    const [state, setState] = createSignal(wrappedSelector(room.getSelf()))

    function onChange(): void {
      const newState = wrappedSelector(room.getSelf())
      if (!isEqual || !isEqual(state(), newState)) {
        setState(() => newState)
      }
    }

    const unsub1 = room.events.me.subscribe(onChange)
    const unsub2 = room.events.connection.subscribe(onChange)

    onCleanup(() => {
      unsub1()
      unsub2()
    })

    return state
  }

  function createMutableStorageRoot(): () => LiveObject<TStorage> | null {
    const room = useRoom()

    const [roomWithStorage, setRoomWithStorage] = createSignal(room.getStorageSnapshot())

    const unsub1 = room.events.storageDidLoad.subscribeOnce(() => {
      setRoomWithStorage(room.getStorageSnapshot())
    })

    onCleanup(() => {
      unsub1()
    })

    return roomWithStorage
  }

  function useStorage<T>(
    selector: (root: ToImmutable<TStorage>) => T,
    isEqual?: (prev: T | null, curr: T | null) => boolean,
  ): () => T | null {
    type Snapshot = ToImmutable<TStorage>
    type Selection = T | null

    const room = useRoom()

    const roomWithStorage = createMutableStorageRoot()

    const wrappedSelector = (root: Snapshot): Selection => selector(root)

    const getSnapshot = (): Snapshot => {
      const imm = roomWithStorage()?.toImmutable()
      return imm as ToImmutable<TStorage>
    }

    const [storage, setStorage] = createSignal<Selection>(null)

    createEffect(() => {
      if (roomWithStorage() === null) return

      const unsubscribe = room.subscribe(
        roomWithStorage()!,
        () => {
          const newStorage = wrappedSelector(getSnapshot())
          if (!isEqual || !isEqual(storage(), newStorage)) {
            setStorage(() => newStorage)
          }
        },
        { isDeep: true },
      )

      onCleanup(() => unsubscribe())
    })

    const storageToReturn = createMemo(() => {
      if (roomWithStorage() !== null && !storage()) return wrappedSelector(getSnapshot())
      return storage()
    })

    return storageToReturn
  }

  function makeMutationContext<
    TPresence extends JsonObject,
    TStorage extends LsonObject,
    TUserMeta extends BaseUserMeta,
    TRoomEvent extends Json,
  >(
    room: Room<TPresence, TStorage, TUserMeta, TRoomEvent>,
  ): MutationContext<TPresence, TStorage, TUserMeta> {
    const errmsg = 'This mutation cannot be used until connected to the Liveblocks room'

    return {
      get storage() {
        const mutableRoot = room.getStorageSnapshot()
        if (mutableRoot === null) {
          throw new Error(errmsg)
        }
        return mutableRoot
      },

      get self() {
        const self = room.getSelf()
        // NOTE: We could use room.isSelfAware() here to keep the check consistent with `others`,
        // but we also want to refine the `null` case away here.
        if (self === null) {
          throw new Error(errmsg)
        }
        return self
      },

      get others() {
        const others = room.getOthers()
        if (!room.isSelfAware()) {
          throw new Error(errmsg)
        }
        return others
      },

      setMyPresence: room.updatePresence,
    }
  }

  function useMutation<
    F extends (context: MutationContext<TPresence, TStorage, TUserMeta>, ...args: any[]) => any,
  >(callback: F): OmitFirstArg<F> {
    const room = useRoom()

    return ((...args) =>
      room.batch(() => callback(makeMutationContext(room), ...args))) as OmitFirstArg<F>
  }

  function useHistory(): History {
    return useRoom().history
  }

  function useUndo(): () => void {
    return useHistory().undo
  }

  function useRedo(): () => void {
    return useHistory().redo
  }

  function useCanUndo(): () => boolean {
    const room = useRoom()
    const [canUndo, setCanUndo] = createSignal(room.history.canUndo())
    room.events.history.subscribe(() => {
      setCanUndo(room.history.canUndo())
    })
    return canUndo
  }

  function useCanRedo(): () => boolean {
    const room = useRoom()
    const [canRedo, setCanRedo] = createSignal(room.history.canRedo())
    room.events.history.subscribe(() => {
      setCanRedo(room.history.canRedo())
    })
    return canRedo
  }

  function useBatch<T>(): (callback: () => T) => T {
    return useRoom().batch
  }

  return {
    RoomContext,
    RoomProvider,
    useRoom,
    useMyPresence,
    useUpdateMyPresence,
    useOthers,
    useOthersMapped,
    useOthersConnectionIds,
    useOther,
    useBroadcastEvent,
    useErrorListener,
    useEventListener,
    useSelf,
    useStorage,
    useMutation,
    useHistory,
    useUndo,
    useRedo,
    useCanUndo,
    useCanRedo,
    useBatch,
  }
}
