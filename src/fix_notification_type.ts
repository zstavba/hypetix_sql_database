import { AppDataSource } from "./data-source";

async function fixNotificationType() {
  const result = await AppDataSource.manager.query(
    "SELECT DISTINCT type FROM notification;"
  );
  console.log("Existing types:", result);

  // Update invalid types to 'message'
  await AppDataSource.manager.query(
    "UPDATE notification SET type = 'message' WHERE type NOT IN ('message', 'billing_plan', 'task');"
  );
  console.log("Invalid types updated to 'message'.");
}

AppDataSource.initialize()
  .then(async () => {
    await fixNotificationType();
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
