import type {
  BaseUserMeta,
  BroadcastOptions,
  History,
  Json,
  JsonObject,
  LiveObject,
  LsonObject,
  Others,
  Resolve,
  Room,
  RoomInitializers,
  ToImmutable,
  User,
} from '@liveblocks/core'
import type { Context, JSX } from 'solid-js'

// Most of this is nearly a direct port of the React Liveblocks implementation:
// https://github.com/liveblocks/liveblocks/tree/main/packages/liveblocks-react

export type RoomContextBundle<
  TPresence extends JsonObject,
  TStorage extends LsonObject,
  TUserMeta extends BaseUserMeta,
  TRoomEvent extends Json,
> = {
  /**
   * You normally don't need to directly interact with the RoomContext, but
   * it can be necessary if you're building an advanced app where you need to
   * set up a context bridge between two Solid renderers.
   */
  RoomContext: Context<Room<TPresence, TStorage, TUserMeta, TRoomEvent> | null>

  /**
   * Makes a Room available in the component hierarchy below.
   * When this component is unmounted, the current user leave the room.
   * That means that you can't have 2 RoomProvider with the same room id in your Solid tree.
   */
  RoomProvider(props: RoomProviderProps<TPresence, TStorage>): JSX.Element

  /**
   * Returns the Room of the nearest RoomProvider above in the Solid component
   * tree.
   */
  useRoom(): Room<TPresence, TStorage, TUserMeta, TRoomEvent>

  /**
   * Returns the presence of the current user of the current room, and a function to update it.
   * It is different from the setState function returned by the createSignal hook from Solid.
   * You don't need to pass the full presence object to update it.
   *
   * @example
   * const [myPresence, updateMyPresence] = useMyPresence();
   * updateMyPresence({ x: 0 });
   * updateMyPresence({ y: 0 });
   *
   * // "myPresence" will be equal to "{ x: 0, y: 0 }"
   */
  useMyPresence(): [
    () => TPresence,
    (patch: Partial<TPresence>, options?: { addToHistory: boolean }) => void,
  ]

  /**
   * useUpdateMyPresence is similar to useMyPresence but it only returns the function to update the current user presence.
   *
   * @example
   * const updateMyPresence = useUpdateMyPresence();
   * updateMyPresence({ x: 0 });
   * updateMyPresence({ y: 0 });
   *
   * // The presence of the current user will be equal to "{ x: 0, y: 0 }"
   */
  useUpdateMyPresence(): (patch: Partial<TPresence>, options?: { addToHistory: boolean }) => void

  /**
   * Returns an object that lets you get information about all the users currently connected in the room.
   *
   * @example
   * const others = useOthers();
   *
   * // Example to map all cursors in JSX
   * return (
   *  <Key each={others()} by="connectionId">
   *    {(other) => (
   *      <Show when={other().presence?.cursor}>
   *        <Cursor cursor={other().presence.cursor} />
   *      </Show>
   *    )}
   *  </Key>
   * )
   */
  useOthers(): () => Others<TPresence, TUserMeta>

  /**
   * Extract arbitrary data based on all the users currently connected in the
   * room (except yourself).
   *
   * The selector function will get re-evaluated any time a user enters or
   * leaves the room, as well as whenever their presence data changes.
   *
   * By default `useOthers()` uses strict `===` to check for equality. Take
   * extra care when returning a computed object or list, for example when you
   * return the result of a .map() or .filter() call from the selector. In
   * those cases, you'll probably want to use a `shallow` comparison check.
   *
   * @example
   * const avatars = useOthers(users => users.map(u => u.info.avatar), shallow);
   * const cursors = useOthers(users => users.map(u => u.presence.cursor), shallow);
   * const someoneIsTyping = useOthers(users => users.some(u => u.presence.isTyping));
   *
   */
  useOthers<T>(
    selector: (others: Others<TPresence, TUserMeta>) => T,
    isEqual?: (prev: T, curr: T) => boolean,
  ): () => T

  /**
   * Returns an array of connection IDs. This matches the values you'll get by
   * using the `useOthers()` hook.
   *
   * Roughly equivalent to:
   *   useOthers((others) => others.map(other => other.connectionId), shallow)
   *
   * This is useful in particular to implement efficiently rendering components
   * for each user in the room, e.g. cursors.
   *
   * @example
   * const ids = useOthersConnectionIds();
   * // () => [2, 4, 7]
   */
  useOthersConnectionIds(): () => readonly number[]

  /**
   * Related to useOthers(), but optimized for selecting only "subsets" of others.
   *
   * @example
   * const avatars = useOthersMapped(user => user.info.avatar);
   * //    ^^^^^^^
   * //    () => { connectionId: number; data: string }[]
   *
   * The selector function you pass to useOthersMapped() is called an "item
   * selector", and operates on a single user at a time. If you provide an
   * (optional) "item comparison" function, it will be used to compare each
   * item pairwise.
   *
   * For example, to select multiple properties:
   *
   * @example
   * const avatarsAndCursors = useOthersMapped(
   *   user => [u.info.avatar, u.presence.cursor],
   *   shallow,  // 👈
   * );
   */
  useOthersMapped<T>(
    itemSelector: (other: User<TPresence, TUserMeta>) => T,
    itemIsEqual?: (prev: T, curr: T) => boolean,
  ): () => ReadonlyArray<readonly [connectionId: number, data: T]>

  /**
   * Given a connection ID (as obtained by using `useOthersConnectionIds`),
   * you can call this selector deep down in your component stack to create a reactive
   * signal only for properties for this particular user
   *
   * @example
   * // Returns only the selected values
   * const { x, y } = useOther(2, user => user.presence.cursor);
   */
  useOther<T>(
    connectionId: number,
    selector: (other: User<TPresence, TUserMeta>) => T,
    isEqual?: (prev: T, curr: T) => boolean,
  ): () => T

  /**
   * Returns a callback that lets you broadcast custom events to other users in the room.
   *
   * @example
   * const broadcast = useBroadcastEvent();
   *
   * broadcast({ type: "CUSTOM_EVENT", data: { x: 0, y: 0 } });
   */
  useBroadcastEvent(): (event: TRoomEvent, options?: BroadcastOptions) => void

  /**
   * useErrorListener is a hook that lets you react to potential room connection errors.
   *
   * @example
   * useErrorListener(er => {
   *   console.error(er);
   * })
   */
  useErrorListener(callback: (err: Error) => void): void

  /**
   * useEventListener is a hook that lets you react to event broadcasted by other users in the room.
   *
   * @example
   * useEventListener(({ connectionId, event }) => {
   *   if (event.type === "CUSTOM_EVENT") {
   *     // Do something
   *   }
   * });
   */
  useEventListener(callback: (eventData: { connectionId: number; event: TRoomEvent }) => void): void

  /**
   * Gets the current user once it is connected to the room.
   *
   * @example
   * const me = useSelf();
   * const { x, y } = me().presence.cursor;
   */
  useSelf(): () => User<TPresence, TUserMeta> | null

  /**
   * Extract arbitrary data based on the current user.
   *
   * The selector function will get re-evaluated any time your presence data
   * changes.
   *
   * By default `useSelf()` uses strict `===` to check for equality. Take extra
   * care when returning a computed object or list, for example when you return
   * the result of a .map() or .filter() call from the selector. In those
   * cases, you'll probably want to use a `shallow` comparison check.
   *
   * Will return `null` while Liveblocks isn't connected to a room yet.
   *
   * @example
   * const cursor = useSelf(me => me.presence.cursor);
   * if (cursor() !== null) {
   *   const { x, y } = cursor();
   * }
   *
   */
  useSelf<T>(
    selector: (me: User<TPresence, TUserMeta>) => T,
    isEqual?: (prev: T, curr: T) => boolean,
  ): () => T | null

  /**
   * Extract arbitrary data from the Liveblocks Storage state, using an
   * arbitrary selector function.
   *
   * The selector function will get re-evaluated any time something changes in
   * Storage. The value returned by your selector function will also be the
   * value returned by the hook.
   *
   * The `root` value that gets passed to your selector function is
   * a immutable/readonly version of your Liveblocks storage root.
   *
   * The component that uses this hook will automatically re-render if the
   * returned value changes.
   *
   * By default `useStorage()` uses strict `===` to check for equality. Take
   * extra care when returning a computed object or list, for example when you
   * return the result of a .map() or .filter() call from the selector. In
   * those cases, you'll probably want to use a `shallow` comparison check.
   */
  useStorage<T>(
    selector: (root: ToImmutable<TStorage>) => T,
    isEqual?: (prev: T | null, curr: T | null) => boolean,
  ): () => T | null

  /**
   * Create a callback function that lets you mutate Liveblocks state.
   *
   * The first argument that gets passed into your callback will be a "mutation
   * context", which exposes the following:
   *
   *   - `root` - The mutable Storage root.
   *              You can normal mutation on Live structures with this, for
   *              example: root.get('layers').get('layer1').set('fill', 'red')
   *
   *   - `setMyPresence` - Call this with a new (partial) Presence value.
   *
   *   - `self` - A read-only version of the latest self, if you need it to
   *              compute the next state.
   *
   *   - `others` - A read-only version of the latest others list, if you need
   *                it to compute the next state.
   *
   * If you want get access to the immutable root somewhere in your mutation,
   * you can use `root.ToImmutable()`.
   *
   * @example
   * const fillLayers = useMutation(
   *   ({ root }, color: Color) => {
   *     ...
   *   },
   *   [],
   * );
   *
   * fillLayers('red');
   *
   * const deleteLayers = useMutation(
   *   ({ root }) => {
   *     ...
   *   },
   *   [],
   * );
   *
   * deleteLayers();
   */
  useMutation<
    F extends (context: MutationContext<TPresence, TStorage, TUserMeta>, ...args: any[]) => any,
  >(
    callback: F,
  ): OmitFirstArg<F>

  /**
   * Returns the room.history
   */
  useHistory(): History

  /**
   * Returns a function that undoes the last operation executed by the current client.
   * It does not impact operations made by other clients.
   */
  useUndo(): () => void

  /**
   * Returns a function that redoes the last operation executed by the current client.
   * It does not impact operations made by other clients.
   */
  useRedo(): () => void

  /**
   * Returns whether there are any operations to undo.
   */
  useCanUndo(): () => boolean

  /**
   * Returns whether there are any operations to redo.
   */
  useCanRedo(): () => boolean

  /**
   * Returns a function that batches modifications made during the given function.
   * All the modifications are sent to other clients in a single message.
   * All the modifications are merged in a single history item (undo/redo).
   * All the subscribers are called only after the batch is over.
   */
  useBatch<T>(): (callback: () => T) => T
}

export type RoomProviderProps<TPresence extends JsonObject, TStorage extends LsonObject> = Resolve<
  {
    /**
     * The id of the room you want to connect to
     */
    id: string
    children: JSX.Element

    /**
     * Whether or not the room should connect to Liveblocks servers
     * when the RoomProvider is rendered.
     *
     * By default equals to `typeof window !== "undefined"`,
     * meaning the RoomProvider tries to connect to Liveblocks servers
     * only on the client side.
     */
    shouldInitiallyConnect?: boolean
  } & RoomInitializers<TPresence, TStorage>
>

export type MutationContext<
  TPresence extends JsonObject,
  TStorage extends LsonObject,
  TUserMeta extends BaseUserMeta,
> = {
  storage: LiveObject<TStorage>
  self: User<TPresence, TUserMeta>
  others: Others<TPresence, TUserMeta>
  setMyPresence: (patch: Partial<TPresence>, options?: { addToHistory: boolean }) => void
}

/**
 * For any function type, returns a similar function type, but without the
 * first argument.
 */
export type OmitFirstArg<F> = F extends (first: any, ...rest: infer A) => infer R
  ? (...args: A) => R
  : never
