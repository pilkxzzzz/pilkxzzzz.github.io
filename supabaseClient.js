import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config.js';

const supabase = createClient(
    supabaseConfig.url,
    supabaseConfig.key,
    supabaseConfig.options
);

export { supabase }; 