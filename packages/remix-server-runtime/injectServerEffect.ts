export type ServerEffectFunction<Args extends Array<unknown>> = (
  ...args: Args
) => Promise<ServerCleanupFunction> | ServerCleanupFunction;

export type ServerCleanupFunction = () => Promise<void> | void;

export type ServerEffectsMap = Map<string, ServerEffect<Array<unknown>>>;

const SERVER_EFFECTS_KEY = Symbol("remixServerEffects");

/**
 * Creates a server-side effect persisted on tihs Node.js process.
 * Cleans up and re-evaluates the effect on HMR and HDR.
 * @param id Unique string ID of the effect. Effects are persisted
 * and deduplicated by their IDs.
 * @param effect The effect function.
 * @param dependencies The list of effect arguments (dependencies).
 * Pass the arguments to the `effect` in the dependencies array so
 * the effect gets refreshes on HMR and HDR.
 *
 * @example
 * import { init } from 'third-party'
 * import { payload } from './my/utils.server'
 *
 * injectServerEffect('myEffect', (payload) => {
 *  init(payload)
 * }, [payload])
 */
export async function injectServerEffect<Dependencies extends Array<unknown>>(
  id: string,
  callback: ServerEffectFunction<Dependencies>,
  dependencies: Dependencies
) {
  let lastEffect = getGlobalEffectById(id);

  if (typeof lastEffect !== "undefined") {
    // First, clean up the last effect.
    await lastEffect.dispose().catch((error) => {
      console.error(
        `Failed to dispose server effect "${id}": ${error.message}`
      );
      throw error;
    });

    // Then, re-run the effect, updating its result
    // and effect entry methods in the global reference.
    await lastEffect.run(...dependencies);

    return;
  }

  // Create a new effect and run it.
  let effect = new ServerEffect(id, callback);
  await effect.run(...dependencies);

  // Whenever the process is terminated, remove the effect.
  process.on("SIGTERM", effect.dispose).on("SIGINT", effect.dispose);
}

class ServerEffect<Dependencies extends Array<unknown>> {
  public cleanup: ServerCleanupFunction;

  constructor(
    public id: string,
    protected callback: ServerEffectFunction<Dependencies>
  ) {
    this.cleanup = () => {
      throw new Error(
        `Cannot cleanup server effect "${id}": effect not run yet. Did you forget to run the effect?`
      );
    };
  }

  public async run(...dependencies: Dependencies): Promise<void> {
    // Every time the effect is run, it updates its cleanup function
    // to stay up-to-date. This guarantees that whenever dependencies change,
    // the cleanup function doesn't get stale.
    this.cleanup = await this.callback(...dependencies);

    // Every effect run updates its global reference so that
    // HMR and HDR could access the up-to-date effect methods.
    storeGlobalEffect(this.id, this);
  }

  public async dispose(): Promise<void> {
    try {
      await this.cleanup();
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Failed to cleanup server effect "${this.id}": ${error.message}`
        );
        throw error;
      }
    }

    deleteGlobalEffectById(this.id);
  }
}

function storeGlobalEffect(id: string, effect: ServerEffect<any>): void {
  let effectsMap =
    (Reflect.get(globalThis, SERVER_EFFECTS_KEY) as
      | ServerEffectsMap
      | undefined) || (new Map() as ServerEffectsMap);

  effectsMap.set(id, effect);
}

function getGlobalEffectById(id: string): ServerEffect<any> | undefined {
  let effectsMap = Reflect.get(globalThis, SERVER_EFFECTS_KEY) as
    | ServerEffectsMap
    | undefined;

  if (effectsMap) {
    return effectsMap.get(id);
  }
}

function deleteGlobalEffectById(id: string): void {
  let effectsMap = Reflect.get(globalThis, SERVER_EFFECTS_KEY) as
    | ServerEffectsMap
    | undefined;

  if (effectsMap) {
    effectsMap.delete(id);
  }
}
