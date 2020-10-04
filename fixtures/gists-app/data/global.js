module.exports = ({ search }) => {
  let params = new URLSearchParams(search);

  return {
    enableScripts: params.get("disableJs") == null
  };
};
