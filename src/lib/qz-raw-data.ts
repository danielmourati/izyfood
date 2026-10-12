/** QZ 2.x uses command format and hex flavor; format=hex is not its current API. */
export function qzRawData(bytes: Uint8Array) {
  return { type: 'raw', format: 'command', flavor: 'hex', data: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
}