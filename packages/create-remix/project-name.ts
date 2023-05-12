export function toValidProjectName(projectName: string) {
  if (isValidProjectName(projectName)) {
    return projectName;
  }
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^[._]/, "")
    .replace(/[^a-z\d\-~]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function isValidProjectName(projectName: string) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName
  );
}
