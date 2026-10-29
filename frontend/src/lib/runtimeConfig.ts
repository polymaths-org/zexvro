/** Public deployment configuration; loaded before the application module. */
export function runtimeValue(name:string):string|undefined {
 const config=(globalThis as typeof globalThis & {__ZEXVRO_CONFIG__?:Record<string,string>}).__ZEXVRO_CONFIG__;
 return config?.[name] ?? import.meta.env[name];
}
