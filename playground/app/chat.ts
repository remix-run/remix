import {
  AbstractChat,
  type ChatInit,
  type ChatState,
  type ChatStatus,
  type UIMessage,
} from "ai";

class RemixChatState<
  UI_MESSAGE extends UIMessage,
> implements ChatState<UI_MESSAGE> {
  #messages: UI_MESSAGE[];
  #status: ChatStatus = "ready";
  #error: Error | undefined = undefined;
  onUpdate: () => void;

  constructor(
    onUpdate: () => void = () => {},
    initialMessages: UI_MESSAGE[] = [],
  ) {
    this.onUpdate = onUpdate;
    this.#messages = initialMessages;
  }

  get status(): ChatStatus {
    return this.#status;
  }
  set status(value: ChatStatus) {
    this.#status = value;
    this.onUpdate();
  }
  get error(): Error | undefined {
    return this.#error;
  }
  set error(value: Error | undefined) {
    this.#error = value;
    this.onUpdate();
  }
  get messages(): UI_MESSAGE[] {
    return this.#messages;
  }
  set messages(value: UI_MESSAGE[]) {
    this.#messages = value;
    this.onUpdate();
  }
  pushMessage(message: UI_MESSAGE) {
    this.#messages.push(message);
    this.onUpdate();
  }
  popMessage() {
    const res = this.#messages.pop();
    this.onUpdate();
    return res;
  }
  replaceMessage(index: number, message: UI_MESSAGE) {
    this.#messages[index] = message;
    this.onUpdate();
  }
  snapshot = <T>(value: T): T => structuredClone(value);
}

export class Chat<
  UI_MESSAGE extends UIMessage,
> extends AbstractChat<UI_MESSAGE> {
  state: RemixChatState<UI_MESSAGE>;
  constructor(
    { onUpdate, messages, ...init }: ChatInit<UI_MESSAGE> & {
      onUpdate?: () => void;
    },
  ) {
    // Fan a single state `onUpdate` out to the constructor's listener plus any
    // runtime subscribers (see `subscribe`). This lets independent views (e.g.
    // the chat transcript and the app shell) react to chat changes and re-render
    // locally instead of forcing a single top-level update.
    const listeners = new Set<() => void>();
    const state = new RemixChatState(() => {
      onUpdate?.();
      for (const listener of listeners) listener();
    }, messages);
    super({ ...init, state });
    this.state = state;
    this.#listeners = listeners;
  }

  #listeners: Set<() => void>;

  /**
   * Subscribe to chat updates (messages, status, error). Returns an
   * unsubscribe function. Useful for letting a view re-render itself in
   * response to streaming changes without re-rendering the whole app.
   */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}
