import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: accounts, error } = await supabase
    .from('social_accounts')
    .select('id, access_token')
    .eq('platform', 'instagram')
    .order('created_at', { ascending: false });

  const acc = accounts[0];
  const req = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${acc.access_token}`);
  const data = await req.json();
  console.log('--- Permisos del Token ---');
  console.log(JSON.stringify(data, null, 2));
}

test();
