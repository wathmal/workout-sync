import { loadMuscleSvgs } from "@/lib/dashboard/muscle-svg-loader";
import { MuscleCoverage } from "./MuscleCoverage";

/**
 * Server shell: reads the SVG files from disk once at request time and hands
 * them to the client `MuscleCoverage`, which subscribes to `useHevy()` for
 * the actual coverage data.
 */
export function MuscleCoverageCard() {
  const svgs = loadMuscleSvgs();
  return <MuscleCoverage svgs={svgs} />;
}
