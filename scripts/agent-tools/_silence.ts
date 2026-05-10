// Imported FIRST by every shim. Redirects console.log to stderr so catalog
// boot prints (and any other library logs) don't pollute stdout — which the
// agent harness parses as JSON tool output.
console.log = (...args: unknown[]) => {
  process.stderr.write(args.map(String).join(" ") + "\n");
};
