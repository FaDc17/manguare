// Informa la cobertura documentada y las propuestas visibles por idioma.

import { readFileSync } from 'node:fs';

const read = (id) => JSON.parse(readFileSync(new URL('../web/src/locales/' + id + '.json', import.meta.url), 'utf8'));
const source = read('es');
const proposals = read('propuestas');
const keys = Object.keys(source);
const languages = ['es', 'agr', 'cbt', 'cni'];
const listPending = process.argv.includes('--pendientes');
const requireComplete = process.argv.includes('--completo');

for (const language of languages) {
  const catalog = read(language);
  const pending = keys.filter((key) => !catalog[key]?.trim());
  const translated = keys.length - pending.length;
  const provisional = pending.filter((key) => proposals[language]?.[key]?.trim()).length;
  console.log(language + ': ' + translated + '/' + keys.length + ' documentadas (' + (translated * 100 / keys.length).toFixed(2) + '%)'
    + (provisional ? ', ' + provisional + ' propuestas visibles' : ''));
  if (requireComplete && pending.length) process.exitCode = 1;
  if (listPending && pending.length) {
    for (const key of pending) console.log(`${key}\t${JSON.stringify(source[key])}`);
    console.log();
  }
}
