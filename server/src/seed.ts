import "dotenv/config";
import { seedUsers, SEED_USERS } from "./auth.ts";

seedUsers();
console.log("Seeded users:");
for (const user of SEED_USERS) {
  console.log(`  ${user.displayName}  ${user.email}  /  ${user.password}`);
}
