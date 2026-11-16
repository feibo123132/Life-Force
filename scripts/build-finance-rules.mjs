import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const savingsRoot = process.argv[2];
if (!savingsRoot) throw new Error("Pass the JIEYOU 存钱罐 checkout path.");
const require = createRequire(import.meta.url);
const { build } = require(require.resolve("esbuild", { paths: [require.resolve("vite")] }));

await build({
  stdin: {
    contents: `
      export { getExpectedDailyBudget, getMonthlySpendingMetrics } from './spendingMetrics';
      export { getSpendingDayIndex, getWeeklyEncouragement, getWhaleMood, whaleMoods } from './whaleMood';
    `,
    resolveDir: resolve(savingsRoot, "src/lib"),
  },
  absWorkingDir: resolve(savingsRoot),
  outfile: fileURLToPath(new URL("../cloudfunctions/forest-finance-link/finance-rules.cjs", import.meta.url)),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["date-fns"],
  define: { "import.meta.env.BASE_URL": '""' },
  banner: { js: "// Generated from JIEYOU 存钱罐 by scripts/build-finance-rules.mjs." },
});
