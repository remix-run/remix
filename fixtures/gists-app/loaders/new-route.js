module.exports = async () => {
  let res = await fetch("https://api.github.com/gists");
  return res.json();
};
