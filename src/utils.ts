
import * as fs from 'fs';

/**
 * Finds the first path in a list that exists on the file system.
 * @param paths Array of file paths to check
 * @returns The first existing path string, or undefined if none exist
 */
export function findFirstExistingPath(paths: string[]): string | undefined {
    return paths.find(filePath => fs.existsSync(filePath));
}
