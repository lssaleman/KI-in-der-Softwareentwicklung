import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(filePath) {
  const envPath = resolve(filePath);
  const content = readFileSync(envPath, "utf-8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function testConnection() {
  console.log("=== Supabase Verbindungstest ===\n");

  console.log("Lade .env.local...");
  loadEnv(".env.local");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL fehlt in .env.local");
    process.exit(1);
  }
  if (!supabaseAnonKey) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt in .env.local");
    process.exit(1);
  }

  console.log(`✓ URL: ${supabaseUrl}`);
  console.log(`✓ Key: ${supabaseAnonKey.slice(0, 20)}...`);
  console.log();

  console.log("Initialisiere Supabase-Client...");
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log("✓ Client erstellt\n");

  console.log("Teste Verbindung (SELECT * FROM user LIMIT 1)...");
  const { data, error } = await supabase.from("user").select("*").limit(1);

  if (error) {
    console.error("❌ Verbindungsfehler:", error.message);
    if (error.code) {
      console.error("   Fehlercode:", error.code);
    }
    process.exit(1);
  }

  console.log("✓ Verbindung erfolgreich!");
  console.log("\nBeispieldaten:");
  console.log(data);
  console.log("\n=== Test bestanden ===");
}

testConnection().catch((err) => {
  console.error("Unerwarteter Fehler:", err.message);
  process.exit(1);
});
