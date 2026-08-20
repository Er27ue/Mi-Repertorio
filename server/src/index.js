import { createApp } from "./app.js";
import { openDatabase } from "./db/database.js";

const port = Number(process.env.PORT || 4000);
const db = openDatabase();
const app = createApp(db);

app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor listo en http://localhost:${port}`);
});
