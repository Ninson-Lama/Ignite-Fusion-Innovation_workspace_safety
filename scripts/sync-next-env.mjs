import { writeFileSync } from "node:fs";

const nextEnv = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "vinext/types/augmentations";
import "./.next/types/routes.d.ts";
import "./.next/types/root-params.d.ts";

// NOTE: This file is normalised after Next/vinext commands because each tool
// generates a different compatible subset of these declarations.
`;

writeFileSync(new URL("../next-env.d.ts", import.meta.url), nextEnv);
