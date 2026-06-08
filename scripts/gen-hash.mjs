// Generate an ADMIN_PASSWORD_HASH for the .env / Netlify env.
// Usage:  npm run gen-hash -- "your-strong-passphrase"
import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: npm run gen-hash -- "your-strong-passphrase"');
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 10);
console.log('\nADMIN_PASSWORD_HASH=' + hash + '\n');
console.log('Paste this into .env (local) and the Netlify dashboard (production).');
