import { initDb, dbAll, dbRun } from './src/lib/db.js'
await initDb()
// Force verify Luigi
dbRun("UPDATE users SET emailVerified = 1, emailVerifyToken = NULL WHERE username = 'Luigi'")

const users = dbAll("SELECT username, emailVerified FROM users")
console.log(users)
process.exit(0)