// The `server-only` package deliberately throws unless React's "react-server"
// export condition is active. Vitest runs plain Node, so it is aliased to this
// empty module (see vitest.config.ts) to let server modules be unit-tested.
export {};
