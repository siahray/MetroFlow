import { GlobalRegistrator } from "@happy-dom/global-registrator";

// bun:test has no DOM of its own; this registers window/document globals
// before any test file runs so @testing-library/react has somewhere to mount.
GlobalRegistrator.register();
