export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function normalizeFiles(files) {
  return [...files]
    .filter((file) => ACCEPTED_TYPES.includes(file.type))
    .sort((a, b) => naturalCompare(a.name, b.name))
    .map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      file,
      url: URL.createObjectURL(file),
    }));
}
