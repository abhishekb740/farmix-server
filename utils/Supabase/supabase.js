const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL or ANON KEY is not set in environment variables");
    process.exit(1);
}

module.exports = createClient(supabaseUrl, supabaseKey);
