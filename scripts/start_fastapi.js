const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

console.log("Starting FastAPI CDS Gateway (rag_module.api:app) on 127.0.0.1:8000...");

const child = spawn("python", ["-u", "-m", "uvicorn", "rag_module.api:app", "--host", "127.0.0.1", "--port", "8000"], {
  cwd: path.resolve(__dirname, ".."),
});

child.stdout.on("data", (d) => process.stdout.write(d));
child.stderr.on("data", (d) => process.stderr.write(d));

child.on("error", (err) => {
  console.error("Failed to start FastAPI:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  console.log("FastAPI exited with code:", code);
});
