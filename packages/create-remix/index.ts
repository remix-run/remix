export async function createRemix(argv: string[]) {
  console.log("\n🔄 Remix v2 is now part of React Router!");
  console.log("\nRemix v2 has been upstreamed into React Router and is now in maintenance mode.");
  console.log("For new projects, please use React Router instead.");
  console.log("\nTo create a new React Router project, run:");
  
  const command = argv.length > 0 
    ? `npx create-react-router@latest ${argv.join(" ")}`
    : "npx create-react-router@latest";
    
  console.log(`\n  ${command}\n`);
  console.log("Learn more: https://reactrouter.com\n");
}
