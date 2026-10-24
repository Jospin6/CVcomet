/** Account authentication email must be changed through a separate verified workflow.
 * Profile edits cannot assert ownership of a new inbox. */
export function accountEmailChanged(stored: string, requested: unknown): boolean {
  return typeof requested === "string" && requested.trim().toLowerCase() !== stored.trim().toLowerCase();
}
