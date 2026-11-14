// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { createContext } from "react";

/** Name of the place the open case file was found by (city search); null after a plain globe click. */
export const PlaceName = createContext<string | null>(null);
