import {
  injectServerEffect,
  SERVER_EFFECTS_KEY,
  ServerEffect,
  getGlobalEffectById,
} from "../injectServerEffect";

describe(injectServerEffect, () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, SERVER_EFFECTS_KEY);
  });

  it("persists effect globally by the effect ID", async () => {
    let callback = jest.fn();
    await injectServerEffect("myEffect", callback, [1, {}]);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, {});
    expect(getGlobalEffectById("myEffect")).toBeInstanceOf(ServerEffect);
  });

  it("removes the global reference when disposing of the effect", async () => {
    let callback = jest.fn();
    let effect = await injectServerEffect("myEffect", callback, [1, {}]);

    await effect.dispose();

    expect(getGlobalEffectById("myEffect")).toBeUndefined();
  });
});
