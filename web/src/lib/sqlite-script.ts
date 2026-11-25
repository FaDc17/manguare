export function normalizeSqliteScript(script: string): string {
  return script.replace(/\r\n?/g, '\n');
}
