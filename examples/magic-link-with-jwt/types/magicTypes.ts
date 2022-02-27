import type {
  InstanceWithExtensions,
  MagicSDKExtensionsOption,
  SDKBase,
} from "@magic-sdk/provider";

export type MagicInstance = InstanceWithExtensions<
  SDKBase,
  MagicSDKExtensionsOption<string>
>;
