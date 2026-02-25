#!/usr/bin/env bun

import { spawn } from "child_process";

interface Task {
  name: string;
  command: string[];
  env: Record<string, string>;
}

function runSequential(command: string[], env: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command.join(" ")}`));
    });
  });
}

function runParallel(tasks: Task[]) {
  return Promise.all(
    tasks.map((task) =>
      new Promise<void>((resolve, reject) => {
        console.log(`Starting ${task.name}...`);
        const child = spawn(task.command[0], task.command.slice(1), {
          stdio: "inherit",
          env: { ...process.env, ...task.env },
        });

        child.on("error", reject);
        child.on("exit", (code) => {
          if (code === 0) {
            console.log(`Finished ${task.name}`);
            resolve();
            return;
          }

          reject(new Error(`${task.name} failed (${code})`));
        });
      }),
    ),
  );
}

async function main() {
  const runFixtures = process.env.BORD_SKIP_FIXTURES !== "1";
  const baseSession = process.env.AGENT_BROWSER_SESSION ?? `bord-capture-${Date.now()}`;

  if (runFixtures) {
    console.log("Preparing fixtures...");
    await runSequential(["bun", "run", "fixtures:setup"]);
    await runSequential(["bun", "run", "fixtures:register"]);
  }

  await runParallel([
    {
      name: "media capture",
      command: ["bun", "run", "qa:capture-media"],
      env: { AGENT_BROWSER_SESSION: `${baseSession}-media` },
    },
    {
      name: "horizontal scroll capture",
      command: ["bun", "run", "qa:capture-hscroll"],
      env: { AGENT_BROWSER_SESSION: `${baseSession}-hscroll` },
    },
  ]);

  console.log("Parallel media capture complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
