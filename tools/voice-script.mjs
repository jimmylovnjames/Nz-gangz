// Generates VOICE_SCRIPT.md (every voiced line with its id) from the SCRIPT in src/engine/58-story.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src', 'engine', '58-story.js'), 'utf8');
const a = src.indexOf('const SCRIPT = {'), b = src.indexOf('\n};', a);
const SCRIPT = new Function(`return ${src.slice(a + 'const SCRIPT = '.length, b + 2)}`)();
const SCENES = {
  proIntro: ['On the couch at Manu\'s, before the match', 'Relaxed, cans open, Friday night.'],
  barkYouHit: ['Manu reacting when you land a hit (random, during the match)', 'Short, loud, half-laughing.'],
  barkManuHit: ['Manu reacting when he lands a hit (random, during the match)', 'Gloating.'],
  round1You: ['After round 1 if you won it', ''], round1Manu: ['After round 1 if Manu won it', ''],
  debt: ['Round 2: Manu brings up Darren while you both keep playing', 'Eyes on the TV, casual, then annoyed about the money.'],
  matchYou: ['Match over, you won', ''], matchManu: ['Match over, Manu won', ''],
  offer: ['Manu turns from the TV. The player picks a reply', 'Choice lines are spoken by YOU after the player taps them.'],
  offerNo: ['Player chose "Sounds like your problem, cuz."', ''], offerYes: ['Player offers to collect the money', ''],
  darrenMeet: ['Street: you walk up to Darren', 'Darren is nervous, trying to act casual.'],
  darrenExcuse: ['Darren makes excuses; player picks soft or hard', ''],
  darrenPays: ['Soft route: Darren hands over $200', ''], darrenFights: ['Hard route: Darren squares up', 'Angry, cornered.'],
  darrenBeaten: ['Hard route: after you knock Darren down', 'Darren winded, on the ground.'],
  darrenAgain: ['Talking to Darren again after he has paid', ''], manuWaiting: ['Talking to Manu before you have the money', ''],
  returnSmooth: ['Back at Manu\'s with $200', ''], returnHard: ['Back at Manu\'s with the full $400', 'Impressed, a bit worried.'],
  returnEnd: ['Manu points you toward the crews at the square', ''],
};
const name = { manu: 'MANU', you: 'YOU', darren: 'DARREN' };
let md = `# Voice script\n\nEvery spoken line has an id. Record each line as its own file, put the files in the \`voice/\` folder next to \`index.html\`, and list them in \`voice/manifest.js\`:\n\n\`\`\`js\nwindow.AU_VOICE = { pro_01: 'pro_01.m4a', pro_02: 'pro_02.m4a' };\n\`\`\`\n\nAny format the phone plays works (m4a from the recorder app is fine). Lines without a recording show as subtitles only, so you can add them a few at a time. \`{spot}\` is filled in with where Darren hangs out (it changes with your hometown), so record it as a general "round the shops" or send me the variants.\n\nThe game runs from \`src/engine/58-story.js\` (SCRIPT); change the wording there and run \`node tools/voice-script.mjs\` to refresh this file.\n`;
let count = 0;
for (const [key, lines] of Object.entries(SCRIPT)) {
  const [title, note] = SCENES[key] || [key, ''];
  md += `\n## ${title}\n${note ? `\n_${note}_\n` : ''}\n| id | who | line |\n|---|---|---|\n`;
  for (const l of lines) {
    const items = l.choice ? l.choice.map(c => ({ ...c, who: c.who || 'you', choice: true })) : [l];
    for (const it of items) { md += `| \`${it.id}\` | ${name[it.who] || it.who} | ${it.choice ? '(choice) ' : ''}${it.text.replace(/\|/g, '/')} |\n`; count++; }
  }
}
writeFileSync(join(root, 'VOICE_SCRIPT.md'), md);
console.log(`VOICE_SCRIPT.md: ${count} lines`);
