module.exports = api => {
  return [
    `prettier --ignore-path .eslintignore --write ${api.filenames.join(" ")}`,
    `eslint --cache --ext .tsx,.ts,.js,.jsx,.md ${api.filenames.join(
      " "
    )} --fix`
  ];
};
