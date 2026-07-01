import { Shazam } from "unofficial-shazam";
import process from "process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(JSON.stringify({ error: "No audio file path provided" }));
  process.exit(1);
}

const filePath = args[0];
const shazam = new Shazam();

try {
  const result = await shazam.recognise(filePath, "en-US");
  console.log(JSON.stringify(result));
} catch (err) {
  console.log(JSON.stringify({ error: err.message }));
}
