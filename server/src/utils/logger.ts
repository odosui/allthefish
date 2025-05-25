export function log(actor: string, message: string, data?: any) {
  const d = new Date().toISOString();
  if (arguments.length === 2) {
    console.log(`[${d}] (${actor}) ${message}`);
  } else {
    console.log(`[${d}] (${actor}) ${message}`, data);
  }
}
