const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.length > 0 && val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val.trim();
  }
});

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkNotes() {
  console.log("Checking database...");
  try {
    // 1. Get couples
    const { data: couples, error: couplesError } = await supabase
      .from('couples')
      .select('*');

    if (couplesError) {
      console.error("Couples query failed:", couplesError);
      return;
    }

    console.log("Couples in DB:", couples);
    if (!couples || couples.length === 0) {
      console.log("No couples in database.");
      return;
    }

    const couple = couples[0];
    const coupleId = couple.id;
    const userId = couple.user_1_id;

    console.log(`Using coupleId: ${coupleId}, userId: ${userId}`);

    // Try to insert one note
    console.log("Inserting first note...");
    const { data: insert1, error: error1 } = await supabase
      .from('notes')
      .insert({
        couple_id: coupleId,
        content: "First test note",
        created_by: userId,
        updated_by: userId
      })
      .select();

    if (error1) {
      console.error("Error inserting first note:", error1);
      return;
    }
    console.log("Inserted first note:", insert1);

    // Try to insert second note
    console.log("Inserting second note...");
    const { data: insert2, error: error2 } = await supabase
      .from('notes')
      .insert({
        couple_id: coupleId,
        content: "Second test note",
        created_by: userId,
        updated_by: userId
      })
      .select();

    if (error2) {
      console.error("Error inserting second note:", error2);
    } else {
      console.log("Successfully inserted second note:", insert2);
    }

    // Clean up test notes
    console.log("Cleaning up test notes...");
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('couple_id', coupleId);
    
    if (deleteError) {
      console.error("Cleanup failed:", deleteError);
    } else {
      console.log("Cleanup succeeded.");
    }

  } catch (e) {
    console.error("Execution error:", e);
  }
}

checkNotes();
