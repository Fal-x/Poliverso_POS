import { runCli } from './simulate-pos-usage.js';
import { runPeriodCli } from './simulate-pos-period.js';

const args = process.argv.slice(2);
const wantsPeriod =
  args.some((arg) => arg.startsWith('--history-days=')) ||
  args.some((arg) => arg.startsWith('--start-date=')) ||
  args.some((arg) => arg.startsWith('--end-date=')) ||
  args.some((arg) => arg.startsWith('--month='));

if (wantsPeriod) {
  await runPeriodCli();
} else {
  await runCli('load');
}
