export function atob(a: string): string {
  return Buffer.from(a, "base64").toString();
}

export function btoa(b: string): string {
  return Buffer.from(b).toString("base64");
}
