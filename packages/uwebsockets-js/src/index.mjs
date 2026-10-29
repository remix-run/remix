// Adapted from the upstream ESM wrapper; see upstream.json and LICENSE.
import uws from "./index.cjs";

export default uws;

// App
export const App = uws.App;
export const SSLApp = uws.SSLApp;

// Listen options
export const LIBUS_LISTEN_EXCLUSIVE_PORT = uws.LIBUS_LISTEN_EXCLUSIVE_PORT;

// µSockets functions
export const us_listen_socket_close = uws.us_listen_socket_close;
export const us_socket_local_port = uws.us_socket_local_port;

// Compression enum
export const DISABLED = uws.DISABLED;
export const SHARED_COMPRESSOR = uws.SHARED_COMPRESSOR;
export const SHARED_DECOMPRESSOR = uws.SHARED_DECOMPRESSOR;
export const DEDICATED_DECOMPRESSOR = uws.DEDICATED_DECOMPRESSOR;
export const DEDICATED_COMPRESSOR = uws.DEDICATED_COMPRESSOR;
export const DEDICATED_COMPRESSOR_3KB = uws.DEDICATED_COMPRESSOR_3KB;
export const DEDICATED_COMPRESSOR_4KB = uws.DEDICATED_COMPRESSOR_4KB;
export const DEDICATED_COMPRESSOR_8KB = uws.DEDICATED_COMPRESSOR_8KB;
export const DEDICATED_COMPRESSOR_16KB = uws.DEDICATED_COMPRESSOR_16KB;
export const DEDICATED_COMPRESSOR_32KB = uws.DEDICATED_COMPRESSOR_32KB;
export const DEDICATED_COMPRESSOR_64KB = uws.DEDICATED_COMPRESSOR_64KB;
export const DEDICATED_COMPRESSOR_128KB = uws.DEDICATED_COMPRESSOR_128KB;
export const DEDICATED_COMPRESSOR_256KB = uws.DEDICATED_COMPRESSOR_256KB;
export const DEDICATED_DECOMPRESSOR_32KB = uws.DEDICATED_DECOMPRESSOR_32KB;
export const DEDICATED_DECOMPRESSOR_16KB = uws.DEDICATED_DECOMPRESSOR_16KB;
export const DEDICATED_DECOMPRESSOR_8KB = uws.DEDICATED_DECOMPRESSOR_8KB;
export const DEDICATED_DECOMPRESSOR_4KB = uws.DEDICATED_DECOMPRESSOR_4KB;
export const DEDICATED_DECOMPRESSOR_2KB = uws.DEDICATED_DECOMPRESSOR_2KB;
export const DEDICATED_DECOMPRESSOR_1KB = uws.DEDICATED_DECOMPRESSOR_1KB;
export const DEDICATED_DECOMPRESSOR_512B = uws.DEDICATED_DECOMPRESSOR_512B;

// Temporary KV store
export const getString = uws.getString;
export const setString = uws.setString;
export const getInteger = uws.getInteger;
export const setInteger = uws.setInteger;
export const incInteger = uws.incInteger;
export const lock = uws.lock;
export const unlock = uws.unlock;
export const getIntegerKeys = uws.getIntegerKeys;
export const getStringKeys = uws.getStringKeys;
export const deleteString = uws.deleteString;
export const deleteInteger = uws.deleteInteger;
export const deleteStringCollection = uws.deleteStringCollection;
export const deleteIntegerCollection = uws.deleteIntegerCollection;
export const _cfg = uws._cfg;
export const getParts = uws.getParts;

export const DeclarativeResponse = uws.DeclarativeResponse;
