module.exports = ({ url }) => {
  return {
    enableScripts: url.searchParams.get("disableJs") == null
  };
};
