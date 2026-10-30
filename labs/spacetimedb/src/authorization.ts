// Public identities only. The dedicated gateway token is kept in Cloudflare Secrets.
export const LABS_GATEWAY_IDENTITY='c20034125f35d02691bc817065a26ba7f4923a9012da8f490835d06e4de4dfd4';
export const LABS_OWNER_IDENTITY='c2006d06b0a36772fba5928b6c1032481aa24768bcf00cd2387a8bf7ed1047f9';
export function isTrustedGateway(sender:{toHexString():string}):boolean{
 const id=sender.toHexString().toLowerCase();return id===LABS_GATEWAY_IDENTITY || id===LABS_OWNER_IDENTITY;
}
