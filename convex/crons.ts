import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Expired sessions are already refused at resolve time, so this is hygiene
// rather than security: without it the table grows without bound. Off-peak and
// off the hour, because every job scheduled at exactly 00:00 lands together.
crons.daily(
  "purge expired sessions",
  { hourUTC: 3, minuteUTC: 17 },
  internal.auth.purgeExpiredSessions,
);

export default crons;
