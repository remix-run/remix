module.exports = ({ location }) => {
  let params = new URLSearchParams(location.search);

  return {
    useScripts: params.get("disableJs") == null
  };
};
