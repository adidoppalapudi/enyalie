/** Browser helpers for saving and opening files. */

/** Largest deck file we try to import (5 MB is thousands of questions). */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Starts a download of `text` as a file named `fileName`. */
export function downloadTextFile(fileName: string, text: string, mimeType = 'application/json'): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the data.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The parts of a picked File that import uses, so tests can pass a plain object. */
export type PickedFile = Pick<File, 'name' | 'size' | 'text'>;

/** Reads a file the user picked, refusing ones that are far too big to be a deck. */
export async function readTextFile(file: PickedFile): Promise<string> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('The file is over 5 MB, too large to be a deck.');
  }
  return file.text();
}
