// Test one group without saving anything. Usage: node src/debug-scan.js <groupId> [sorting]
import { scanGroups } from './scan.js';
import { resolvePost } from '../../shared/facebook.js';

const [id = 'boardgamesales', sorting] = process.argv.slice(2);
const group = { fb_id: id, url: `https://www.facebook.com/groups/${id}/`, sorting };
await scanGroups([group], {
  scrolls: 6,
  onResult: (g, res) => {
    if (res.error) return console.log('ERROR', res.error, res.detail || '', res.title || '');
    console.log(`title: ${res.title} | posts: ${res.posts.length}`);
    for (const p of res.posts.slice(0, 4)) {
      const ref = resolvePost(p.links, g.fb_id);
      console.log('---');
      console.log(p.text.replace(/\s+/g, ' ').slice(0, 220));
      console.log('link:', ref?.url || 'NONE', '| links:', p.links.length);
    }
  },
});
