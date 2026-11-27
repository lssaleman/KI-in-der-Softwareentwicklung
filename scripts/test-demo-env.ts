import { loadDemoEnv } from "./demo-db.ts"
import { createClient } from "@supabase/supabase-js"
import * as net from "node:net"

async function testDatabaseConnection(dbUrl: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = new URL(dbUrl)
  const host = parsed.hostname
  const port = parseInt(parsed.port || "5432")
  
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end()
      resolve({ ok: true })
    })
    socket.on("error", (error) => {
      resolve({ ok: false, error: error.message })
    })
    socket.setTimeout(5000, () => {
      socket.destroy()
      resolve({ ok: false, error: "Connection timeout" })
    })
  })
}

async function testSupabaseApi(url: string, key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createClient(url, key)
    const { data, error } = await supabase.from("_connection_test").select("*").limit(1)
    
    // Wenn Tabelle nicht existiert (42P01), ist die Verbindung trotzdem OK
    if (error && error.code === "42P01") {
      return { ok: true }
    }
    if (error) {
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function main() {
  console.log("Testing .env.demo configuration...\n")
  
  // Test 1: Load environment
  console.log("1. Loading .env.demo...")
  let env: ReturnType<typeof loadDemoEnv>
  try {
    env = loadDemoEnv(process.cwd())
    console.log("   ✓ Environment loaded successfully")
    console.log(`   - Project Ref: ${env.projectRef}`)
    console.log(`   - API URL: ${env.apiUrl}`)
  } catch (error) {
    console.error("   ✗ Failed to load environment:")
    console.error(`   ${error}`)
    process.exit(1)
  }
  
  // Test 2: Database connection
  console.log("\n2. Testing database connection...")
  const dbResult = await testDatabaseConnection(env.dbUrl)
  if (dbResult.ok) {
    console.log("   ✓ Database connection successful")
  } else {
    console.error(`   ✗ Database connection failed: ${dbResult.error}`)
  }
  
  // Test 3: Supabase API connection
  console.log("\n3. Testing Supabase API connection...")
  const apiResult = await testSupabaseApi(env.apiUrl, env.publishableKey)
  if (apiResult.ok) {
    console.log("   ✓ Supabase API connection successful")
  } else {
    console.error(`   ✗ Supabase API connection failed: ${apiResult.error}`)
  }
  
  // Summary
  console.log("\n" + "=".repeat(50))
  if (dbResult.ok && apiResult.ok) {
    console.log("✓ All tests passed!")
    process.exit(0)
  } else {
    console.log("✗ Some tests failed")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error)
  process.exit(1)
})