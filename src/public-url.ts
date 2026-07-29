export function publicEventSlug(location: string): string {
  const slug = location
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return slug || "schweiz";
}

export function publicEventPath(event: { id: number; location: string }): string {
  return `/stromausfall/${publicEventSlug(event.location)}-${event.id}`;
}

export function publicEventIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/stromausfall\/[a-z0-9-]*-(\d+)\/?$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
