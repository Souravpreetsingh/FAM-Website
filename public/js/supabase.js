var SUPABASE_URL = 'https://lpgrycxgjvmchlfwkhvg.supabase.co'
var SUPABASE_ANON_KEY = 'sb_publishable_blPA3m24hDLOLjFZW-bRgg_4zn9bA9D'

if (typeof supabase !== 'undefined' && supabase.createClient) {
  var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} else {
  console.error('[Supabase] Library not loaded. Include the Supabase CDN script first.')
}
