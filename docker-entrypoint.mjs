/**
 * Container entrypoint.
 *
 * A mounted volume (a Fly volume, a Kubernetes PVC, a `docker run -v /host:/data`
 * bind mount) arrives owned by root and mounted *over* whatever the image had at
 * that path — so any ownership set during the build is gone by the time the app
 * starts. This starts as root, hands the data directory to the unprivileged
 * `node` user, then drops to that user before running the server.
 *
 * If anything here fails the server still starts, just as root: a family losing
 * their calendar because privilege-dropping misfired would be a far worse
 * outcome than running with more privilege than strictly needed.
 */

import { chownSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const APP_USER = "node";

const databasePath = process.env.DATABASE_PATH ?? "data/family-organiser.db";
const dataDir = dirname(databasePath);

mkdirSync(dataDir, { recursive: true });

/** Look up a user's ids without depending on any tool outside Node. */
function resolveUser(name) {
  const line = readFileSync("/etc/passwd", "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${name}:`));
  if (!line) throw new Error(`no such user: ${name}`);
  const [, , uid, gid] = line.split(":");
  return { uid: Number(uid), gid: Number(gid) };
}

/** The data directory is flat — the database and its journal files. */
function chownDirectory(directory, uid, gid) {
  chownSync(directory, uid, gid);
  for (const entry of readdirSync(directory)) {
    chownSync(join(directory, entry), uid, gid);
  }
}

const runningAsRoot = typeof process.getuid === "function" && process.getuid() === 0;

if (runningAsRoot) {
  try {
    const { uid, gid } = resolveUser(APP_USER);
    chownDirectory(dataDir, uid, gid);
    process.setgroups?.([gid]);
    process.setgid(gid);
    process.setuid(uid);
  } catch (error) {
    console.warn(
      `[entrypoint] continuing as root — could not drop privileges: ${error.message}`,
    );
  }
}

await import("./server.js");
