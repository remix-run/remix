export function filterDataToSingleItem(data = [], preview = false) {
  if (!Array.isArray(data)) {
    return data;
  }

  if (data.length === 1) {
    return data[0];
  }

  if (preview) {
    return data.find(item => item._id.startsWith(`drafts.`)) || data[0];
  }

  return data[0];
}
