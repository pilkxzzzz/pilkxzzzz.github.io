const SUPABASE_URL = 'https://dpg-ctdij2tumphs7383k0i0-a.oregon-postgres.render.com';
const SUPABASE_KEY = 'gC8eX7MCBUTNFTdOyLEgSkt2rzH9vBh1';

const supabaseConfig = {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
    options: {
        db: {
            schema: 'public'
        },
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
};

export { supabaseConfig };
