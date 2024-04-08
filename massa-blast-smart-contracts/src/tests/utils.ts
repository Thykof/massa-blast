export function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.log(`FAIL: ${message}`);
    throw new Error(message);
  }
}
