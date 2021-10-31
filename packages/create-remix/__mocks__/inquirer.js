/**
 * @typedef {import('inquirer').DistinctQuestion<T>} DistinctQuestion
 * @template T
 */

module.exports = {
  /**
   *
   * @param {DistinctQuestion<T> | Array<DistinctQuestion<T>>} questions
   * @param {T} [initialAnswers]
   * @returns {Promise<T>}
   * @template T
   */
  async prompt(questions, initialAnswers) {
    return await Promise.resolve(
      (Array.isArray(questions) ? questions : [questions]).reduce(
        (prev, cur) => {
          console.log("mock works!");
          switch (cur.name) {
            case "dir":
              return {
                ...prev,
                dir: "./test-app"
              };
            case "server":
              return {
                ...prev,
                server: "remix"
              };
            case "lang":
              return {
                ...prev,
                lang: "ts"
              };
            case "install":
              return {
                ...prev,
                install: true
              };
            default:
              return prev;
          }
        },
        {}
      )
    );
  }
};
