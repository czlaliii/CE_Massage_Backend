// Terminal command: 
// npx tsx scripts/create-admin.ts

import bcrypt from 'bcrypt';

const hash =
    await bcrypt.hash(
        'AdminEdina2026',
        10
    );

console.log(hash);