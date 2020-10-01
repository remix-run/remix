module.exports = ({ search }) => {
  let params = new URLSearchParams(search);

  return {
    useScripts: params.get("disableJs") == null
  };
};
