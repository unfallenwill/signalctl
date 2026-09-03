import { defineCommand } from 'citty';
import { writeJson } from '../output.js';
import { VERSION } from '../version.js';

export default defineCommand({
  meta: {
    name: 'version',
    description: 'Print signalctl version',
    version: VERSION
  },
  run() {
    writeJson({ name: 'signalctl', version: VERSION });
  }
});
